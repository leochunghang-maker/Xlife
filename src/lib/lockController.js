// Platform-independent lock state machine. A native inactive event is NOT
// necessarily background (Face ID itself makes iOS inactive).
export const LOCK_AFTER_MS = 60_000;
export function createLockController({ enabled = false, authenticate, now = Date.now } = {}) {
  let state = { enabled, locked: enabled, shielded: false, busy: false, error: '' };
  let active = true;
  let hiddenAt = null;
  let generation = 0;
  let disposed = false;
  const listeners = new Set();
  function update(patch) {
    if (disposed) return;
    state = { ...state, ...patch };
    listeners.forEach(fn => fn());
  }
  const api = {
    getSnapshot: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setEnabled(next, { verified = false } = {}) {
      if (next === state.enabled) return;
      generation += 1;
      hiddenAt = null;
      update({ enabled: next, locked: next && (!verified || !active), shielded: next && !active, error: '' });
    },
    background() {
      if (!state.enabled) return;
      if (hiddenAt === null) {
        hiddenAt = now();
        // A prompt started before a genuine background cannot unlock on return.
        generation += 1;
      }
      active = false;
      update({ shielded: true });
    },
    activity(isActive, { prompting = false } = {}) {
      if (!state.enabled) return;
      active = isActive;
      if (!isActive) {
        update({ shielded: true });
        if (!prompting) api.background();
        return;
      }
      const elapsed = hiddenAt === null ? 0 : now() - hiddenAt;
      const expired = hiddenAt !== null && (elapsed < 0 || elapsed >= LOCK_AFTER_MS);
      hiddenAt = null;
      // Never auto-prompt on resume: cancellations and OS inactive/active cycles
      // must not cause prompt loops. Unlock is an explicit action after relock.
      update({ locked: state.locked || expired, shielded: false });
    },
    async unlock() {
      if (disposed || !state.enabled || state.busy || !active) return false;
      const request = generation;
      update({ busy: true, error: '' });
      let ok = false;
      try { ok = await authenticate(); } catch { /* deny */ }
      if (disposed) return false;
      if (request !== generation || !state.enabled) {
        update({ busy: false });
        return false;
      }
      update({ busy: false, locked: !ok, error: ok ? '' : 'Authentication cancelled or failed. Xlife stays locked.' });
      return ok;
    },
    dispose() { disposed = true; generation += 1; listeners.clear(); },
  };
  return api;
}

// Listener registration can resolve AFTER React cleanup. Remove late handles,
// never use removeAllListeners (other features can own native listeners).
export function attachLockLifecycle(controller, { doc, addNativeListener, isPrompting = () => false }) {
  let disposed = false;
  const handles = [];
  const visibility = () => {
    if (doc.visibilityState === 'hidden') {
      doc.activeElement?.blur?.();
      controller.activity(false, { prompting: isPrompting() });
    } else controller.activity(true);
  };
  doc.addEventListener('visibilitychange', visibility);
  if (doc.visibilityState === 'hidden') controller.activity(false, { prompting: isPrompting() });
  const register = (event, callback) => {
    if (!addNativeListener) return;
    Promise.resolve().then(() => addNativeListener(event, callback)).then(handle => {
      if (disposed) return handle.remove();
      handles.push(handle);
    }).catch(() => { /* DOM visibility remains the fallback; no native guarantee. */ });
  };
  register('appStateChange', ({ isActive }) => {
    if (!disposed) {
      if (!isActive) doc.activeElement?.blur?.();
      controller.activity(isActive, { prompting: isPrompting() });
    }
  });
  // Capacitor pause is didEnterBackground, unlike willResignActive for Face ID.
  register('pause', () => { if (!disposed) controller.background(); });
  return () => {
    disposed = true;
    doc.removeEventListener('visibilitychange', visibility);
    handles.forEach(handle => { Promise.resolve().then(() => handle.remove()).catch(() => {}); });
  };
}
