import type { ActivityLog, AppState, AttendanceRecord, Course, Exam, Holiday, Reminder, SyllabusTopic, SyllabusUnit, TimeSlot } from "../types";
import { computeSessionStats, holidayOn, isBelowTarget, classesToRecover, classesYouCanMiss } from "../lib/attendance";
import { addDaysStr, stamp, todayStr, weekdayOf } from "../lib/dates";
import { uid } from "../lib/ids";

function slot(id: string, day: number, start: string, end: string, label: string): TimeSlot {
  return { id, day: day as TimeSlot["day"], startTime: start, endTime: end, label };
}

function mark(
  course: Course,
  date: string,
  slotId: string,
  label: string,
  start: string,
  end: string,
  status: AttendanceRecord["status"],
  extra = false,
): AttendanceRecord {
  return {
    id: uid("att"),
    courseId: course.id,
    date,
    slotId: extra ? null : slotId,
    slotLabel: label,
    startTime: start,
    endTime: end,
    status,
    isExtra: extra,
    createdAt: stamp(date, start),
    updatedAt: stamp(date, start),
  };
}

function occurrences(course: Course, start: string, end: string, holidays: Holiday[]) {
  const out: { date: string; slot: TimeSlot }[] = [];
  if (end < start) return out;
  let date = start;
  let guard = 0;
  while (date <= end && guard < 800) {
    if (!holidayOn(date, holidays)) {
      const dow = weekdayOf(date);
      for (const s of course.slots) if (s.day === dow) out.push({ date, slot: s });
    }
    date = addDaysStr(date, 1);
    guard += 1;
  }
  return out;
}

function presentRecords(course: Course, rows: { date: string; slot: TimeSlot }[]): AttendanceRecord[] {
  return rows.map((row) => mark(course, row.date, row.slot.id, row.slot.label, row.slot.startTime, row.slot.endTime, "present"));
}

function findClassDate(course: Course, start: string, end: string, holidays: Holiday[], today: string): string | null {
  let date = end;
  let guard = 0;
  while (date >= start && guard < 800) {
    const dow = weekdayOf(date);
    if (date < today && course.slots.some((s) => s.day === dow) && !holidayOn(date, holidays)) return date;
    date = addDaysStr(date, -1);
    guard += 1;
  }
  return null;
}

function findFreeDate(course: Course, start: string, end: string, today: string): string | null {
  let date = end;
  let guard = 0;
  while (date >= start && guard < 400) {
    if (date < today && !course.slots.some((s) => s.day === weekdayOf(date))) return date;
    date = addDaysStr(date, -1);
    guard += 1;
  }
  return null;
}

/**
 * A living semester relative to "today", so the preview always has
 * something to mark, an at-risk course, a closed session, and a near exam.
 */
export function createSampleState(now = new Date()): AppState {
  const today = todayStr(now);
  const yesterday = addDaysStr(today, -1);
  const dow = now.getDay();
  const ago = (n: number) => addDaysStr(today, -n);
  const ahead = (n: number) => addDaysStr(today, n);

  const algo: Course = {
    id: "c_algo",
    name: "Algorithms",
    code: "CS201",
    color: "#7b6cff",
    instructor: "Prof. Ananya Iyer",
    location: "LH-204",
    slots: [
      slot("a1", dow, "09:00", "10:20", "Lecture"),
      slot("a2", (dow + 2) % 7, "09:00", "10:20", "Lecture"),
      slot("a3", (dow + 4) % 7, "15:00", "16:20", "Tutorial"),
    ],
    targetAttendance: 75,
    sessionStartDate: ago(42),
    createdAt: stamp(ago(42), "08:00"),
    updatedAt: stamp(ago(15), "08:00"),
  };
  const signals: Course = {
    id: "c_sig",
    name: "Signals & Systems",
    code: "EE210",
    color: "#5eead4",
    instructor: "Dr. Rohan Menon",
    location: "Lab 3",
    slots: [
      slot("s1", dow, "11:00", "12:00", "Lecture"),
      slot("s2", dow, "14:00", "15:30", "Lab"),
      slot("s3", (dow + 3) % 7, "11:00", "12:15", "Lecture"),
    ],
    targetAttendance: 75,
    sessionStartDate: ago(20),
    createdAt: stamp(ago(20), "08:10"),
    updatedAt: stamp(ago(20), "08:10"),
  };
  const discrete: Course = {
    id: "c_disc",
    name: "Discrete Math",
    code: "MA118",
    color: "#f0abfc",
    instructor: "Prof. Leila Shah",
    location: "Room 12",
    slots: [
      slot("d1", (dow + 1) % 7, "10:00", "11:30", "Lecture"),
      slot("d2", (dow + 3) % 7, "10:00", "11:30", "Lecture"),
      slot("d3", (dow + 5) % 7, "10:00", "11:15", "Tutorial"),
    ],
    targetAttendance: 75,
    sessionStartDate: ago(36),
    createdAt: stamp(ago(36), "08:20"),
    updatedAt: stamp(ago(36), "08:20"),
  };
  const writing: Course = {
    id: "c_writ",
    name: "Academic Writing",
    code: "HS105",
    color: "#fdba74",
    instructor: "Ms. Kapoor",
    location: "Seminar B",
    slots: [slot("w1", (dow + 1) % 7, "16:00", "17:20", "Seminar")],
    targetAttendance: 60,
    sessionStartDate: ago(21),
    createdAt: stamp(ago(21), "08:30"),
    updatedAt: stamp(ago(21), "08:30"),
  };

  const courses = [algo, signals, discrete, writing];
  const holidayDate = findClassDate(discrete, ago(30), yesterday, [], today) ?? ago(8);
  const holidays: Holiday[] = [
    {
      id: "h_found",
      title: "Foundation Day",
      kind: "holiday",
      startDate: holidayDate,
      endDate: holidayDate,
      notes: "Campus closed. Lectures that day are not expected.",
      createdAt: stamp(ago(31), "12:00"),
    },
    {
      id: "h_personal",
      title: "Clinic appointment",
      kind: "personal",
      startDate: ahead(4),
      endDate: ahead(4),
      notes: "Personal day — classes that meet are excluded.",
      createdAt: stamp(ago(2), "19:00"),
    },
    {
      id: "h_break",
      title: "Long weekend",
      kind: "break",
      startDate: ahead(20),
      endDate: ahead(22),
      notes: "",
      createdAt: stamp(ago(1), "11:00"),
    },
  ];

  const midDate = ago(16);
  const exams: Exam[] = [
    {
      id: "e_mid",
      courseId: algo.id,
      subject: "Mid-sem",
      date: midDate,
      startTime: "09:00",
      endTime: "12:00",
      venue: "Hall A",
      notes: "Closed the first attendance session.",
      createdAt: stamp(ago(30), "10:00"),
    },
    {
      id: "e_internal",
      courseId: algo.id,
      subject: "Internal 2",
      date: ahead(6),
      startTime: "09:30",
      endTime: "11:00",
      venue: "LH-204",
      notes: "Graphs + shortest paths.",
      createdAt: stamp(ago(3), "16:00"),
    },
    {
      id: "e_viva",
      courseId: signals.id,
      subject: "Lab viva",
      date: ahead(11),
      startTime: "14:00",
      endTime: "16:00",
      venue: "Lab 3",
      notes: "",
      createdAt: stamp(ago(2), "15:00"),
    },
    {
      id: "e_quiz",
      courseId: discrete.id,
      subject: "Quiz 2",
      date: ahead(19),
      startTime: "10:00",
      endTime: "11:00",
      venue: "Room 12",
      notes: "",
      createdAt: stamp(ago(1), "09:40"),
    },
  ];

  const closedRows = occurrences(algo, algo.sessionStartDate, midDate, holidays);
  const closedRecords = presentRecords(algo, closedRows);
  closedRecords.forEach((rec, i) => {
    if (i % 7 === 6) rec.status = "absent";
  });

  const openStart = addDaysStr(midDate, 1);
  algo.sessionStartDate = openStart;
  const openRows = occurrences(algo, openStart, yesterday, holidays);
  const openRecords = presentRecords(algo, openRows);
  let guard = 0;
  while (guard < 24) {
    guard += 1;
    const stats = computeSessionStats({ attendance: openRecords, holidays }, algo, openStart, yesterday, today);
    const below = isBelowTarget(stats, algo.targetAttendance);
    const recover = classesToRecover(stats, algo.targetAttendance);
    if (below && recover != null && recover >= 2 && recover <= 5) break;
    if (below && recover != null && recover > 5) {
      const absent = openRecords.find((r) => r.status === "absent");
      if (!absent) break;
      absent.status = "present";
      continue;
    }
    const present = [...openRecords].reverse().find((r) => r.status === "present");
    if (!present) break;
    present.status = "absent";
  }

  const signalRows = occurrences(signals, signals.sessionStartDate, yesterday, holidays);
  const signalRecords = presentRecords(signals, signalRows);
  const cancelTarget = signalRecords.find((r) => r.slotId === "s2");
  if (cancelTarget) cancelTarget.status = "cancelled";
  guard = 0;
  while (guard < 20) {
    guard += 1;
    const stats = computeSessionStats({ attendance: signalRecords, holidays }, signals, signals.sessionStartDate, yesterday, today);
    const miss = classesYouCanMiss(stats, signals.targetAttendance);
    const below = isBelowTarget(stats, signals.targetAttendance);
    if (!below && miss != null && miss <= 1) break;
    if (below) {
      const absent = signalRecords.find((r) => r.status === "absent");
      if (!absent) break;
      absent.status = "present";
      continue;
    }
    const present = signalRecords.find((r) => r.status === "present" && r.slotId !== "s2");
    if (!present) break;
    present.status = "absent";
  }

  const discRecords = presentRecords(discrete, occurrences(discrete, discrete.sessionStartDate, yesterday, holidays));
  const writeRecords = presentRecords(writing, occurrences(writing, writing.sessionStartDate, yesterday, holidays));
  const extraDate = findFreeDate(writing, ago(12), yesterday, today) ?? ago(3);
  const extra = mark(writing, extraDate, "extra", "Makeup seminar", "18:00", "19:00", "present", true);

  const attendance = [...closedRecords, ...openRecords, ...signalRecords, ...discRecords, ...writeRecords, extra];

  const closedStats = computeSessionStats({ attendance, holidays }, algo, ago(42), midDate, today);
  const sessions = [
    {
      id: "ses_algo_1",
      courseId: algo.id,
      sessionNumber: 1,
      startDate: ago(42),
      endDate: midDate,
      examId: "e_mid",
      attended: closedStats.attended,
      scheduled: closedStats.scheduled,
      percentage: closedStats.percentage ?? 0,
      closedAt: stamp(openStart, "00:10"),
    },
  ];

  const reminders: Reminder[] = [
    {
      id: "r_lab",
      title: "Lab notebook submission",
      type: "lab",
      courseId: signals.id,
      dueDate: ago(1),
      dueTime: "17:00",
      priority: "high",
      notes: "Include the sampling experiment plots.",
      remindDaysBefore: 1,
      completed: false,
      notified: true,
      createdAt: stamp(ago(6), "12:00"),
      updatedAt: stamp(ago(6), "12:00"),
    },
    {
      id: "r_pset",
      title: "Problem set 5",
      type: "assignment",
      courseId: algo.id,
      dueDate: ahead(1),
      dueTime: "18:00",
      priority: "medium",
      notes: "Dijkstra and MST. Show working.",
      remindDaysBefore: 1,
      completed: false,
      notified: false,
      createdAt: stamp(ago(2), "20:00"),
      updatedAt: stamp(ago(2), "20:00"),
    },
    {
      id: "r_essay",
      title: "Essay outline",
      type: "assignment",
      courseId: writing.id,
      dueDate: ahead(3),
      dueTime: "23:00",
      priority: "low",
      notes: "One page. Claim, stakes, sources.",
      remindDaysBefore: 2,
      completed: false,
      notified: false,
      createdAt: stamp(ago(4), "18:30"),
      updatedAt: stamp(ago(4), "18:30"),
    },
    {
      id: "r_done",
      title: "Worksheet 2",
      type: "quiz",
      courseId: discrete.id,
      dueDate: ago(5),
      dueTime: "10:00",
      priority: "medium",
      notes: "",
      remindDaysBefore: 1,
      completed: true,
      notified: true,
      createdAt: stamp(ago(12), "09:00"),
      updatedAt: stamp(ago(5), "09:10"),
    },
  ];

  const units: SyllabusUnit[] = [
    { id: "u_a1", courseId: algo.id, name: "Unit 1 · Divide and conquer", order: 0 },
    { id: "u_a2", courseId: algo.id, name: "Unit 2 · Graphs", order: 1 },
    { id: "u_s1", courseId: signals.id, name: "Unit 1 · Fourier", order: 0 },
    { id: "u_s2", courseId: signals.id, name: "Unit 2 · Sampling", order: 1 },
    { id: "u_d1", courseId: discrete.id, name: "Unit 1 · Logic", order: 0 },
    { id: "u_d2", courseId: discrete.id, name: "Unit 2 · Sets & relations", order: 1 },
    { id: "u_w1", courseId: writing.id, name: "Unit 1 · Argument", order: 0 },
  ];

  const topic = (id: string, unitId: string, courseId: string, title: string, status: SyllabusTopic["status"], order: number): SyllabusTopic => ({
    id,
    unitId,
    courseId,
    title,
    status,
    order,
  });
  const topics: SyllabusTopic[] = [
    topic("t1", "u_a1", algo.id, "Merge sort", "done", 0),
    topic("t2", "u_a1", algo.id, "Quicksort", "done", 1),
    topic("t3", "u_a1", algo.id, "Recurrences", "done", 2),
    topic("t4", "u_a2", algo.id, "BFS and DFS", "in_progress", 0),
    topic("t5", "u_a2", algo.id, "Shortest paths", "pending", 1),
    topic("t6", "u_a2", algo.id, "Minimum spanning trees", "pending", 2),
    topic("t7", "u_a2", algo.id, "Topological order", "pending", 3),
    topic("t8", "u_s1", signals.id, "Fourier series", "done", 0),
    topic("t9", "u_s1", signals.id, "Fourier transform", "done", 1),
    topic("t10", "u_s2", signals.id, "Sampling theorem", "in_progress", 0),
    topic("t11", "u_s2", signals.id, "Aliasing", "pending", 1),
    topic("t12", "u_d1", discrete.id, "Propositional logic", "done", 0),
    topic("t13", "u_d1", discrete.id, "Predicates", "done", 1),
    topic("t14", "u_d2", discrete.id, "Set operations", "in_progress", 0),
    topic("t15", "u_d2", discrete.id, "Relations", "pending", 1),
    topic("t16", "u_w1", writing.id, "Claims and stakes", "pending", 0),
    topic("t17", "u_w1", writing.id, "Source synthesis", "pending", 1),
  ];

  const logs: ActivityLog[] = [
    { id: "l1", action: "create", entity: "reminder", summary: "Added reminder “Problem set 5” for CS201.", timestamp: stamp(ago(2), "20:00") },
    { id: "l2", action: "mark", entity: "attendance", summary: "Marked EE210 Lab cancelled.", timestamp: stamp(ago(3), "14:05") },
    { id: "l3", action: "mark", entity: "attendance", summary: "Logged a makeup seminar for HS105.", timestamp: stamp(extraDate, "18:05") },
    { id: "l4", action: "create", entity: "exam", summary: "Added Internal 2 for Algorithms.", timestamp: stamp(ago(3), "16:00") },
    { id: "l5", action: "update", entity: "session", summary: `CS201 session 1 closed by Mid-sem (${ago(42).slice(5)}–${midDate.slice(5)}).`, timestamp: stamp(openStart, "00:10") },
    { id: "l6", action: "create", entity: "holiday", summary: "Marked Foundation Day.", timestamp: stamp(ago(31), "12:00") },
    { id: "l7", action: "create", entity: "course", summary: "Added Algorithms, Signals & Systems, Discrete Math, and Academic Writing.", timestamp: stamp(ago(42), "08:00") },
  ];
  logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return {
    courses,
    exams,
    sessions,
    attendance,
    holidays,
    reminders,
    units,
    topics,
    logs,
    meta: { isSample: true, sampleBannerDismissed: false },
  };
}
