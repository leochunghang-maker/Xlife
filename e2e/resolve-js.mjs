import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.(js|jsx|json|mjs|cjs|ts)(\?|$)/.test(specifier)) {
    const parent = fileURLToPath(context.parentURL);
    for (const ext of [".js", ".jsx"]) {
      const candidate = join(dirname(parent), specifier + ext);
      if (existsSync(candidate)) {
        return { shortCircuit: true, url: pathToFileURL(candidate).href, format: "module" };
      }
    }
  }
  return nextResolve(specifier, context);
}
