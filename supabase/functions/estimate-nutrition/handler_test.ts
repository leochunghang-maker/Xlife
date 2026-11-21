// All upstream/auth/DB calls are injected mocks. No network/env permissions.
import assert from "node:assert/strict";
import images from "./test-images.json" with { type: "json" };
import {
  createHandler,
  type Dependencies,
  MAX_BODY_BYTES,
  MAX_IMAGE_BYTES,
  validateInput,
} from "./handler.ts";
const total = {
  calories: 100,
  protein_g: 2,
  carbs_g: 20,
  fat_g: 1,
  sugar_g: 1,
};
const estimate = {
  is_food: true,
  items: [{ name: "synthetic meal", portion: "one", ...total }],
  total,
  confidence: "low",
  notes: "Approximate test fixture, not a real estimate.",
};
function setup(overrides: Partial<Dependencies> = {}) {
  const calls = { auth: 0, quota: 0, upstream: 0 };
  const handler = createHandler({
    apiKey: "synthetic-server-key",
    authenticate: async () => {
      calls.auth++;
      return { id: "verified-user" };
    },
    reserve: async () => {
      calls.quota++;
      return true;
    },
    fetcher: async () => {
      calls.upstream++;
      return Response.json({
        choices: [{ message: { content: JSON.stringify(estimate) } }],
      });
    },
    ...overrides,
  });
  return { handler, calls };
}
function request(
  body: unknown = { image: images.png },
  headers: Record<string, string> = {},
) {
  return new Request("https://edge.invalid/estimate", {
    method: "POST",
    headers: {
      authorization: "Bearer synthetic-jwt",
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
Deno.test("valid structural PNG/JPEG/WebP and typed estimate with approximate flag", async () => {
  for (const image of Object.values(images)) {
    assert.equal(validateInput({ image, note: "meal" }).image, image);
    const { handler, calls } = setup();
    const response = await handler(request({ image }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.approximate, true);
    assert.deepEqual(body.estimate, estimate);
    assert.equal(calls.quota, 1);
    assert.equal(calls.upstream, 1);
  }
});
Deno.test("method/preflight and missing server configuration make no paid call", async () => {
  const { handler, calls } = setup({ apiKey: "" });
  assert.equal(
    (await handler(new Request("https://edge.invalid", { method: "OPTIONS" })))
      .status,
    200,
  );
  assert.equal(
    (await handler(new Request("https://edge.invalid"))).status,
    405,
  );
  assert.equal((await handler(request())).status, 503);
  assert.equal(calls.upstream, 0);
});
Deno.test("missing/invalid auth fails before body read or quota", async () => {
  for (const auth of ["", "Basic no", "Bearer "]) {
    const { handler, calls } = setup();
    assert.equal(
      (await handler(request(undefined, { authorization: auth }))).status,
      401,
    );
    assert.equal(calls.auth, 0);
    assert.equal(calls.quota, 0);
  }
  const { handler, calls } = setup({ authenticate: async () => null });
  assert.equal((await handler(request())).status, 401);
  assert.equal(calls.quota, 0);
});
Deno.test("auth error/timeout fails closed without provider call", async () => {
  for (
    const authenticate of [async () => {
      throw new Error("raw credential details");
    }, async () => await new Promise<never>(() => {})]
  ) {
    const { handler, calls } = setup({ authenticate, authTimeoutMs: 5 });
    const r = await handler(request());
    assert.equal(r.status, 503);
    assert.ok(!(await r.text()).includes("credential"));
    assert.equal(calls.upstream, 0);
  }
});
Deno.test("JSON/field/content types/owner spoof rejected before reserving quota", async () => {
  const invalid = [
    "{",
    [],
    null,
    { image: 3 },
    { image: images.png, note: 3 },
    { image: images.png, note: "x".repeat(301) },
    { image: images.png, user_id: "victim" },
    { image: images.png, limit: 999 },
    {},
  ];
  for (const body of invalid) {
    const { handler, calls } = setup();
    assert.equal((await handler(request(body))).status, 400);
    assert.equal(calls.quota, 0);
  }
  const { handler } = setup();
  assert.equal(
    (await handler(request(undefined, { "content-type": "text/plain" })))
      .status,
    415,
  );
});
Deno.test("JSON MIME suffix spoof and oversize auth header are rejected", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (await handler(request(undefined, { "content-type": "application/jsonp" })))
      .status,
    415,
  );
  assert.equal(
    (await handler(
      request(undefined, { authorization: "Bearer " + "x".repeat(8192) }),
    )).status,
    401,
  );
  assert.equal(calls.upstream, 0);
});
Deno.test("base64 bytes, padding, format spoof, image header and dimension bounds", async () => {
  const hugePng = Uint8Array.from(
    atob(images.png.split(",")[1]),
    (c) => c.charCodeAt(0),
  );
  hugePng.set([0, 1, 0, 0], 16);
  const invalid = [
    "data:image/jpeg;base64,@@@=",
    "data:image/png;base64,AAAA",
    "data:image/png;base64,A===",
    images.jpeg.replace("jpeg", "png"),
    images.png.replace("png", "jpeg"),
    "data:image/gif;base64,AAAA",
    "data:image/png;base64," + btoa(String.fromCharCode(...hugePng)),
  ];
  for (const image of invalid) {
    const { handler, calls } = setup();
    assert.equal((await handler(request({ image }))).status, 400);
    assert.equal(calls.quota, 0);
  }
  const { handler, calls } = setup();
  const r = await handler(
    request({
      image: "data:image/jpeg;base64," +
        "A".repeat(Math.ceil((MAX_IMAGE_BYTES + 3) / 3) * 4),
    }),
  );
  assert.equal(r.status, 413);
  assert.equal(calls.quota, 0);
});
Deno.test("actual streamed body bound defeats absent/lying Content-Length, cancels stream", async () => {
  for (const declared of [null, "1"]) {
    let cancelled = false;
    let chunks = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        chunks++;
        c.enqueue(new Uint8Array(200_000));
      },
      cancel() {
        cancelled = true;
      },
    });
    const headers: Record<string, string> = {
      authorization: "Bearer fake",
      "content-type": "application/json",
    };
    if (declared) headers["content-length"] = declared;
    const { handler, calls } = setup();
    const r = await handler(
      new Request("https://edge.invalid", {
        method: "POST",
        headers,
        body: stream,
      }),
    );
    assert.equal(r.status, 413);
    assert.ok(cancelled);
    assert.ok(chunks < 20);
    assert.equal(calls.quota, 0);
  }
  const { handler, calls } = setup();
  assert.equal(
    (await handler(
      request(undefined, { "content-length": String(MAX_BODY_BYTES + 1) }),
    )).status,
    413,
  );
  assert.equal(calls.quota, 0);
});
Deno.test("slow body timeout cancels stalled stream", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start() {},
    cancel() {
      cancelled = true;
    },
  });
  const { handler, calls } = setup({ readTimeoutMs: 5 });
  const r = await handler(
    new Request("https://edge.invalid", {
      method: "POST",
      headers: {
        authorization: "Bearer fake",
        "content-type": "application/json",
      },
      body: stream,
    }),
  );
  assert.equal(r.status, 408);
  assert.ok(cancelled);
  assert.equal(calls.quota, 0);
});
Deno.test("invalid UTF8 rejected without quota", async () => {
  const { handler, calls } = setup();
  const r = await handler(
    new Request("https://edge.invalid", {
      method: "POST",
      headers: {
        authorization: "Bearer fake",
        "content-type": "application/json",
      },
      body: new Uint8Array([0xff, 0xfe]),
    }),
  );
  assert.equal(r.status, 400);
  assert.equal(calls.quota, 0);
});
Deno.test("quota denied/error/untyped response/timeout fail closed", async () => {
  const cases: [Dependencies["reserve"], number][] = [
    [async () => false, 429],
    [async () => {
      throw new Error("raw SQL credentials/photos");
    }, 503],
    [async () => null as unknown as boolean, 503],
    [async () => await new Promise<never>(() => {}), 503],
  ];
  for (const [reserve, status] of cases) {
    const { handler, calls } = setup({ reserve, dbTimeoutMs: 5 });
    const r = await handler(request());
    assert.equal(r.status, status);
    assert.equal(calls.upstream, 0);
    assert.ok(!(await r.text()).includes("credentials"));
  }
});
Deno.test("upstream timeout covers headers and response body; aborts request", async () => {
  let aborted = false;
  const { handler } = setup({
    upstreamTimeoutMs: 5,
    fetcher: async (_input, init) =>
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new Error("cancelled"));
        });
      }),
  });
  assert.equal((await handler(request())).status, 504);
  assert.ok(aborted);
  const bodyTimeout = setup({
    upstreamTimeoutMs: 5,
    fetcher: async () => new Response(new ReadableStream({ start() {} })),
  });
  assert.equal((await bodyTimeout.handler(request())).status, 504);
});
Deno.test("provider errors/network/malformed/oversized responses are safe and never canned estimates", async () => {
  const fetchers: Dependencies["fetcher"][] = [
    async () =>
      new Response("private provider echo with image JWT and secret", {
        status: 400,
      }),
    async () => {
      throw new Error("photo/secret-network-echo");
    },
    async () => new Response("bad json"),
    async () => Response.json({ choices: [{ message: { content: "{}" } }] }),
    async () => new Response("x".repeat(65_000)),
  ];
  for (const fetcher of fetchers) {
    const { handler } = setup({ fetcher });
    const r = await handler(request());
    assert.ok([502, 503].includes(r.status));
    const body = await r.text();
    assert.ok(
      !body.includes("private provider") && !body.includes("secret") &&
        !body.includes('estimate":'),
    );
  }
});
Deno.test("provider extra fields, wrong types and inconsistent non-food are rejected", async () => {
  for (
    const bad of [{ ...estimate, raw_image: "must not echo" }, {
      ...estimate,
      total: { ...total, calories: -1 },
    }, { ...estimate, is_food: false }]
  ) {
    const { handler } = setup({
      fetcher: async () =>
        Response.json({
          choices: [{ message: { content: JSON.stringify(bad) } }],
        }),
    });
    const r = await handler(request());
    assert.equal(r.status, 502);
    assert.ok(!(await r.text()).includes("raw_image"));
  }
});
Deno.test("concurrent handler attempts invoke provider only for atomic-reserved slots", async () => {
  let spent = 0;
  const limit = 4;
  const { handler, calls } = setup({
    reserve: async () => {
      if (spent >= limit) return false;
      spent++;
      await Promise.resolve();
      return true;
    },
  });
  const responses = await Promise.all(
    Array.from({ length: 32 }, () => handler(request())),
  );
  assert.equal(responses.filter((r) => r.status === 200).length, limit);
  assert.equal(responses.filter((r) => r.status === 429).length, 28);
  assert.equal(calls.upstream, limit);
  await Promise.all(responses.map((r) => r.body?.cancel()));
});
Deno.test("abandoned request cannot reach provider after cancellation", async () => {
  const controller = new AbortController();
  let reserve = 0;
  const { handler, calls } = setup({
    reserve: async () => {
      reserve++;
      controller.abort();
      return true;
    },
  });
  const base = request();
  const r = await handler(new Request(base, { signal: controller.signal }));
  assert.equal(reserve, 1);
  assert.ok(r.status >= 400);
  assert.equal(calls.upstream, 0);
});
