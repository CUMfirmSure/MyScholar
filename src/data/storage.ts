import type { AppState } from "../types";

/**
 * All ScholarFlow data lives on-device in localStorage.
 * Limitation: there is no account and no cross-device sync. A backup JSON
 * export/import (Settings) is the only way to move a semester to another phone.
 * No network calls are made for core functionality.
 */
export const STORAGE_KEY = "scholarflow.v1";

export function emptyState(): AppState {
  return {
    courses: [],
    exams: [],
    sessions: [],
    attendance: [],
    holidays: [],
    reminders: [],
    units: [],
    topics: [],
    logs: [],
    meta: { isSample: false, sampleBannerDismissed: true },
  };
}

export function normalize(input: Partial<AppState> | null | undefined): AppState {
  const base = emptyState();
  if (!input || typeof input !== "object") return base;
  return {
    courses: Array.isArray(input.courses) ? input.courses : [],
    exams: Array.isArray(input.exams) ? input.exams : [],
    sessions: Array.isArray(input.sessions) ? input.sessions : [],
    attendance: Array.isArray(input.attendance) ? input.attendance : [],
    holidays: Array.isArray(input.holidays) ? input.holidays : [],
    reminders: Array.isArray(input.reminders) ? input.reminders : [],
    units: Array.isArray(input.units) ? input.units : [],
    topics: Array.isArray(input.topics) ? input.topics : [],
    logs: Array.isArray(input.logs) ? input.logs : [],
    meta: { ...base.meta, ...(input.meta ?? {}) },
  };
}

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw) as Partial<AppState>);
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function downloadBackup(state: AppState) {
  const payload = {
    app: "ScholarFlow",
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const file = new File([blob], `scholarflow-backup-${new Date().toISOString().slice(0, 10)}.json`, {
    type: "application/json",
  });
  const share = navigator.share?.bind(navigator);
  if (share) {
    share({ files: [file], title: "ScholarFlow backup" }).catch(() => triggerDownload(blob, file.name));
    return;
  }
  triggerDownload(blob, file.name);
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function readBackup(text: string): AppState | null {
  try {
    const parsed = JSON.parse(text) as { state?: Partial<AppState> } & Partial<AppState>;
    const candidate = parsed.state && typeof parsed.state === "object" ? parsed.state : parsed;
    if (!candidate || !Array.isArray((candidate as AppState).courses)) return null;
    return normalize(candidate as Partial<AppState>);
  } catch {
    return null;
  }
}
