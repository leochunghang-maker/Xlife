import { useEffect, useState } from "react";
import { Cloud } from "lucide-react";
import { Button } from "../components/ui.jsx";
import { readLocalJSON } from "../lib/storage";
import {
  isSupabaseConfigured, getCloudSession, onCloudAuthChange, cloudSignIn, cloudSignUp, cloudSignOut,
  backupLocalToCloud, restoreFromCloud, createCoupleInvite, acceptCoupleInvite, leaveCouple, getCouple, CLOUD_STATUS_KEY,
} from "../lib/cloud";

export function CloudSettings({ user }) {
  const [session, setSession] = useState(null);
  const [form, setForm] = useState({ email: user?.email || "", password: "" });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(() => readLocalJSON(CLOUD_STATUS_KEY, null));
  const [couple, setCouple] = useState(null);
  const [inviteCode, setInviteCode] = useState("");
  const [partnerCode, setPartnerCode] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    getCloudSession().then(setSession);
    return onCloudAuthChange(setSession);
  }, []);

  useEffect(() => {
    if (session) getCouple().then(setCouple).catch(() => setCouple(null));
  }, [session]);

  if (!isSupabaseConfigured) {
    return (
      <section className="rounded-3xl bg-zinc-50 p-4 dark:bg-zinc-800/60" data-testid="cloud-disabled">
        <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-400"><Cloud className="h-4 w-4" />Xlife Cloud</p>
        <p className="text-sm font-semibold">Local-only mode</p>
        <p className="mt-1 text-xs text-zinc-500">Everything is stored on this phone. Cloud backup, real partner pairing and AI photo estimates turn on once Xlife Cloud is configured (see docs/SETUP.md).</p>
      </section>
    );
  }

  async function run(label, fn) {
    setBusy(label);
    setMessage("");
    try {
      await fn();
    } catch (error) {
      setMessage(error?.message || "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  const signIn = () => run("signin", async () => {
    const { error } = await cloudSignIn(form);
    if (error) throw error;
    setForm((f) => ({ ...f, password: "" }));
  });
  const signUp = () => run("signup", async () => {
    const { data, error } = await cloudSignUp({ ...form, name: user?.name || "" });
    if (error) throw error;
    setForm((f) => ({ ...f, password: "" }));
    setMessage(data?.session ? "Account created." : "Check your email to confirm your account, then sign in.");
  });
  const backup = () => run("backup", async () => {
    const result = await backupLocalToCloud({ onProgress: setMessage });
    setStatus(result);
    setMessage("Backup complete. Your data is still on this phone too.");
  });
  const restore = () => run("restore", async () => {
    const { added } = await restoreFromCloud({ onProgress: setMessage });
    const total = Object.values(added || {}).reduce((sum, n) => sum + n, 0);
    setMessage(total ? `Restored ${total} item(s) that weren't on this phone. Reopen Xlife to see them everywhere.` : "Nothing new to restore — this phone already has everything.");
  });
  const invite = () => run("invite", async () => {
    const { code, error } = await createCoupleInvite();
    if (error) throw error;
    setInviteCode(code);
  });
  const join = () => run("join", async () => {
    const { error } = await acceptCoupleInvite(partnerCode);
    if (error) throw error;
    setPartnerCode("");
    setCouple(await getCouple());
    setMessage("You're paired! Choose what to share below.");
  });
  const unpair = () => run("unpair", async () => {
    if (!window.confirm("Unpair from your partner? They will stop seeing anything you shared.")) return;
    await leaveCouple();
    setCouple(null);
  });

  return (
    <section className="space-y-3 rounded-3xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-400"><Cloud className="h-4 w-4" />Xlife Cloud</p>
      {!session ? (
        <>
          <p className="text-sm text-zinc-500">Sign in to back up this phone and pair with your partner.</p>
          <input className="field" type="email" placeholder="Email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="field" type="password" placeholder="Password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={signIn} disabled={!!busy} className="rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white">Sign in</Button>
            <Button variant="secondary" onClick={signUp} disabled={!!busy} className="rounded-2xl py-3">Create account</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm">Signed in as <b>{session.user.email}</b></p>
          {status?.lastBackupAt && <p className="text-xs text-zinc-500">Last backup {new Date(status.lastBackupAt).toLocaleString()}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={backup} disabled={!!busy} className="rounded-2xl bg-[hsl(160_50%_45%)] py-3 text-white">{busy === "backup" ? "Backing up…" : "Back up now"}</Button>
            <Button variant="secondary" onClick={restore} disabled={!!busy} className="rounded-2xl py-3">Restore</Button>
          </div>
          <div className="rounded-2xl bg-white p-3 dark:bg-zinc-900">
            <p className="text-sm font-bold">Partner</p>
            {couple ? (
              <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                <span>Paired with <b>{couple.partnerName}</b></span>
                <Button size="sm" variant="secondary" onClick={unpair} className="rounded-2xl">Unpair</Button>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <Button variant="secondary" onClick={invite} disabled={!!busy} className="w-full rounded-2xl py-3">Create invite code</Button>
                {inviteCode && <p className="text-center text-2xl font-black tracking-widest" aria-label="Your invite code">{inviteCode}</p>}
                {inviteCode && <p className="text-center text-xs text-zinc-500">Share this code with your partner. It works once and expires in 7 days.</p>}
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input className="field" placeholder="Partner's code" value={partnerCode} onChange={(e) => setPartnerCode(e.target.value.toUpperCase())} />
                  <Button onClick={join} disabled={!partnerCode.trim() || !!busy} className="rounded-2xl bg-rose-500 text-white">Join</Button>
                </div>
              </div>
            )}
          </div>
          <Button variant="ghost" onClick={() => run("signout", cloudSignOut)} className="w-full rounded-2xl">Sign out of Xlife Cloud</Button>
        </>
      )}
      {message && <p className="text-sm text-zinc-500" role="status">{message}</p>}
    </section>
  );
}
