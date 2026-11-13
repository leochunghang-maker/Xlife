import { useMemo, useState } from "react";
import { NotebookPen, Shuffle } from "lucide-react";
import { SoftCard, SectionTitle } from "../components/ui.jsx";
import { promptForDay, notesOnThisDay } from "../lib/journal";
import { todayISO } from "../lib/dates";

// Daily notes with a reflection prompt and "on this day" notes (Day One style).
// Notes stay in today's log (log.notes) exactly as before.
export function Journal({ log, setLog, onOpenReminders }) {
  const [offset, setOffset] = useState(0);
  const prompt = promptForDay(todayISO, offset);
  const pastNotes = useMemo(() => notesOnThisDay(), []);

  function insertPrompt() {
    setLog((current) => {
      const existing = current.notes || "";
      if (existing.includes(prompt)) return current;
      return { ...current, notes: `${existing}${existing.trim() ? "\n\n" : ""}${prompt}\n` };
    });
  }

  return (
    <SoftCard>
      <SectionTitle icon={NotebookPen} title="Journal" action={onOpenReminders && <button className="text-xs font-bold text-zinc-400" onClick={onOpenReminders}>Reminder</button>} />
      <div className="mb-2 flex items-center gap-2 rounded-2xl bg-[hsl(24_80%_58%)]/10 p-3">
        <button onClick={insertPrompt} className="flex-1 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-200" aria-label={`Use prompt: ${prompt}`}>
          💭 {prompt}
        </button>
        <button onClick={() => setOffset((value) => value + 1)} aria-label="Another prompt" className="rounded-full p-2 text-zinc-500"><Shuffle className="h-4 w-4" /></button>
      </div>
      <textarea
        value={log.notes || ""}
        placeholder="How was your day?"
        aria-label="Journal notes"
        onChange={(e) => { const notes = e.target.value; setLog((current) => ({ ...current, notes })); }}
        className="w-full min-h-28 rounded-2xl bg-zinc-100 px-4 py-3 outline-none dark:bg-zinc-800"
      />
      {pastNotes.length > 0 && (
        <div className="mt-3 space-y-2">
          {pastNotes.map((item) => (
            <div key={item.iso} className="rounded-2xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/60">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">{item.label} · {item.iso}</p>
              <p className="mt-1 line-clamp-3 whitespace-pre-line text-zinc-600 dark:text-zinc-300">{item.notes}</p>
            </div>
          ))}
        </div>
      )}
    </SoftCard>
  );
}
