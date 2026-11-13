import { useMemo, useState } from "react";
import { Heart, Trash2 } from "lucide-react";
import { Button } from "../components/ui.jsx";
import { readCouple, saveCouple, newCountdown, daysTogether, nextAnniversary, upcomingCountdowns } from "../lib/couple";

// Anniversary counter + countdowns (Between / Dote style). Local only; synced
// with the partner when cloud pairing is configured.
export function Together({ plans = [] }) {
  const [couple, setCouple] = useState(readCouple);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [editing, setEditing] = useState(false);
  const together = daysTogether(couple.anniversary);
  const anniversary = nextAnniversary(couple.anniversary);
  const countdowns = useMemo(() => upcomingCountdowns(couple, plans), [couple, plans]);

  function update(next) {
    setCouple(next);
    saveCouple(next);
  }

  function addCountdown() {
    if (!title.trim() || !date) return;
    update({ ...couple, countdowns: [...couple.countdowns, newCountdown(title, date)] });
    setTitle("");
    setDate("");
  }

  return (
    <div className="mb-4 rounded-3xl bg-gradient-to-br from-rose-50 to-orange-50 p-4 dark:from-zinc-800 dark:to-zinc-900" data-testid="together-card">
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-rose-500" />
        <p className="flex-1 font-black">Together</p>
        <button className="text-xs font-bold text-zinc-500" onClick={() => setEditing((v) => !v)}>{editing ? "Done" : "Edit"}</button>
      </div>
      {together ? (
        <p className="mt-2 text-3xl font-black">{together.toLocaleString()} days</p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">Add the day you got together to start the counter.</p>
      )}
      {anniversary && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {anniversary.inDays === 0 ? `🎉 Happy ${anniversary.years}-year anniversary!` : `${anniversary.years}-year anniversary in ${anniversary.inDays} day${anniversary.inDays === 1 ? "" : "s"}`}
        </p>
      )}
      {editing && (
        <label className="mt-3 block text-sm font-semibold text-zinc-500">
          Together since
          <input type="date" className="field mt-1" value={couple.anniversary} onChange={(e) => update({ ...couple, anniversary: e.target.value })} aria-label="Together since" />
        </label>
      )}
      {countdowns.length > 0 && (
        <div className="mt-3 space-y-2">
          {countdowns.slice(0, editing ? 20 : 3).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white/80 px-3 py-2 text-sm dark:bg-zinc-900/60">
              <span className="font-semibold">{item.kind === "plan" ? "📅 " : "⏳ "}{item.title}</span>
              <span className="text-zinc-500">{item.inDays === 0 ? "today" : `${item.inDays}d`}</span>
              {editing && item.kind === "custom" && (
                <button aria-label={`Remove ${item.title}`} onClick={() => update({ ...couple, countdowns: couple.countdowns.filter((c) => c.id !== item.id) })}><Trash2 className="h-4 w-4 text-zinc-400" /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {editing && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <input className="field" placeholder="Countdown (e.g. Trip to Tokyo)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Countdown date" />
          <Button onClick={addCountdown} className="col-span-2 rounded-2xl bg-rose-500 text-white">Add countdown</Button>
        </div>
      )}
    </div>
  );
}
