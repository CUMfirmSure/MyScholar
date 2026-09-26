import type { AppState, Course, Exam, Reminder } from "../types";
import {
  classesToRecover,
  classesYouCanMiss,
  formatPct,
  isBelowTarget,
  nearestExamWithin,
  nextClosingExam,
  openStats,
  sessionOrdinal,
  type SessionStats,
} from "./attendance";
import { addDaysStr, formatPretty, relativeDay } from "./dates";
import { reminderDue } from "./notify";

export interface CourseSnapshot {
  course: Course;
  stats: SessionStats;
  below: boolean;
  canMiss: number | null;
  recover: number | null;
  atRisk: boolean;
  closing?: Exam;
  pendingTopics: number;
  openTopics: number;
  sessionNumber: number;
}

export function snapshot(state: AppState, course: Course, today: string): CourseSnapshot {
  const stats = openStats(state, course, today);
  const below = isBelowTarget(stats, course.targetAttendance);
  const canMiss = classesYouCanMiss(stats, course.targetAttendance);
  const recover = classesToRecover(stats, course.targetAttendance);
  const topics = state.topics.filter((t) => t.courseId === course.id);
  return {
    course,
    stats,
    below,
    canMiss,
    recover,
    atRisk: below || (canMiss != null && canMiss <= 1),
    closing: nextClosingExam(state, course.id, today),
    pendingTopics: topics.filter((t) => t.status === "pending").length,
    openTopics: topics.filter((t) => t.status !== "done").length,
    sessionNumber: sessionOrdinal(state, course.id),
  };
}

export function allSnapshots(state: AppState, today: string): CourseSnapshot[] {
  return state.courses
    .map((c) => snapshot(state, c, today))
    .sort((a, b) => Number(b.below) - Number(a.below) || (a.stats.percentage ?? 101) - (b.stats.percentage ?? 101));
}

export function insightCopy(snap: CourseSnapshot): string {
  const name = snap.course.name;
  const target = snap.course.targetAttendance;
  if (snap.stats.scheduled === 0) return `${name} has no counted lectures in this session yet.`;
  if (snap.below) {
    if (snap.recover == null) {
      return `${name} can't reach ${target}% unless missed classes are cancelled.`;
    }
    const n = snap.recover;
    return `You need ${n} straight attendance${n === 1 ? "" : "s"} in ${name} to recover to ${target}%.`;
  }
  if (snap.canMiss === 0) return `One more miss drops ${name} under ${target}%.`;
  if (snap.canMiss === 1) return `You can miss 1 more class in ${name} and stay above ${target}%.`;
  if (snap.canMiss != null) return `You can miss ${snap.canMiss} more classes in ${name} and stay above ${target}%.`;
  return `${name} is on track.`;
}

export function bufferCopy(snap: CourseSnapshot): string {
  if (snap.stats.percentage == null) return "No lectures counted yet";
  if (snap.below) {
    if (snap.recover == null) return `Under ${snap.course.targetAttendance}% — can't recover by attending alone`;
    return `Need ${snap.recover} straight to reach ${snap.course.targetAttendance}%`;
  }
  if (snap.canMiss === 0) return "On the line — don't miss the next one";
  if (snap.canMiss != null) return `You can miss ${snap.canMiss} more and stay above ${snap.course.targetAttendance}%`;
  return "On track";
}

export function sessionLabel(snap: CourseSnapshot, today: string): string {
  const start = formatPretty(snap.course.sessionStartDate);
  if (snap.course.sessionStartDate > today) return `Session ${snap.sessionNumber} starts ${start}`;
  return `Session ${snap.sessionNumber} · since ${start}`;
}

export function urgentReminders(state: AppState, today: string, now = new Date(), limit = 3): Reminder[] {
  return state.reminders
    .filter((r) => !r.completed)
    .slice()
    .sort((a, b) => reminderDue(a) - reminderDue(b))
    .filter((r) => {
      const dueDay = r.dueDate;
      return dueDay <= addDaysStr(today, 21) || reminderDue(r) < now.getTime();
    })
    .slice(0, limit);
}

export function overdueReminders(state: AppState, now = new Date()): Reminder[] {
  return state.reminders
    .filter((r) => !r.completed && reminderDue(r) < now.getTime())
    .sort((a, b) => reminderDue(a) - reminderDue(b));
}

export function upcomingReminders(state: AppState, now = new Date()): Reminder[] {
  return state.reminders
    .filter((r) => !r.completed && reminderDue(r) >= now.getTime())
    .sort((a, b) => reminderDue(a) - reminderDue(b));
}

export function dashboardExam(state: AppState, today: string): Exam | null {
  return nearestExamWithin(state, today, 14);
}

export function pctLabel(stats: SessionStats): string {
  return formatPct(stats.percentage);
}

export function dueLabel(reminder: Reminder, today: string): string {
  return `${relativeDay(reminder.dueDate, today)} · ${reminder.dueTime ? reminder.dueTime : ""}`.replace(/ · $/, "");
}
