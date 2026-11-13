import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Button } from "../components/ui.jsx";
import { readLocalJSON } from "../lib/storage";
import { isSupabaseConfigured } from "../lib/supabase";
import { readPartnerConnection, savePartnerConnection, generateLocalInviteCode } from "../lib/partnerConnection";

// Invite / connect / disconnect card for the Us tab (UI from local-latest).
// With Xlife Cloud configured and signed in, codes are real one-time invites
// (create_couple_invite / accept_couple_invite). Otherwise the connection is
// recorded on this phone only and clearly labelled as such.
export function PartnerConnect({ demoActive, onStartDemo, onChange }) {
  const [connection, setConnection] = useState(readPartnerConnection);
  const [codeInput, setCodeInput] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cloudSignedIn, setCloudSignedIn] = useState(false);

  function update(next) {
    setConnection(next);
    savePartnerConnection(next);
    onChange?.(next);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let cancelled = false;
    (async () => {
      const { getCloudSession, getCouple } = await import("../lib/cloud");
      const session = await getCloudSession().catch(() => null);
      if (cancelled) return;
      setCloudSignedIn(Boolean(session));
      if (!session) return;
      const couple = await getCouple().catch(() => null);
      if (cancelled) return;
      const current = readPartnerConnection();
      if (couple) {
        update({
          ...(current || {}),
          id: couple.id,
          ownerUserId: session.user.id,
          partnerName: couple.partnerName || "Partner",
          status: "connected",
          cloud: true,
          local: false,
          connectedAt: current?.connectedAt || couple.created_at || new Date().toISOString(),
          createdAt: current?.createdAt || couple.created_at || new Date().toISOString(),
        });
      } else if (current?.cloud && current.status === "connected") {
        // The partner left the couple on the server.
        update(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useCloud = isSupabaseConfigured && cloudSignedIn;

  async function invitePartner() {
    setError("");
    setMessage("");
    const user = readLocalJSON("dayflow_user", null);
    const now = new Date().toISOString();
    let inviteCode = generateLocalInviteCode();
    if (useCloud) {
      setBusy(true);
      const { createCoupleInvite } = await import("../lib/cloud");
      const { code, error: inviteError } = await createCoupleInvite();
      setBusy(false);
      if (inviteError || !code) {
        setError(inviteError?.message || "Couldn't create an invite code. Try again.");
        return;
      }
      inviteCode = code;
    }
    update({
      id: crypto.randomUUID(),
      ownerUserId: user?.id || "local-user",
      inviteCode,
      partnerName: null,
      partnerEmail: null,
      status: "invite_created",
      createdAt: now,
      connectedAt: null,
      cloud: useCloud,
      local: !useCloud,
    });
  }

  async function copyCode() {
    if (!connection?.inviteCode) return;
    try {
      await navigator.clipboard?.writeText(connection.inviteCode);
      setMessage("Invite code copied");
    } catch {
      setMessage(`Your code: ${connection.inviteCode}`);
    }
  }

  async function shareInvite() {
    const code = connection?.inviteCode;
    if (!code) return;
    const text = `Use my Xlife invite code: ${code}`;
    try {
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share")) {
        await Share.share({ title: "Join me on Xlife", text });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: "Join me on Xlife", text });
        return;
      }
    } catch {
      // Cancelled or unavailable: fall back to copying.
    }
    await copyCode();
  }

  async function connectWithCode() {
    const code = codeInput.trim();
    if (!code) return;
    setError("");
    setMessage("");
    const user = readLocalJSON("dayflow_user", null);
    const now = new Date().toISOString();
    if (useCloud) {
      setBusy(true);
      const { acceptCoupleInvite, getCouple } = await import("../lib/cloud");
      const { coupleId, error: acceptError } = await acceptCoupleInvite(code);
      if (acceptError) {
        setBusy(false);
        setError(acceptError.message || "That code didn't work. Check it and try again.");
        return;
      }
      const couple = await getCouple().catch(() => null);
      setBusy(false);
      update({
        id: coupleId || couple?.id || crypto.randomUUID(),
        ownerUserId: user?.id || "local-user",
        inviteCode: code,
        partnerName: couple?.partnerName || "Partner",
        partnerEmail: null,
        status: "connected",
        createdAt: connection?.createdAt || now,
        connectedAt: now,
        cloud: true,
        local: false,
      });
    } else {
      update({
        id: connection?.id || crypto.randomUUID(),
        ownerUserId: connection?.ownerUserId || user?.id || "local-user",
        inviteCode: code,
        partnerName: "Partner",
        partnerEmail: null,
        status: "connected",
        createdAt: connection?.createdAt || now,
        connectedAt: now,
        cloud: false,
        local: true,
      });
    }
    setCodeInput("");
    setMessage("Partner connected");
  }

  async function disconnect() {
    if (connection?.cloud && connection.status === "connected") {
      if (!window.confirm("Disconnect from your partner? They will stop seeing anything you share.")) return;
      setBusy(true);
      const { leaveCouple } = await import("../lib/cloud");
      await leaveCouple().catch(() => {});
      setBusy(false);
    }
    update(null);
    setCodeInput("");
    setMessage("");
    setError("");
  }

  const connected = connection?.status === "connected";

  return (
    <div className="mb-4 rounded-3xl bg-gradient-to-br from-orange-50 to-rose-50 p-4 shadow-sm dark:from-zinc-800 dark:to-zinc-900" data-testid="partner-connect">
      {connected ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black">Connected with {connection.partnerName || "Partner"}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Connected {connection.connectedAt ? new Date(connection.connectedAt).toLocaleString() : "locally"}
              </p>
            </div>
            <span className="rounded-full bg-[hsl(160_50%_45%)]/10 px-3 py-1 text-xs font-bold text-[hsl(160_50%_45%)]">
              Connected
            </span>
          </div>
          {connection.local && (
            <p className="text-xs text-zinc-500">
              Paired on this phone only — nothing is shared with your partner until Xlife Cloud is set up and you both sign in (Settings).
            </p>
          )}
          <Button variant="secondary" onClick={disconnect} disabled={busy} className="w-full rounded-2xl py-3 text-sm">
            Disconnect Partner
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="font-black">Connect with your partner</p>
            <p id="tbmjlwm" className="mt-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              Share updates, plans, and memories together.
            </p>
            {!useCloud && (
              <p className="mt-1 text-xs text-zinc-500">
                {isSupabaseConfigured
                  ? "Sign in to Xlife Cloud in Settings for real two-phone pairing. Until then codes only work on this phone."
                  : "Real two-phone pairing needs Xlife Cloud (see docs/SETUP.md). Until then codes only work on this phone."}
              </p>
            )}
          </div>

          {connection?.status === "invite_created" ? (
            <div className="space-y-3">
              <div className="rounded-3xl bg-white p-4 text-center shadow-sm dark:bg-zinc-900">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Invite code</p>
                <p className="mt-1 text-2xl font-black tracking-wide" aria-label="Partner invite code">{connection.inviteCode}</p>
                <p className="mt-1 text-xs font-semibold text-zinc-500">Waiting for partner...</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={copyCode} className="rounded-2xl py-3 text-sm">Copy Code</Button>
                <Button onClick={shareInvite} className="rounded-2xl bg-[hsl(160_50%_45%)] py-3 text-sm text-white">Share Invite</Button>
              </div>
            </div>
          ) : (
            <Button id="0frvww" onClick={invitePartner} disabled={busy} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white">
              Invite Partner
            </Button>
          )}

          <div className="grid gap-2">
            <input
              className="field mb-0"
              placeholder="Enter Partner Code"
              aria-label="Partner code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
            />
            <Button onClick={connectWithCode} disabled={busy || !codeInput.trim()} className="rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white">
              Connect
            </Button>
          </div>
          {connection && (
            <Button variant="secondary" onClick={disconnect} disabled={busy} className="w-full rounded-2xl py-3 text-sm">
              Cancel invite
            </Button>
          )}
          {!demoActive && onStartDemo && (
            <button onClick={onStartDemo} className="w-full text-center text-xs font-bold text-zinc-500 underline">
              Preview with demo partner
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{error}</p>}
      {message && (
        <p className="mt-3 rounded-2xl bg-[hsl(160_50%_45%)]/10 p-3 text-sm font-bold text-[hsl(160_50%_45%)]" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
