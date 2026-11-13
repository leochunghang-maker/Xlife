import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Utensils, Camera, Sparkles, CalendarDays, Smile, NotebookPen, ChevronRight } from "lucide-react";
import { Button, SoftCard, SectionTitle } from "../components/ui.jsx";
import { todayISO, toLocalDate, toISODate } from "../lib/dates";
import { moodOptions, initialLog, getOnThisDayMemories, getAllMemorySnaps, readHistorySources, buildDailyLogSummary } from "../lib/dailyLog";
import { classNames } from "../lib/utils";
import { formatSleepDuration, shouldShowWakeConfirmation } from "../lib/sleep";
import { SleepHealthKitCard, WakeConfirmationSheet } from "./Sleep.jsx";

export 
function Dashboard({ log, setLog, totals, go }) {
  const mood = moodOptions.find((m) => m.id === log.mood) || moodOptions[2];
  const progress = log.calorie_goal ? Math.min(100, Math.round((totals.totalCalories / log.calorie_goal) * 100)) : 0;
  const [showWakeSheet, setShowWakeSheet] = useState(() => shouldShowWakeConfirmation(log.sleep || initialLog.sleep));
  const [selectedDate, setSelectedDate] = useState(todayISO);
  // History only needs re-reading when data that is archived/history-backed
  // changes, not on every Notes keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sources = useMemo(() => readHistorySources(), [log.date, log.meals, log.snaps, log.workout, log.sleep]);
  const selectedDaySummary = useMemo(() => buildDailyLogSummary(log, selectedDate, sources), [log, selectedDate, sources]);
  const onThisDay = useMemo(() => getOnThisDayMemories(getAllMemorySnaps(log)), [log]);
  // Real 7-day averages (days with logged meals only), not today's totals.
  const weekly = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = toLocalDate(todayISO);
      date.setDate(date.getDate() - index);
      return buildDailyLogSummary(log, toISODate(date), sources);
    }).filter((day) => day.meals.length > 0);
    const count = days.length || 1;
    const sum = (field) => Math.round(days.reduce((total, day) => total + day.totals[field], 0) / count);
    return { days: days.length, calories: sum("calories"), protein: sum("protein"), sugar: sum("sugar") };
  }, [log, sources]);

  useEffect(() => {
    localStorage.setItem("dayflow_last_active_at", new Date().toISOString());
  }, []);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <SummaryPill label="Sleep" value={formatSleepDuration((log.sleep || initialLog.sleep).duration_minutes)} />
          <SummaryPill label="Mood" value={mood.emoji} />
          <SummaryPill label="Kcal" value={`${totals.totalCalories}/${log.calorie_goal}`} />
        </div>

        <SleepHealthKitCard
          log={log}
          setLog={setLog}
          requestWakeConfirmation={() => setShowWakeSheet(true)}
        />

        <SoftCard>
          <SectionTitle icon={Utensils} title="Calories" action={<Button variant="ghost" size="sm" onClick={() => go('/meals')}>Meals <ChevronRight className="h-4 w-4" /></Button>} />
          <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-[hsl(24_80%_58%)]" style={{ width: `${progress}%` }} /></div>
          <p className="text-sm text-zinc-500 mt-2">{totals.totalCalories} kcal logged. {progress}% of daily goal.</p>
          <div className="mt-3 space-y-2">{log.meals.slice(-3).map((m, i) => <div key={m.id || i} className="flex justify-between text-sm"><span>{m.name}</span><span className="text-zinc-500">{m.calories} kcal</span></div>)}</div>
        </SoftCard>

        <SoftCard>
          <SectionTitle icon={CalendarDays} title="Weekly nutrition" />
          <p className="-mt-1 mb-3 text-xs text-zinc-500">
            {weekly.days ? `Daily average over ${weekly.days} logged day${weekly.days === 1 ? "" : "s"} in the last 7 days.` : "Log meals to see your 7-day averages."}
          </p>
          <NutritionBar label="Avg calories" value={weekly.calories} max={log.calorie_goal || 2200} unit="kcal" />
          <NutritionBar label="Avg protein" value={weekly.protein} max={150} unit="g" />
          <NutritionBar label="Avg sugar" value={weekly.sugar} max={80} unit="g" />
        </SoftCard>

        <SoftCard>
          <SectionTitle icon={Smile} title="Mood" />
          <div className="grid grid-cols-5 gap-2">{moodOptions.map(m => <button key={m.id} aria-label={m.label} aria-pressed={log.mood === m.id} onClick={() => setLog((current) => ({ ...current, mood: current.mood === m.id ? "" : m.id }))} className={classNames("rounded-2xl py-3 text-2xl", log.mood === m.id ? "bg-[hsl(24_80%_58%)]" : "bg-zinc-100 dark:bg-zinc-800")}>{m.emoji}</button>)}</div>
        </SoftCard>

        <SoftCard>
          <SectionTitle icon={NotebookPen} title="Notes" />
          <textarea value={log.notes || ""} placeholder="How was your day?" onChange={(e) => { const notes = e.target.value; setLog((current) => ({ ...current, notes })); }} className="w-full min-h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 px-4 py-3 outline-none" />
        </SoftCard>

        <SoftCard>
          <SectionTitle icon={Camera} title="Today's snaps" action={<Button variant="ghost" size="sm" onClick={() => go('/snaps')}>Open</Button>} />
          {log.snaps.length ? (
            <div className="grid grid-cols-3 gap-2">{log.snaps.map((s, i) => <img key={`${s.taken_at || i}-${i}`} src={s.url} decoding="async" className="aspect-square object-cover rounded-2xl" alt={s.caption || "Snap"} />)}</div>
          ) : (
            <p className="text-sm text-zinc-500">No snaps yet today. Open Snaps to capture one.</p>
          )}
        </SoftCard>

        {onThisDay.length > 0 && (
          <SoftCard>
            <SectionTitle icon={Sparkles} title="On this day" />
            <div className="space-y-3">
              {onThisDay.map((group) => (
                <div key={group.iso}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">{group.label} · {group.iso}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {group.snaps.slice(0, 3).map((snap, index) => (
                      <img key={`${snap.id || snap.taken_at || "m"}-${index}`} src={snap.url} loading="lazy" decoding="async" className="aspect-square rounded-2xl object-cover" alt={snap.caption || "Memory"} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SoftCard>
        )}

        <SoftCard>
          <SectionTitle icon={CalendarDays} title="Day calendar" />
          <DayCalendar selectedDate={selectedDate} setSelectedDate={setSelectedDate} log={log} sources={sources} />
          <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <p className="mb-3 text-lg font-black">Daily Log Summary</p>
            <DailyLogSummary summary={selectedDaySummary} />
          </div>
        </SoftCard>

        <Button disabled className="w-full rounded-2xl py-6 bg-[hsl(24_80%_58%)]/50 cursor-not-allowed" title="Not built yet">Export last 30 days PDF (coming soon)</Button>
      </motion.div>

      {showWakeSheet && (
        <WakeConfirmationSheet
          log={log}
          setLog={setLog}
          onClose={() => setShowWakeSheet(false)}
        />
      )}
    </>
  );
}
export 
function SummaryPill({ label, value }) {
  return <div className="bg-white dark:bg-zinc-900 rounded-[1.35rem] shadow-sm p-3"><p className="text-xs text-zinc-400">{label}</p><p className="font-bold text-lg truncate">{value}</p></div>;
}

function NutritionBar({ label, value, max, unit }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return <div className="mb-3"><div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="text-zinc-500">{value}{unit}</span></div><div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"><div className="h-full bg-[hsl(160_50%_45%)]" style={{ width: `${pct}%` }} /></div></div>;
}

function DayCalendar({ selectedDate, setSelectedDate, log, sources }) {
  const [visibleMonth, setVisibleMonth] = useState(() => toLocalDate(selectedDate));
  const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const firstDay = firstOfMonth.getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const calendarDays = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => toISODate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1))),
  ];

  function indicatorsFor(dateISO) {
    const summary = buildDailyLogSummary(log, dateISO, sources);
    return {
      meal: summary.meals.length > 0,
      workout: summary.workoutRecords.length > 0,
      period: Boolean(summary.cycle),
      spending: summary.spending.length > 0,
      snap: summary.snaps.length > 0,
    };
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-bold dark:bg-zinc-800">‹</button>
        <p className="font-bold">
          {visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <button onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-bold dark:bg-zinc-800">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-zinc-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-sm">
        {calendarDays.map((dateISO, index) => {
          if (!dateISO) return <div key={`empty-${index}`} />;
          const isSelected = selectedDate === dateISO;
          const isToday = todayISO === dateISO;
          const indicators = indicatorsFor(dateISO);

          return (
            <button
              key={dateISO}
              onClick={() => setSelectedDate(dateISO)}
              aria-label={toLocalDate(dateISO).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              aria-pressed={isSelected}
              className={classNames(
                "flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-bold transition",
                isSelected ? "bg-[hsl(24_80%_58%)] text-white" : "bg-zinc-100 dark:bg-zinc-800",
                !isSelected && isToday ? "ring-2 ring-[hsl(24_80%_58%)]/30" : ""
              )}
            >
              <span>{toLocalDate(dateISO).getDate()}</span>
              <span className="mt-1 flex h-1.5 gap-0.5">
                {indicators.meal && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(24_80%_58%)]" />}
                {indicators.workout && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(160_50%_45%)]" />}
                {indicators.period && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                {indicators.spending && <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />}
                {indicators.snap && <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DailyLogSummary({ summary }) {
  const mood = moodOptions.find((item) => item.id === summary.mood);
  const spendingTotal = summary.spending.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  if (!summary.hasData) {
    return (
      <div className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-5 text-center">
        <p className="font-bold">No logs for this day yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-zinc-500">{summary.date}</p>
      <div className="grid gap-3">
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Sleep</p>
          <p className="mt-1 text-sm text-zinc-500">Wake-up: {summary.wakeUp || "--"} · Quality: {summary.sleepQuality || "--"}</p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Meals</p>
          <p className="mt-1 text-sm text-zinc-500">{summary.totals.calories} kcal · {summary.totals.protein}g protein · {summary.totals.sugar}g sugar</p>
          <div className="mt-2 space-y-1">{summary.meals.map((meal, index) => <p key={`${meal.name}-${index}`} className="text-sm">{meal.name} <span className="text-zinc-500">· {meal.calories || 0} kcal</span></p>)}</div>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Workout</p>
          {summary.workoutRecords.length ? summary.workoutRecords.map((workout, index) => (
            <p key={index} className="mt-1 text-sm text-zinc-500">{workout.type || "Workout"} · {Object.keys(workout.exercises || {}).length} exercises</p>
          )) : <p className="mt-1 text-sm text-zinc-500">No workout logged.</p>}
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Mood / Notes</p>
          <p className="mt-1 text-sm text-zinc-500">{mood ? `${mood.emoji} ${mood.label}` : "No mood"} · {summary.notes || "No notes"}</p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Snaps</p>
          {summary.snaps.length ? <div className="mt-2 grid grid-cols-3 gap-2">{summary.snaps.map((snap, index) => <img key={`${snap.id || snap.taken_at || "snap"}-${index}`} src={snap.url} loading="lazy" decoding="async" className="aspect-square rounded-2xl object-cover" alt={snap.caption || "Snap"} />)}</div> : <p className="mt-1 text-sm text-zinc-500">No photos.</p>}
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Cycle</p>
          <p className="mt-1 text-sm capitalize text-zinc-500">{summary.cycle ? `${summary.cycle.phase || "cycle"} · ${summary.cycle.flow || "no flow"} · ${(summary.cycle.symptoms || []).join(", ") || "no symptoms"}` : "No cycle log."}</p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Spending</p>
          <p className="mt-1 text-sm text-zinc-500">${spendingTotal.toFixed(2)} total</p>
          <div className="mt-2 space-y-1">{summary.spending.map((item) => <p key={item.id} className="text-sm">{item.item_name} <span className="text-zinc-500">· ${Number(item.amount || 0).toFixed(2)}</span></p>)}</div>
        </div>
      </div>
    </div>
  );
}
