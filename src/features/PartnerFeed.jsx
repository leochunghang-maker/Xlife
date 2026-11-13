import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "../lib/supabase";
import { getCouple, getPartnerFeed, partnerPhotoUrl } from "../lib/cloud";

function PartnerPhoto({ partnerId, refValue, alt }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    partnerPhotoUrl(partnerId, refValue).then((value) => { if (active) setUrl(value); });
    return () => { active = false; };
  }, [partnerId, refValue]);
  return url ? <img src={url} alt={alt} className="mt-2 h-40 w-full rounded-2xl object-cover" /> : null;
}

function describe(item) {
  const data = item.data || {};
  if (item.type === "memory") return data.caption ? `Shared a memory: ${data.caption}` : "Shared a memory";
  if (item.type === "plan") return `Plan: ${data.title || "Untitled"}${data.date ? ` (${data.date})` : ""}`;
  if (item.type === "meal") return `Ate ${data.name || "a meal"}${data.type ? ` for ${data.type}` : ""}`;
  if (item.type === "workout") return `Finished a ${data.type || ""} workout`.replace("  ", " ");
  return "Update";
}

// Real updates from a paired partner via Xlife Cloud. Only categories the
// partner chose to share are returned (enforced by Row Level Security).
export function PartnerFeed() {
  const [state, setState] = useState({ loading: isSupabaseConfigured, couple: null, items: [] });

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    (async () => {
      const couple = await getCouple().catch(() => null);
      const items = couple ? await getPartnerFeed(couple.partnerId).catch(() => []) : [];
      if (active) setState({ loading: false, couple, items });
    })();
    return () => { active = false; };
  }, []);

  if (!isSupabaseConfigured || state.loading || !state.couple) return null;
  return (
    <div className="space-y-3" data-testid="partner-feed">
      <p className="font-bold">{state.couple.partnerName}&apos;s shared updates</p>
      {state.items.length === 0 && <p className="text-sm text-zinc-500">Nothing shared yet. They choose what to share in Settings.</p>}
      {state.items.map((item) => (
        <div key={`${item.type}-${item.id}`} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[hsl(160_50%_45%)]">{item.type} · {item.date || ""}</p>
          <p className="mt-1 font-semibold text-zinc-700 dark:text-zinc-200">{describe(item)}</p>
          {item.type === "memory" && item.data?.url && <PartnerPhoto partnerId={state.couple.partnerId} refValue={item.data.url} alt={item.data.caption || "Partner memory"} />}
        </div>
      ))}
    </div>
  );
}
