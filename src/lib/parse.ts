import type { Course, TimeSlot, Weekday } from "../types";
import { COURSE_COLORS, WEEKDAY_SHORT } from "./constants";
import { normalizeTime, parseLooseDate, parseTimeRange, todayStr } from "./dates";
import { uid } from "./ids";

export interface ParsedCourse {
  course: Omit<Course, "id" | "createdAt" | "updatedAt">;
  warnings: string[];
}

export interface ParseIssue {
  line: string;
  message: string;
}

const DAY_INDEX: Record<string, Weekday> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function parseSlotChunk(chunk: string): TimeSlot | null {
  const text = chunk.trim().replace(/^,\s*/, "");
  if (!text) return null;
  const match = text.match(
    /^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?(?:\s+([A-Za-z][A-Za-z0-9 &/-]{0,24}))?$/i,
  );
  if (!match) return null;
  const start = normalizeTime(match[2], match[3] || match[5]);
  const end = normalizeTime(match[4], match[5] || match[3]);
  if (!start || !end || end <= start) return null;
  const day = DAY_INDEX[match[1].slice(0, 3).toLowerCase()];
  return {
    id: uid("slot"),
    day,
    startTime: start,
    endTime: end,
    label: (match[6] || "Lecture").trim(),
  };
}

export function parseSlots(raw: string): TimeSlot[] {
  const chunks = raw.split(/;|(?<=\S),\s*(?=(?:sun|mon|tue|wed|thu|fri|sat))/i);
  const slots: TimeSlot[] = [];
  for (const chunk of chunks) {
    const slot = parseSlotChunk(chunk);
    if (slot) slots.push(slot);
  }
  return slots;
}

export function parseTimetable(text: string, ref = new Date()): { courses: ParsedCourse[]; issues: ParseIssue[] } {
  const courses: ParsedCourse[] = [];
  const issues: ParseIssue[] = [];
  const lines = text.split(/\n/);
  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const fields = line.split("|").map((f) => f.trim()).filter(Boolean);
    if (!fields.length) return;
    const slotField = fields.find((f) => /(mon|tue|wed|thu|fri|sat|sun)/i.test(f) && /\d/.test(f));
    const slots = slotField ? parseSlots(slotField) : [];
    if (!slots.length) {
      issues.push({ line, message: "No weekly slots found. Use Mon 09:00-10:30 Lecture." });
      return;
    }
    const rest = fields.filter((f) => f !== slotField);
    const targetField = rest.find((f) => /^\d{2,3}%?$/.test(f));
    const dateField = rest.find((f) => Boolean(parseLooseDate(f, ref)));
    const meta = rest.filter((f) => f !== targetField && f !== dateField);
    const head = meta[0] ?? "";
    let code = "";
    let name = "";
    if (head.includes(" ") && !head.includes("|")) {
      const [first, ...restName] = head.split(/\s+/);
      if (/^[A-Za-z]{1,6}\d{2,4}[A-Za-z]?$/.test(first) && restName.length) {
        code = first.toUpperCase();
        name = restName.join(" ");
      }
    }
    if (!code) {
      code = (meta[0] || "COURSE").slice(0, 12).toUpperCase();
      name = meta[1] || meta[0] || code;
    }
    const instructor = code === (meta[0] || "").toUpperCase() ? meta[1] && meta[1] !== name ? "" : meta[2] || "" : meta[2] || "";
    const location = meta.length >= 4 ? meta[3] : "";
    const target = targetField ? Math.min(100, Math.max(1, Number(targetField.replace("%", "")))) : 75;
    const sessionStartDate = dateField ? parseLooseDate(dateField, ref) || todayStr(ref) : todayStr(ref);
    const warnings: string[] = [];
    if (!meta[1] && !name) warnings.push("Name missing — used the code.");
    courses.push({
      course: {
        name: name || code,
        code,
        color: COURSE_COLORS[courses.length % COURSE_COLORS.length],
        instructor: instructor || "",
        location: location || "",
        slots,
        targetAttendance: target,
        sessionStartDate,
      },
      warnings,
    });
  });
  return { courses, issues };
}

export function describeSlots(slots: TimeSlot[]): string {
  return slots
    .map((s) => `${WEEKDAY_SHORT[s.day]} ${s.startTime}-${s.endTime}${s.label ? ` ${s.label}` : ""}`)
    .join(" · ");
}

function matchCourse(token: string, courses: Course[]): Course | undefined {
  const t = token.trim().toLowerCase();
  if (!t) return undefined;
  return (
    courses.find((c) => c.code.toLowerCase() === t) ||
    courses.find((c) => c.name.toLowerCase() === t) ||
    courses.find((c) => c.code.toLowerCase() === t.split(/\s+/)[0])
  );
}

export interface ParsedExam {
  subject: string;
  courseId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  notes: string;
  linked: boolean;
}

export function parseExamList(text: string, courses: Course[], ref = new Date()): { exams: ParsedExam[]; issues: ParseIssue[] } {
  const exams: ParsedExam[] = [];
  const issues: ParseIssue[] = [];
  text.split(/\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const fields = line.split(/[|,]/).map((f) => f.trim()).filter(Boolean);
    if (fields.length < 2) {
      issues.push({ line, message: "Need at least a subject and a date." });
      return;
    }
    const dateField = fields.find((f) => Boolean(parseLooseDate(f, ref)));
    if (!dateField) {
      issues.push({ line, message: "Couldn't read the date." });
      return;
    }
    const date = parseLooseDate(dateField, ref)!;
    const timeField = fields.find((f) => f !== dateField && Boolean(parseTimeRange(f)));
    const times = timeField ? parseTimeRange(timeField)! : { start: "09:00", end: "12:00" };
    const subjectField = fields.find((f) => f !== dateField && f !== timeField) || "Exam";
    const leftovers = fields.filter((f) => f !== dateField && f !== timeField && f !== subjectField);
    const venue = leftovers[0] || "";
    const notes = leftovers.slice(1).join(" · ");
    const course = matchCourse(subjectField, courses);
    exams.push({
      subject: course ? course.name : subjectField,
      courseId: course?.id ?? null,
      date,
      startTime: times.start,
      endTime: times.end === times.start ? times.start : times.end,
      venue,
      notes,
      linked: Boolean(course),
    });
  });
  return { exams, issues };
}

export interface ParsedTopicGroup {
  unit: string;
  topics: string[];
}

export function parseTopicList(text: string): ParsedTopicGroup[] {
  const groups: ParsedTopicGroup[] = [];
  let current: ParsedTopicGroup = { unit: "General", topics: [] };
  const pushCurrent = () => {
    if (current.topics.length) groups.push(current);
  };
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const unitLike =
      /^(unit|module|chapter)\b/i.test(line) ||
      (/:\s*$/.test(line) && line.length < 70 && !line.startsWith("-") && !line.startsWith("*"));
    if (unitLike) {
      pushCurrent();
      current = { unit: line.replace(/:\s*$/, "").replace(/^[-*•]\s*/, ""), topics: [] };
      continue;
    }
    current.topics.push(line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, ""));
  }
  pushCurrent();
  return groups;
}
