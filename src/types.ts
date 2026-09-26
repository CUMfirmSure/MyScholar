export type ID = string;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type MarkStatus = "present" | "absent" | "cancelled";

export type HolidayKind = "holiday" | "break" | "personal";

export type ReminderType = "assignment" | "test" | "quiz" | "lab" | "other";

export type Priority = "low" | "medium" | "high";

export type TopicStatus = "pending" | "in_progress" | "done";

export type LogAction = "create" | "update" | "delete" | "mark";

export interface TimeSlot {
  id: ID;
  day: Weekday;
  startTime: string;
  endTime: string;
  label: string;
}

export interface Course {
  id: ID;
  name: string;
  code: string;
  color: string;
  instructor: string;
  location: string;
  slots: TimeSlot[];
  targetAttendance: number;
  /** Start of the currently open attendance session (YYYY-MM-DD). */
  sessionStartDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Exam {
  id: ID;
  courseId: string | null;
  subject: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  notes: string;
  createdAt: string;
}

export interface SessionArchive {
  id: ID;
  courseId: string;
  sessionNumber: number;
  startDate: string;
  endDate: string;
  examId: string | null;
  attended: number;
  scheduled: number;
  percentage: number;
  closedAt: string;
}

export interface AttendanceRecord {
  id: ID;
  courseId: string;
  date: string;
  slotId: string | null;
  slotLabel: string;
  startTime: string;
  endTime: string;
  status: MarkStatus;
  /** Makeup / extra lecture that is not part of the weekly slot pattern. */
  isExtra: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  id: ID;
  title: string;
  kind: HolidayKind;
  startDate: string;
  endDate: string;
  notes: string;
  createdAt: string;
}

export interface Reminder {
  id: ID;
  title: string;
  type: ReminderType;
  courseId: string | null;
  dueDate: string;
  dueTime: string;
  priority: Priority;
  notes: string;
  remindDaysBefore: number;
  completed: boolean;
  notified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyllabusUnit {
  id: ID;
  courseId: string;
  name: string;
  order: number;
}

export interface SyllabusTopic {
  id: ID;
  unitId: string;
  courseId: string;
  title: string;
  status: TopicStatus;
  order: number;
}

export interface ActivityLog {
  id: ID;
  action: LogAction;
  entity: string;
  summary: string;
  timestamp: string;
}

export interface AppMeta {
  isSample: boolean;
  sampleBannerDismissed: boolean;
}

export interface AppState {
  courses: Course[];
  exams: Exam[];
  sessions: SessionArchive[];
  attendance: AttendanceRecord[];
  holidays: Holiday[];
  reminders: Reminder[];
  units: SyllabusUnit[];
  topics: SyllabusTopic[];
  logs: ActivityLog[];
  meta: AppMeta;
}

export interface MarkPayload {
  courseId: string;
  date: string;
  slotId: string | null;
  slotLabel: string;
  startTime: string;
  endTime: string;
  isExtra: boolean;
  recordId?: string;
  status: MarkStatus | null;
}
