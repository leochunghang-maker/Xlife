import { useEffect, useId } from "react";

// Tracks forms with unsaved typing so the midnight day-rollover reload can
// wait instead of wiping half-typed input.
const dirtyForms = new Set();

export function hasDirtyForms() {
  if (dirtyForms.size > 0) return true;
  const el = typeof document !== "undefined" ? document.activeElement : null;
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  return el.tagName === "INPUT" && !["button", "checkbox", "radio", "file", "submit", "range"].includes(el.type);
}

export function useDirtyForm(isDirty) {
  const id = useId();
  useEffect(() => {
    if (isDirty) dirtyForms.add(id);
    else dirtyForms.delete(id);
    return () => dirtyForms.delete(id);
  }, [id, isDirty]);
}
