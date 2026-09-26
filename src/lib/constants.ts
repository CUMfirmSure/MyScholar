import type { HolidayKind, Priority, ReminderType, TopicStatus, Weekday } from "../types";

export const COURSE_COLORS = [
  "#7b6cff",
  "#5eead4",
  "#f0abfc",
  "#fbbf24",
  "#fb7185",
  "#60a5fa",
  "#34d399",
  "#fdba74",
] as const;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const REMINDER_TYPES: { id: ReminderType; label: string }[] = [
  { id: "assignment", label: "Assignment" },
  { id: "test", label: "Test" },
  { id: "quiz", label: "Quiz" },
  { id: "lab", label: "Lab" },
  { id: "other", label: "Other" },
];

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

export const HOLIDAY_KINDS: { id: HolidayKind; label: string }[] = [
  { id: "holiday", label: "Holiday" },
  { id: "break", label: "Break" },
  { id: "personal", label: "Personal" },
];

export const TOPIC_STATUSES: { id: TopicStatus; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

export function weekdayName(day: Weekday, long = false): string {
  return long ? WEEKDAY_LONG[day] : WEEKDAY_SHORT[day];
}
