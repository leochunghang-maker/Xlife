import { useEffect, useState } from "react";
import { MessageCircleHeart } from "lucide-react";
import { Button } from "../components/ui.jsx";
import { questionForDay, readAnswers, saveAnswer } from "../lib/dailyQuestion";
import { todayISO } from "../lib/dates";
import { isSupabaseConfigured } from "../lib/supabase";
import { getCouple, getPartnerAnswer, saveDailyAnswerToCloud } from "../lib/cloud";

export function DailyQuestion() {
  const question = questionForDay(todayISO);
  const [mine, setMine] = useState(() => readAnswers()[todayISO]?.answer || "");
  const [draft, setDraft] = useState("");
  const [partner, setPartner] = useState({ couple: null, answer: null });

  useEffect(() => {
    if (!isSupabaseConfigured || !mine) return undefined;
    let active = true;
    (async () => {
      const couple = await getCouple().catch(() => null);
      const answer = couple ? await getPartnerAnswer(couple.partnerId, todayISO).catch(() => null) : null;
      if (active) setPartner({ couple, answer });
    })();
    return () => { active = false; };
  }, [mine]);

  async function submit() {
    const text = draft.trim();
    if (!text) return;
    saveAnswer(todayISO, question, text);
    setMine(text);
    setDraft("");
    await saveDailyAnswerToCloud(todayISO, question, text).catch(() => {});
  }

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800" data-testid="daily-question">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-rose-500"><MessageCircleHeart className="h-4 w-4" />Question of the day</p>
      <p className="mt-2 font-bold">{question}</p>
      {mine ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="rounded-2xl bg-zinc-100 p-3 dark:bg-zinc-800"><span className="font-bold">You:</span> {mine}</p>
          {partner.answer ? (
            <p className="rounded-2xl bg-rose-50 p-3 dark:bg-rose-500/10"><span className="font-bold">{partner.couple?.partnerName}:</span> {partner.answer.answer}</p>
          ) : (
            <p className="text-xs text-zinc-500">
              {partner.couple ? `${partner.couple.partnerName}'s answer appears here once they answer.` : "Pair with your partner in Settings → Xlife Cloud to see each other's answers."}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea className="field min-h-20" placeholder="Your answer (your partner sees it after they answer too)" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Your answer" />
          <Button onClick={submit} disabled={!draft.trim()} className="w-full rounded-2xl bg-rose-500 text-white">Answer</Button>
        </div>
      )}
    </div>
  );
}
