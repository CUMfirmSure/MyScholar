let seq = 0;

export function uid(prefix = "id"): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function asset(path: string): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base}${path.replace(/^\//, "")}`;
}

export function tapHaptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not available */
  }
}
