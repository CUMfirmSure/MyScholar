import { addDays, differenceInCalendarDays, format, parse, parseISO, isValid } from "date-fns";
import type { Weekday } from "../types";

export function todayStr(now = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

export function parseDay(date: string): Date {
  return parseISO(date);
}

export function addDaysStr(date: string, days: number): string {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

export function weekdayOf(date: string): Weekday {
  return parseISO(date).getDay() as Weekday;
}

export function eachDate(start: string, end: string, cap = 800): string[] {
  if (!start || !end || end < start) return [];
  const dates: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < cap) {
    dates.push(cursor);
    cursor = addDaysStr(cursor, 1);
    guard += 1;
  }
  return dates;
}

export function formatPretty(date: string): string {
  return format(parseISO(date), "d MMM");
}

export function formatLong(date: string): string {
  return format(parseISO(date), "EEE d MMM");
}

export function formatFull(date: string): string {
  return format(parseISO(date), "EEEE, d MMMM");
}

export function formatMonth(date: Date): string {
  return format(date, "MMMM yyyy");
}

export function dayDiff(date: string, today: string): number {
  return differenceInCalendarDays(parseISO(date), parseISO(today));
}

export function relativeDay(date: string, today: string): string {
  const diff = dayDiff(date, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < 0 && diff > -7) return `${-diff} days ago`;
  return formatPretty(date);
}

export function countdownLabel(date: string, today: string): string {
  const diff = dayDiff(date, today);
  if (diff < 0) return "Passed";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${diff} days`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Late night";
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function formatTime(time: string): string {
  if (!time) return "";
  const [hRaw, mRaw] = time.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw ?? 0);
  if (Number.isNaN(h)) return time;
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatTimeRange(start: string, end: string): string {
  if (!start && !end) return "Time TBD";
  if (!end || start === end) return formatTime(start);
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function normalizeTime(raw: string, ampm?: string): string | null {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  if (minute > 59 || hour > 23) return null;
  const ap = ampm?.toLowerCase();
  if (ap === "pm" && hour < 12) hour += 12;
  if (ap === "am" && hour === 12) hour = 0;
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const DATE_FORMATS = ["yyyy-MM-dd", "d MMM yyyy", "MMM d yyyy", "d MMM", "MMM d", "d/M/yyyy", "d-M-yyyy", "d/M", "d-M"];

export function parseLooseDate(raw: string, ref = new Date()): string | null {
  const text = raw.trim();
  if (!text) return null;
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(text, fmt, ref);
    if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
  }
  return null;
}

export function parseTimeRange(raw: string): { start: string; end: string } | null {
  const text = raw.trim();
  if (!text) return null;
  const range = text.match(
    /^(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?$/i,
  );
  if (range) {
    const start = normalizeTime(range[1], range[2] || range[4]);
    const end = normalizeTime(range[3], range[4] || range[2]);
    if (!start || !end) return null;
    return { start, end };
  }
  const single = text.match(/^(\d{1,2}(?::\d{2})?)\s*(am|pm)?$/i);
  if (!single) return null;
  const start = normalizeTime(single[1], single[2]);
  if (!start) return null;
  return { start, end: start };
}

export function stamp(date: string, time = "09:00"): string {
  return `${date}T${time.length === 5 ? time : "09:00"}:00`;
}
