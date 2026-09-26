import type {
  AppState,
  AttendanceRecord,
  Course,
  Exam,
  Holiday,
  MarkStatus,
  SessionArchive,
} from "../types";
import { addDaysStr, dayDiff, parseDay, weekdayOf } from "./dates";
import { uid } from "./ids";
import { formatPretty } from "./dates";

export interface SessionStats {
  startDate: string;
  endDate: string;
  scheduled: number;
  attended: number;
  absent: number;
  cancelled: number;
  unmarked: number;
  extras: number;
  percentage: number | null;
}

/**
 * Attendance is calculated per session, on this device only.
 * There is no cross-device sync — see storage.ts.
 *
 * Open session: course.sessionStartDate → today.
 * A linked exam closes that session the day AFTER the exam (today > exam date).
 * The closed window includes the exam date. The next session starts exam date + 1
 * and can be edited by the user.
 *
 * Holidays exclude scheduled lectures from both numerator and denominator.
 * Cancelled lectures are recorded (so they are not "unmarked") but also excluded.
 * Unmarked lectures on past dates count as misses. Unmarked lectures today do not
 * count until they are marked, so opening the app in the morning does not punish you.
 * Extra / makeup lectures (isExtra) count in whichever session contains their date.
 */
export function holidayOn(date: string, holidays: Holiday[]): Holiday | undefined {
  return holidays.find((h) => h.startDate <= date && date <= h.endDate);
}

export function slotRecord(
  attendance: AttendanceRecord[],
  courseId: string,
  date: string,
  slotId: string,
): AttendanceRecord | undefined {
  return attendance.find((a) => a.courseId === courseId && a.date === date && !a.isExtra && a.slotId === slotId);
}

export function computeSessionStats(
  state: Pick<AppState, "attendance" | "holidays">,
  course: Course,
  startDate: string,
  endDate: string,
  today: string,
): SessionStats {
  let scheduled = 0;
  let attended = 0;
  let absent = 0;
  let cancelled = 0;
  let unmarked = 0;
  let extras = 0;
  const matched = new Set<string>();

  if (startDate && endDate && endDate >= startDate) {
    let date = startDate;
    let guard = 0;
    while (date <= endDate && guard < 800) {
      const holiday = holidayOn(date, state.holidays);
      if (!holiday) {
        const dow = weekdayOf(date);
        for (const slot of course.slots) {
          if (slot.day !== dow) continue;
          const recs = state.attendance.filter(
            (a) => a.courseId === course.id && a.date === date && !a.isExtra && a.slotId === slot.id,
          );
          recs.forEach((r) => matched.add(r.id));
          const rec = recs[0];
          if (rec?.status === "cancelled") {
            cancelled += 1;
            continue;
          }
          if (date > today) continue;
          if (date === today && !rec) continue;
          scheduled += 1;
          if (rec?.status === "present") attended += 1;
          else if (rec?.status === "absent") absent += 1;
          else {
            absent += 1;
            unmarked += 1;
          }
        }
      }
      date = addDaysStr(date, 1);
      guard += 1;
    }
  }

  for (const rec of state.attendance) {
    if (rec.courseId !== course.id) continue;
    if (rec.date < startDate || rec.date > endDate || rec.date > today) continue;
    // A holiday removes the scheduled lecture even if it was marked before the day off was added.
    if (!rec.isExtra && holidayOn(rec.date, state.holidays)) continue;
    if (!rec.isExtra && matched.has(rec.id)) continue;
    if (rec.status === "cancelled") {
      cancelled += 1;
      continue;
    }
    if (rec.isExtra) extras += 1;
    scheduled += 1;
    if (rec.status === "present") attended += 1;
    else absent += 1;
  }

  const percentage = scheduled === 0 ? null : Math.round((attended / scheduled) * 1000) / 10;
  return { startDate, endDate, scheduled, attended, absent, cancelled, unmarked, extras, percentage };
}

export function isBelowTarget(stats: SessionStats, target: number): boolean {
  if (stats.scheduled === 0) return false;
  return stats.attended / stats.scheduled < target / 100 - 1e-9;
}

/** How many additional absences still keep the course at or above target. Null if already below or unknown. */
export function classesYouCanMiss(stats: SessionStats, target: number): number | null {
  if (stats.scheduled === 0) return null;
  const T = target / 100;
  if (T <= 0) return null;
  if (stats.attended / stats.scheduled < T - 1e-9) return null;
  return Math.max(0, Math.floor(stats.attended / T - stats.scheduled + 1e-9));
}

/** Straight presents needed to climb back to target. Null if impossible (e.g. 100% after a miss). */
export function classesToRecover(stats: SessionStats, target: number): number | null {
  if (stats.scheduled === 0) return null;
  const T = target / 100;
  if (stats.attended / stats.scheduled >= T - 1e-9) return 0;
  if (T >= 0.999) return null;
  const n = (T * stats.scheduled - stats.attended) / (1 - T);
  const rounded = Math.round(n * 1e6) / 1e6;
  return Math.max(0, Math.ceil(rounded - 1e-9));
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

export function openStats(state: AppState, course: Course, today: string): SessionStats {
  const end = course.sessionStartDate > today ? addDaysStr(course.sessionStartDate, -1) : today;
  return computeSessionStats(state, course, course.sessionStartDate, end, today);
}

export function liveArchiveStats(state: AppState, archive: SessionArchive, today: string): SessionStats {
  const course = state.courses.find((c) => c.id === archive.courseId);
  if (!course) {
    return {
      startDate: archive.startDate,
      endDate: archive.endDate,
      scheduled: archive.scheduled,
      attended: archive.attended,
      absent: Math.max(0, archive.scheduled - archive.attended),
      cancelled: 0,
      unmarked: 0,
      extras: 0,
      percentage: archive.percentage,
    };
  }
  return computeSessionStats(state, course, archive.startDate, archive.endDate, today);
}

export function nextClosingExam(state: AppState, courseId: string, today: string): Exam | undefined {
  return state.exams
    .filter((e) => e.courseId === courseId && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0];
}

export function nearestExamWithin(state: AppState, today: string, withinDays = 14): Exam | null {
  const upcoming = state.exams
    .filter((e) => e.date >= today && dayDiff(e.date, today) <= withinDays)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  return upcoming[0] ?? null;
}

export interface TodaySlot {
  key: string;
  course: Course;
  slotId: string;
  label: string;
  startTime: string;
  endTime: string;
  location: string;
  status: MarkStatus | null;
  recordId?: string;
}

export function lecturesOn(state: AppState, date: string): { holiday: Holiday | null; slots: TodaySlot[] } {
  const holiday = holidayOn(date, state.holidays) ?? null;
  if (holiday) return { holiday, slots: [] };
  const dow = weekdayOf(date);
  const slots: TodaySlot[] = [];
  for (const course of state.courses) {
    for (const slot of course.slots) {
      if (slot.day !== dow) continue;
      const rec = slotRecord(state.attendance, course.id, date, slot.id);
      slots.push({
        key: `${course.id}:${slot.id}:${date}`,
        course,
        slotId: slot.id,
        label: slot.label || "Lecture",
        startTime: slot.startTime,
        endTime: slot.endTime,
        location: course.location,
        status: rec?.status ?? null,
        recordId: rec?.id,
      });
    }
  }
  slots.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.course.code.localeCompare(b.course.code));
  return { holiday, slots };
}

export interface DayPlanItem {
  key: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  color: string;
  date: string;
  slotId: string | null;
  label: string;
  startTime: string;
  endTime: string;
  location: string;
  isExtra: boolean;
  recordId?: string;
  status: MarkStatus | null;
  excluded: boolean;
}

export function planForDate(state: AppState, date: string): { holiday: Holiday | null; items: DayPlanItem[] } {
  const holiday = holidayOn(date, state.holidays) ?? null;
  const dow = weekdayOf(date);
  const items: DayPlanItem[] = [];
  const seen = new Set<string>();

  for (const course of state.courses) {
    for (const slot of course.slots) {
      if (slot.day !== dow) continue;
      const rec = slotRecord(state.attendance, course.id, date, slot.id);
      if (rec) seen.add(rec.id);
      items.push({
        key: `slot:${course.id}:${date}:${slot.id}`,
        courseId: course.id,
        courseName: course.name,
        courseCode: course.code,
        color: course.color,
        date,
        slotId: slot.id,
        label: slot.label || "Lecture",
        startTime: slot.startTime,
        endTime: slot.endTime,
        location: course.location,
        isExtra: false,
        recordId: rec?.id,
        status: holiday ? null : (rec?.status ?? null),
        excluded: Boolean(holiday),
      });
    }
  }

  for (const rec of state.attendance) {
    if (rec.date !== date || seen.has(rec.id)) continue;
    if (!rec.isExtra && state.courses.some((c) => c.id === rec.courseId && c.slots.some((s) => s.id === rec.slotId))) {
      continue;
    }
    const course = state.courses.find((c) => c.id === rec.courseId);
    items.push({
      key: `rec:${rec.id}`,
      courseId: rec.courseId,
      courseName: course?.name ?? "Removed course",
      courseCode: course?.code ?? "—",
      color: course?.color ?? "#7b6cff",
      date,
      slotId: rec.slotId,
      label: rec.isExtra ? rec.slotLabel || "Extra" : rec.slotLabel || "Recorded",
      startTime: rec.startTime,
      endTime: rec.endTime,
      location: course?.location ?? "",
      isExtra: rec.isExtra || !rec.slotId,
      recordId: rec.id,
      status: rec.status,
      excluded: false,
    });
  }

  items.sort((a, b) => Number(a.excluded) - Number(b.excluded) || a.startTime.localeCompare(b.startTime) || a.courseCode.localeCompare(b.courseCode));
  return { holiday, items };
}

export function reconcileSessions(state: AppState, today: string): AppState {
  let courses = state.courses.map((c) => ({ ...c, slots: c.slots.map((s) => ({ ...s })) }));
  let sessions = [...state.sessions];
  let logs = state.logs;
  let changed = false;

  for (const original of courses) {
    let course = original;
    const linked = state.exams
      .filter((e) => e.courseId === course.id)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    let guard = 0;
    while (guard < 24) {
      guard += 1;
      const exam = linked.find(
        (e) =>
          e.date >= course.sessionStartDate &&
          e.date < today &&
          !sessions.some((s) => s.examId === e.id && s.courseId === course.id),
      );
      if (!exam) break;
      const startDate = course.sessionStartDate;
      const stats = computeSessionStats(
        { attendance: state.attendance, holidays: state.holidays },
        course,
        startDate,
        exam.date,
        today,
      );
      const sessionNumber = sessions.filter((s) => s.courseId === course.id).length + 1;
      const closedAt = new Date().toISOString();
      sessions = [
        ...sessions,
        {
          id: uid("ses"),
          courseId: course.id,
          sessionNumber,
          startDate,
          endDate: exam.date,
          examId: exam.id,
          attended: stats.attended,
          scheduled: stats.scheduled,
          percentage: stats.percentage ?? 0,
          closedAt,
        },
      ];
      course = { ...course, sessionStartDate: addDaysStr(exam.date, 1), updatedAt: closedAt };
      courses = courses.map((c) => (c.id === course.id ? course : c));
      logs = [
        {
          id: uid("log"),
          action: "update",
          entity: "session",
          summary: `${course.code} session ${sessionNumber} closed by ${exam.subject} (${formatPretty(startDate)}–${formatPretty(exam.date)}). New session starts ${formatPretty(course.sessionStartDate)}.`,
          timestamp: closedAt,
        },
        ...logs,
      ];
      changed = true;
    }
  }

  if (!changed) return state;
  return { ...state, courses, sessions, logs: logs.slice(0, 400) };
}

export function sessionOrdinal(state: AppState, courseId: string): number {
  return state.sessions.filter((s) => s.courseId === courseId).length + 1;
}

export function courseName(state: AppState, courseId: string | null | undefined): string {
  if (!courseId) return "";
  return state.courses.find((c) => c.id === courseId)?.code ?? "";
}

export function safeParseDay(date: string): Date | null {
  try {
    const d = parseDay(date);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
