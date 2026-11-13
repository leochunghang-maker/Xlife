import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { HeartPulse, Plus, CalendarDays, Smile, Star } from "lucide-react";
import { readLocalJSON, writeLocalJSON, createId } from "../lib/storage";
import { Button, SoftCard, SectionTitle } from "../components/ui.jsx";
import { todayISO, toLocalDate, toISODate } from "../lib/dates";
import { moodOptions } from "../lib/dailyLog";
import { classNames } from "../lib/utils";
import { getCyclePhase, toggleListValue, formatCycleDateTitle } from "../lib/cycle";
import { predictCycle, isInRange } from "../lib/cyclePredict";
import { CycleInsights } from "./CycleInsights.jsx";


const phaseStyles = {
  period: "bg-rose-500 text-white",
  follicular: "bg-[hsl(160_50%_45%)] text-white",
  ovulation: "bg-[hsl(24_80%_58%)] text-white",
  luteal: "bg-amber-300 text-zinc-900",
};

const phaseDotStyles = {
  period: "bg-rose-500",
  follicular: "bg-[hsl(160_50%_45%)]",
  ovulation: "bg-[hsl(24_80%_58%)]",
  luteal: "bg-amber-300",
};

const phaseSoftStyles = {
  period: "bg-rose-50 dark:bg-rose-950/30",
  follicular: "bg-emerald-50 dark:bg-emerald-950/30",
  ovulation: "bg-orange-50 dark:bg-orange-950/30",
  luteal: "bg-amber-50 dark:bg-amber-950/30",
};

const symptomOptions = ["cramps", "bloating", "headache", "back pain", "acne", "fatigue", "cravings"];
const factorOptions = ["travel", "stress", "illness", "sleep change", "medication", "exercise"];
const intimacyButtonLabels = [
  "Special Time Together 💕",
  "Late Night Cardio 😏",
  "Love Meter Activated ❤️",
  "Couple Time ✨",
  "Bedroom Olympics 🏅",
  "Cuddles Escalated 🔥",
  "Romance Logged 💋",
  "Private Event Recorded 🤭",
];

function blankCycleLog() {
  return {
    flow: "none",
    moods: [],
    symptoms: [],
    spotting: false,
    factors: [],
    notes: "",
  };
}
export function Health({ log }) {
  const [activeTab, setActiveTab] = useState("cycle");

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="grid grid-cols-2 rounded-3xl bg-white p-1 shadow-sm dark:bg-zinc-900">
        {[
          { id: "cycle", label: "Cycle" },
          { id: "wellness", label: "Wellness" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={classNames(
              "rounded-3xl py-3 text-sm font-bold transition",
              activeTab === tab.id
                ? "bg-[hsl(24_80%_58%)] text-white"
                : "text-zinc-500"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "cycle" ? <CycleTracker /> : <WellnessInsights log={log} />}
    </motion.div>
  );
}

function CycleTracker() {
  const [hasSavedCycleStart] = useState(() => Boolean(localStorage.getItem("dayflow_cycle_start")));
  const [cycleStart, setCycleStart] = useState(() => localStorage.getItem("dayflow_cycle_start") || todayISO);
  const [periodLogs, setPeriodLogs] = useState(() => readLocalJSON("dayflow_period_logs", {}));
  const [intimacyLogs, setIntimacyLogs] = useState(() => readLocalJSON("dayflow_intimacy_logs", []));
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = toLocalDate(todayISO);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [dailyLog, setDailyLog] = useState(() => ({ ...blankCycleLog(), ...(periodLogs[todayISO] || {}) }));
  const [expandedRows, setExpandedRows] = useState({});
  const [savedMessage, setSavedMessage] = useState("");

  // Estimates learned from the user's own logged periods (falls back to the
  // saved cycle start + 28-day model until there is history).
  const prediction = useMemo(() => predictCycle(periodLogs), [periodLogs]);
  const phaseStart = prediction.lastStart && prediction.lastStart > cycleStart ? prediction.lastStart : cycleStart;
  const phaseFor = (dateISO) => getCyclePhase(phaseStart, dateISO, prediction.avgCycle, prediction.avgPeriod);

  const selectedPhase = useMemo(() => {
    const calculated = getCyclePhase(phaseStart, selectedDate, prediction.avgCycle, prediction.avgPeriod);
    const savedPhase = periodLogs[selectedDate]?.phase || dailyLog.phase;
    return savedPhase ? { phase: savedPhase, day: periodLogs[selectedDate]?.cycleDay || calculated.day } : calculated;
  }, [phaseStart, prediction.avgCycle, prediction.avgPeriod, dailyLog.phase, periodLogs, selectedDate]);
  const selectedDateTitle = formatCycleDateTitle(selectedDate);
  const isMarkedPeriod = dailyLog.flow !== "none" && dailyLog.phase === "period";
  const isIntimacyLogged = intimacyLogs.some((log) => log.date === selectedDate);

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => toISODate(new Date(year, month, index + 1))),
    ];
  }, [visibleMonth]);

  function selectDate(dateISO) {
    setSelectedDate(dateISO);
    setDailyLog({ ...blankCycleLog(), ...(periodLogs[dateISO] || {}) });
    setSavedMessage("");
  }

  function saveLog() {
    const phaseData = phaseFor(selectedDate);
    const phase = dailyLog.phase || phaseData.phase;
    const nextLogs = {
      ...periodLogs,
      [selectedDate]: {
        ...dailyLog,
        date: selectedDate,
        phase,
        flow: dailyLog.flow,
        moods: dailyLog.moods,
        symptoms: dailyLog.symptoms,
        spotting: dailyLog.spotting,
        factors: dailyLog.factors,
        notes: dailyLog.notes,
        cycle_start: cycleStart,
        cycleDay: phaseData.day,
      },
    };

    localStorage.setItem("dayflow_cycle_start", cycleStart);
    writeLocalJSON("dayflow_period_logs", nextLogs);
    setPeriodLogs(nextLogs);
    setSavedMessage(`Saved ${selectedDate}`);
  }

  function savePeriodLog(nextLog) {
    const phaseData = phaseFor(selectedDate);
    const logForDate = {
      ...blankCycleLog(),
      ...nextLog,
      date: selectedDate,
      phase: "period",
      flow: "medium",
      cycle_start: cycleStart,
      cycleDay: phaseData.day,
    };
    const nextLogs = {
      ...periodLogs,
      [selectedDate]: logForDate,
    };

    localStorage.setItem("dayflow_cycle_start", cycleStart);
    writeLocalJSON("dayflow_period_logs", nextLogs);
    setDailyLog(logForDate);
    setPeriodLogs(nextLogs);
    setSavedMessage(`Marked ${selectedDate} as a period day`);
  }

  function markAsPeriod() {
    if (isMarkedPeriod) {
      // Previously there was no way to undo "Mark as Period".
      const unmarked = { ...dailyLog, flow: "none", phase: undefined };
      const hasOtherData = unmarked.symptoms?.length || unmarked.factors?.length || unmarked.spotting || unmarked.notes || unmarked.moods?.length;
      const nextLogs = { ...periodLogs };
      if (hasOtherData) {
        nextLogs[selectedDate] = { ...unmarked, date: selectedDate };
        delete nextLogs[selectedDate].phase;
      } else {
        delete nextLogs[selectedDate];
      }
      writeLocalJSON("dayflow_period_logs", nextLogs);
      setPeriodLogs(nextLogs);
      setDailyLog({ ...blankCycleLog(), ...(nextLogs[selectedDate] || {}) });
      setSavedMessage(`Removed period mark for ${selectedDate}`);
      return;
    }
    savePeriodLog({ ...dailyLog, flow: "medium", phase: "period" });
  }

  function toggleIntimacyLog() {
    const nextLogs = isIntimacyLogged
      ? intimacyLogs.filter((log) => log.date !== selectedDate)
      : [
          ...intimacyLogs,
          {
            id: createId(),
            date: selectedDate,
            loggedAt: new Date().toISOString(),
            type: "intimacy",
          },
        ];

    writeLocalJSON("dayflow_intimacy_logs", nextLogs);
    setIntimacyLogs(nextLogs);
  }

  function toggleExpandedRow(row) {
    setExpandedRows({ ...expandedRows, [row]: !expandedRows[row] });
  }

  function moveMonth(direction) {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + direction, 1));
  }

  return (
    <div className="space-y-4">
      <SoftCard>
        <div className="mb-5">
          <p className="text-3xl font-black tracking-tight">{selectedDateTitle}</p>
          <p className="mt-1 text-sm font-semibold capitalize text-zinc-500">
            Cycle Day {selectedPhase.day} · {selectedPhase.phase}{periodLogs[selectedDate]?.phase === "period" ? "" : " (estimate)"}
          </p>
          {!hasSavedCycleStart && (
            <p className="mt-2 rounded-2xl bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-800">
              Mark your period days (or set your cycle start below) for estimates. Until then this uses a simple 28-day model — not a medical prediction.
            </p>
          )}
        </div>

        <button
          onClick={markAsPeriod}
          aria-pressed={isMarkedPeriod}
          className={classNames(
            "mb-3 w-full rounded-full px-5 py-4 text-base font-bold shadow-sm transition",
            isMarkedPeriod
              ? "bg-[hsl(24_80%_58%)] text-white"
              : "bg-[hsl(24_80%_58%)]/10 text-[hsl(24_80%_58%)]"
          )}
        >
          {isMarkedPeriod ? "Marked as Period ✓" : "Mark as Period"}
        </button>

        <button
          onClick={toggleIntimacyLog}
          className={classNames(
            "mb-4 w-full rounded-full px-5 py-4 text-base font-bold shadow-sm transition",
            isIntimacyLogged
              ? "bg-gradient-to-r from-fuchsia-500 to-rose-400 text-white"
              : "bg-gradient-to-r from-fuchsia-100 to-rose-100 text-fuchsia-700 dark:from-fuchsia-950/50 dark:to-rose-950/50 dark:text-fuchsia-200"
          )}
        >
          {isIntimacyLogged ? "Special Time Logged ✓" : intimacyButtonLabels[0]}
        </button>
        {isIntimacyLogged && (
          <p className="-mt-2 mb-4 text-center text-xs font-semibold text-fuchsia-500">
            A memorable moment together ✨
          </p>
        )}

        <div className="divide-y divide-zinc-100 overflow-hidden rounded-3xl border border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
          <CycleLogRow
            label="Symptoms"
            value={dailyLog.symptoms.length ? dailyLog.symptoms.join(", ") : "None added"}
            accent="text-purple-500"
            onAdd={() => toggleExpandedRow("symptoms")}
          />
          {expandedRows.symptoms && (
            <div className="flex flex-wrap gap-2 bg-zinc-50 p-3 dark:bg-zinc-800/60">
              {symptomOptions.map((symptom) => (
                <button
                  key={symptom}
                  onClick={() => setDailyLog({ ...dailyLog, symptoms: toggleListValue(dailyLog.symptoms, symptom) })}
                  className={classNames(
                    "rounded-full px-3 py-2 text-sm font-semibold capitalize",
                    dailyLog.symptoms.includes(symptom)
                      ? "bg-purple-500 text-white"
                      : "bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                  )}
                >
                  {symptom}
                </button>
              ))}
            </div>
          )}

          <CycleLogRow
            label="Spotting"
            value={dailyLog.spotting ? "Spotting logged" : "No data"}
            accent="text-purple-500"
            onAdd={() => setDailyLog({ ...dailyLog, spotting: !dailyLog.spotting })}
            marked={dailyLog.spotting}
          />

          <CycleLogRow
            label="Factors"
            value={dailyLog.factors.length ? dailyLog.factors.join(", ") : "None added"}
            accent="text-purple-500"
            onAdd={() => toggleExpandedRow("factors")}
          />
          {expandedRows.factors && (
            <div className="flex flex-wrap gap-2 bg-zinc-50 p-3 dark:bg-zinc-800/60">
              {factorOptions.map((factor) => (
                <button
                  key={factor}
                  onClick={() => setDailyLog({ ...dailyLog, factors: toggleListValue(dailyLog.factors, factor) })}
                  className={classNames(
                    "rounded-full px-3 py-2 text-sm font-semibold capitalize",
                    dailyLog.factors.includes(factor)
                      ? "bg-purple-500 text-white"
                      : "bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                  )}
                >
                  {factor}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button onClick={saveLog} className="mt-4 w-full rounded-full bg-purple-500 py-3 text-white">
          Save details
        </Button>
        {savedMessage && <p className="mt-3 rounded-2xl bg-[hsl(160_50%_45%)]/10 p-3 text-sm text-zinc-600">{savedMessage}</p>}
      </SoftCard>

      <CycleInsights prediction={prediction} periodLogs={periodLogs} />

      <SoftCard>
        <SectionTitle icon={CalendarDays} title="Cycle calendar" />
        <p className="mb-4 text-sm font-semibold text-zinc-500">
          Forgot to log a previous day? Select a date below.
        </p>

        <div className="mb-4">
          <label className="text-sm font-semibold">
            <span className="mb-1 block text-zinc-500">Cycle start</span>
            <input
              type="date"
              value={cycleStart}
              onChange={(e) => setCycleStart(e.target.value)}
              className="w-full rounded-2xl bg-zinc-100 px-3 py-3 outline-none dark:bg-zinc-800"
            />
          </label>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => moveMonth(-1)} className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-bold dark:bg-zinc-800">‹</button>
          <p className="font-bold">
            {visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <button onClick={() => moveMonth(1)} className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-bold dark:bg-zinc-800">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-zinc-400">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {calendarDays.map((dateISO, index) => {
            if (!dateISO) return <div key={`empty-${index}`} />;
            const { phase: calculatedPhase } = phaseFor(dateISO);
            const isFertile = isInRange(dateISO, prediction.fertileStart, prediction.fertileEnd);
            const isPredictedPeriod = isInRange(dateISO, prediction.nextStart, prediction.nextEnd);
            const phase = periodLogs[dateISO]?.phase || calculatedPhase;
            const isSelected = selectedDate === dateISO;
            const isToday = todayISO === dateISO;
            const hasLog = Boolean(periodLogs[dateISO]);

            return (
              <button
                key={dateISO}
                onClick={() => selectDate(dateISO)}
                className={classNames(
                  "relative aspect-square rounded-2xl bg-zinc-50 text-xs font-bold transition dark:bg-zinc-800",
                  isSelected ? "bg-[hsl(24_80%_58%)] text-white shadow-sm" : `${phaseSoftStyles[phase]} text-zinc-700 dark:text-zinc-200`,
                  !isSelected && isToday ? "ring-2 ring-[hsl(24_80%_58%)]/30" : "",
                  !isSelected && hasLog ? "border border-[hsl(160_50%_45%)]/40" : "",
                  !isSelected && !hasLog && isPredictedPeriod ? "border border-dashed border-rose-400" : "",
                  !isSelected && !hasLog && isFertile ? "border border-dashed border-teal-500" : ""
                )}
                aria-label={`${dateISO}${hasLog ? ", logged" : ""}${isPredictedPeriod ? ", estimated period" : ""}${isFertile ? ", estimated fertile window" : ""}`}
              >
                {toLocalDate(dateISO).getDate()}
                <span
                  className={classNames(
                    "absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full",
                    isSelected ? "bg-white" : phaseDotStyles[phase]
                  )}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.keys(phaseDotStyles).map((phase) => (
            <div key={phase} className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold capitalize text-zinc-500 dark:bg-zinc-800">
              <span className={classNames("h-2 w-2 rounded-full", phaseDotStyles[phase])} />
              {phase}
            </div>
          ))}
        </div>
      </SoftCard>
    </div>
  );
}

function CycleLogRow({ label, value, accent, onAdd, marked = false }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white p-4 dark:bg-zinc-900">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-sm capitalize text-zinc-500">{value}</p>
      </div>
      <button
        onClick={onAdd}
        aria-label={marked ? `${label}: logged` : `Add ${label.toLowerCase()}`}
        className={classNames(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 transition dark:bg-zinc-800",
          marked ? "bg-purple-500 text-white" : accent
        )}
      >
        {marked ? "✓" : <Plus className="h-5 w-5" />}
      </button>
    </div>
  );
}

function WellnessInsights({ log }) {
  const insights = useMemo(() => {
    const savedLogs = Object.values(readLocalJSON("dayflow_period_logs", {}));
    const currentMood = moodOptions.find((mood) => mood.id === log.mood) || moodOptions[2];
    const cyclePrediction = predictCycle(readLocalJSON("dayflow_period_logs", {}));
    const savedStart = localStorage.getItem("dayflow_cycle_start") || todayISO;
    const start = cyclePrediction.lastStart && cyclePrediction.lastStart > savedStart ? cyclePrediction.lastStart : savedStart;
    const currentPhase = getCyclePhase(start, todayISO, cyclePrediction.avgCycle, cyclePrediction.avgPeriod);
    const dailyLog = {
      date: todayISO,
      phase: currentPhase.phase,
      moods: [currentMood.id],
      symptoms: [],
      notes: log.notes,
    };
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    // Earlier builds mixed 48 generated sample logs into these stats, so the
    // insights did not reflect the user's real data. Only real logs are used now.
    const logs = [...savedLogs, ...(log.mood ? [dailyLog] : [])].filter((item) => item.date && toLocalDate(item.date) >= sixMonthsAgo);
    const phases = ["period", "follicular", "ovulation", "luteal"];
    const moodLookup = Object.fromEntries(moodOptions.map((mood) => [mood.id, mood.score]));

    const phaseStats = phases.map((phase) => {
      const phaseLogs = logs.filter((item) => item.phase === phase);
      const moodScores = phaseLogs.flatMap((item) => item.moods || []).map((mood) => moodLookup[mood]).filter(Boolean);
      const symptomCounts = {};
      phaseLogs.flatMap((item) => item.symptoms || []).forEach((symptom) => {
        symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
      });

      return {
        phase,
        averageMood: moodScores.length ? moodScores.reduce((sum, score) => sum + score, 0) / moodScores.length : 0,
        count: phaseLogs.length,
        symptomCounts,
      };
    });

    const topSymptoms = {};
    logs.flatMap((item) => item.symptoms || []).forEach((symptom) => {
      topSymptoms[symptom] = (topSymptoms[symptom] || 0) + 1;
    });

    return {
      phaseStats,
      totalLogs: logs.length,
      topSymptoms: Object.entries(topSymptoms).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [log]);

  if (insights.totalLogs === 0) {
    return (
      <SoftCard>
        <SectionTitle icon={Smile} title="Wellness insights" />
        <p className="text-sm text-zinc-500">
          No cycle or mood logs yet. Log a few days in Cycle (and your mood on Home) and your trends will show here.
        </p>
      </SoftCard>
    );
  }

  return (
    <div className="space-y-4">
      <SoftCard>
        <SectionTitle icon={Smile} title="Mood by phase" />
        <div className="space-y-3">
          {insights.phaseStats.map((stat) => (
            <div key={stat.phase}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold capitalize">{stat.phase}</span>
                <span className="text-zinc-500">{stat.averageMood.toFixed(1)} / 5</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full bg-[hsl(160_50%_45%)]" style={{ width: `${(stat.averageMood / 5) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </SoftCard>

      <div className="grid grid-cols-2 gap-3">
        {insights.phaseStats.map((stat) => (
          <div key={stat.phase} className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">{stat.phase}</p>
            <p className="mt-2 text-2xl font-bold">{stat.averageMood.toFixed(1)}</p>
            <p className="text-xs text-zinc-500">avg mood from {stat.count} logs</p>
          </div>
        ))}
      </div>

      <SoftCard>
        <SectionTitle icon={HeartPulse} title="Symptom distribution" />
        <div className="grid grid-cols-2 gap-3">
          {insights.phaseStats.map((stat) => {
            const total = Object.values(stat.symptomCounts).reduce((sum, count) => sum + count, 0);
            return (
              <div key={stat.phase} className="rounded-3xl bg-zinc-100 p-4 dark:bg-zinc-800">
                <div className={classNames("mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full", phaseStyles[stat.phase])}>
                  <span className="text-xl font-bold">{total}</span>
                </div>
                <p className="text-center text-sm font-bold capitalize">{stat.phase}</p>
              </div>
            );
          })}
        </div>
      </SoftCard>

      <SoftCard>
        <SectionTitle icon={Star} title="Top symptoms" />
        <div className="space-y-2">
          {insights.topSymptoms.map(([symptom, count]) => (
            <div key={symptom} className="flex items-center justify-between rounded-2xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
              <span className="font-semibold capitalize">{symptom}</span>
              <span className="rounded-2xl bg-[hsl(24_80%_58%)]/10 px-3 py-1 font-bold text-[hsl(24_80%_58%)]">{count}</span>
            </div>
          ))}
        </div>
      </SoftCard>
    </div>
  );
}
