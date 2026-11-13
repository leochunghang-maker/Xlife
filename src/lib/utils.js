

export function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

// Current time in ms (kept in a helper so event handlers can call it freely).
export function nowMs() {
  return Date.now();
}
