import { useEffect, useMemo, useState } from "react";
import { Bell, FileText, X } from "lucide-react";
import { Button, SoftCard } from "../components/ui.jsx";
import { buildCycleReport } from "../lib/cyclePredict";
import { exportTextFile } from "../lib/exportFile";
import { readReminders, saveReminders, ensurePermission, notificationsSupported, applyPeriodReminder } from "../lib/notifications";
import { toLocalDate } from "../lib/dates";

function formatDay(iso) {
  return iso ? toLocalDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "--";
}

export function CycleInsights({ prediction, periodLogs }) {
  const [reminderOn, setReminderOn] = useState(() => readReminders().period.enabled);
  const [message, setMessage] = useState("");
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    applyPeriodReminder({ enabled: reminderOn, nextStartISO: prediction.nextStart }).catch(() => {});
  }, [reminderOn, prediction.nextStart]);

  async function toggleReminder() {
    const next = !reminderOn;
    if (next && !(await ensurePermission())) {
      setMessage("Allow notifications for Xlife in iPhone Settings to get cycle reminders.");
      return;
    }
    saveReminders({ ...readReminders(), period: { enabled: next } });
    setReminderOn(next);
    setMessage(next ? "You'll get a reminder 2 days before the estimated start." : "Cycle reminders are off.");
  }

  return (
    <SoftCard>
      <p className="text-lg font-black">Cycle estimates</p>
      {!prediction.hasData ? (
        <p className="mt-2 text-sm text-zinc-500">Mark your period days to get estimates learned from your own history.</p>
      ) : (
        <div className="mt-3 space-y-3" data-testid="cycle-estimates">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-3xl bg-rose-50 p-3 dark:bg-rose-500/10">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-500">Next period (est.)</p>
              <p className="mt-1 text-xl font-black">{formatDay(prediction.nextStart)}</p>
              <p className="text-xs text-zinc-500">
                {prediction.lateBy ? `${prediction.lateBy} day${prediction.lateBy === 1 ? "" : "s"} later than estimated` : prediction.daysUntilNext >= 0 ? `in ${prediction.daysUntilNext} day${prediction.daysUntilNext === 1 ? "" : "s"}` : ""}
              </p>
            </div>
            <div className="rounded-3xl bg-teal-50 p-3 dark:bg-teal-500/10">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-600">Fertile window (est.)</p>
              <p className="mt-1 text-xl font-black">{formatDay(prediction.fertileStart)}–{formatDay(prediction.fertileEnd)}</p>
              <p className="text-xs text-zinc-500">Ovulation ~{formatDay(prediction.ovulation)}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Average cycle {prediction.avgCycle} days · period {prediction.avgPeriod} days ·{" "}
            {prediction.usingDefaults ? "using the typical 28-day default until you log a second period" : `based on your last ${prediction.cycles} logged cycle${prediction.cycles === 1 ? "" : "s"} (${prediction.confidence} confidence)`}.
          </p>
          {prediction.irregular && (
            <p className="rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              Your recent cycles vary by {prediction.variation} days, so estimates are less reliable. If this is new for you, consider mentioning it to a doctor.
            </p>
          )}
          <p className="text-[11px] text-zinc-400">Estimates only. Not medical advice and not a method of contraception.</p>
        </div>
      )}
      <div className="mt-3 grid gap-2">
        {notificationsSupported() && prediction.hasData && (
          <Button variant="secondary" onClick={toggleReminder} aria-pressed={reminderOn} className="w-full rounded-2xl py-3">
            <Bell className="mr-2 h-4 w-4" />{reminderOn ? "Cycle reminders: on" : "Remind me before my period"}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setShowReport(true)} className="w-full rounded-2xl py-3">
          <FileText className="mr-2 h-4 w-4" />Cycle report for my doctor
        </Button>
        {message && <p className="text-sm text-zinc-500" role="status">{message}</p>}
      </div>
      {showReport && <CycleReport periodLogs={periodLogs} onClose={() => setShowReport(false)} />}
    </SoftCard>
  );
}

function reportHtml(report, name) {
  const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const p = report.prediction;
  const rows = report.rows.map((row) => `<tr><td>${esc(row.start)}</td><td>${esc(row.end)}</td><td>${row.periodLength}</td><td>${row.cycleLength ?? "—"}</td></tr>`).join("");
  const symptoms = Object.entries(report.symptomCounts).sort((a, b) => b[1] - a[1]).map(([s, n]) => `<li>${esc(s)}: ${n} day${n === 1 ? "" : "s"}</li>`).join("") || "<li>None logged</li>";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cycle report</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;margin:24px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left;font-size:14px}h1{font-size:22px}small{color:#666}</style></head><body>
<h1>Cycle report${name ? ` — ${esc(name)}` : ""}</h1>
<p><small>${esc(report.since)} to ${esc(report.today)} · generated by Xlife from self-logged data</small></p>
<p>Average cycle length: <b>${p.hasData ? `${p.avgCycle} days` : "—"}</b> · Average period length: <b>${p.hasData ? `${p.avgPeriod} days` : "—"}</b> · Cycles used: ${p.cycles || 0}${p.variation ? ` · Variation: ${p.variation} days` : ""}</p>
${p.hasData ? `<p>Last period started ${esc(p.lastStart)}. Next period estimated ${esc(p.nextStart)} (estimate).</p>` : ""}
<table><thead><tr><th>Period start</th><th>Period end</th><th>Period days</th><th>Cycle length</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No periods logged in the last 12 months</td></tr>'}</tbody></table>
<h2 style="font-size:16px">Symptoms logged</h2><ul>${symptoms}</ul>
<p><small>Self-reported data. Estimates are not a diagnosis.</small></p></body></html>`;
}

function CycleReport({ periodLogs, onClose }) {
  const report = useMemo(() => buildCycleReport(periodLogs), [periodLogs]);
  const name = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("dayflow_user") || "{}").name || "";
    } catch {
      return "";
    }
  }, []);
  const p = report.prediction;

  async function share() {
    await exportTextFile(`xlife-cycle-report-${report.today}.html`, reportHtml(report, name), "text/html");
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-white p-5 text-zinc-900 print:static" role="dialog" aria-label="Cycle report">
      <div className="mx-auto max-w-2xl space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
        <div className="flex items-start justify-between gap-3 print:hidden">
          <p className="text-2xl font-black">Cycle report</p>
          <button onClick={onClose} aria-label="Close report" className="rounded-full bg-zinc-100 p-2"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-zinc-500">{report.since} to {report.today}{name ? ` · ${name}` : ""} · self-logged in Xlife</p>
        <p className="text-sm">
          Average cycle: <b>{p.hasData ? `${p.avgCycle} days` : "—"}</b> · Average period: <b>{p.hasData ? `${p.avgPeriod} days` : "—"}</b> · Cycles used: {p.cycles || 0}
        </p>
        <table className="w-full border-collapse text-sm">
          <thead><tr>{["Period start", "End", "Days", "Cycle length"].map((h) => <th key={h} className="border border-zinc-300 p-2 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {report.rows.length ? report.rows.map((row) => (
              <tr key={row.start}><td className="border border-zinc-300 p-2">{row.start}</td><td className="border border-zinc-300 p-2">{row.end}</td><td className="border border-zinc-300 p-2">{row.periodLength}</td><td className="border border-zinc-300 p-2">{row.cycleLength ?? "—"}</td></tr>
            )) : <tr><td colSpan={4} className="border border-zinc-300 p-2">No periods logged in the last 12 months.</td></tr>}
          </tbody>
        </table>
        <div>
          <p className="font-bold">Symptoms logged</p>
          <ul className="list-disc pl-5 text-sm">
            {Object.entries(report.symptomCounts).length ? Object.entries(report.symptomCounts).sort((a, b) => b[1] - a[1]).map(([s, n]) => <li key={s}>{s}: {n} day{n === 1 ? "" : "s"}</li>) : <li>None logged</li>}
          </ul>
        </div>
        <p className="text-xs text-zinc-500">Intimacy logs and notes are not included. Estimates are not a diagnosis.</p>
        <div className="grid gap-2 print:hidden">
          <Button onClick={share} className="w-full rounded-2xl bg-purple-500 py-3 text-white">Share / save report</Button>
          <Button variant="secondary" onClick={() => window.print()} className="w-full rounded-2xl py-3">Print / Save as PDF</Button>
        </div>
      </div>
    </div>
  );
}
