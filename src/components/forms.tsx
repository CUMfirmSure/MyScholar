import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { COURSE_COLORS, HOLIDAY_KINDS, PRIORITIES, REMINDER_TYPES, WEEKDAY_LONG } from "../lib/constants";
import { formatPretty, timeToMinutes, todayStr } from "../lib/dates";
import { uid } from "../lib/ids";
import { describeSlots, parseExamList, parseSlots, parseTimetable, parseTopicList } from "../lib/parse";
import type { Course, Exam, Holiday, HolidayKind, MarkStatus, Priority, Reminder, ReminderType, TimeSlot, Weekday } from "../types";
import { BottomSheet, Field, PressButton, Segmented, TriState } from "./ui";

function errText(message: string) {
  return <p className="text-sm text-rose-300">{message}</p>;
}

export function SheetHost() {
  const { sheet, closeSheet, state } = useApp();
  const course = sheet?.kind === "course" && sheet.id ? state.courses.find((c) => c.id === sheet.id) : undefined;
  const reminder = sheet?.kind === "reminder" && sheet.id ? state.reminders.find((r) => r.id === sheet.id) : undefined;
  const exam = sheet?.kind === "exam" && sheet.id ? state.exams.find((e) => e.id === sheet.id) : undefined;
  const holiday = sheet?.kind === "holiday" && sheet.id ? state.holidays.find((h) => h.id === sheet.id) : undefined;
  return (
    <>
      <BottomSheet open={sheet?.kind === "course"} onClose={closeSheet} title={course ? "Edit course" : "Add course"} subtitle="A course can meet more than once on the same day. Each slot is marked separately." footer={<button form="course-form" className="btn btn-primary press w-full" type="submit">{course ? "Save course" : "Add course"}</button>}>
        {sheet?.kind === "course" ? <CourseForm existing={course} /> : null}
      </BottomSheet>
      <BottomSheet open={sheet?.kind === "reminder"} onClose={closeSheet} title={reminder ? "Edit reminder" : "New reminder"} subtitle="ScholarFlow reminds you on this device when the window opens." footer={<button form="reminder-form" className="btn btn-primary press w-full" type="submit">Save reminder</button>}>
        {sheet?.kind === "reminder" ? <ReminderForm existing={reminder} /> : null}
      </BottomSheet>
      <BottomSheet open={sheet?.kind === "exam"} onClose={closeSheet} title={exam ? "Edit exam" : "Add exam"} subtitle="A linked exam closes that course's open attendance session the day after it is held. The exam date itself still counts." footer={<button form="exam-form" className="btn btn-primary press w-full" type="submit">Save</button>}>
        {sheet?.kind === "exam" ? <ExamForm existing={exam} bulk={sheet.bulk} /> : null}
      </BottomSheet>
      <BottomSheet open={sheet?.kind === "holiday"} onClose={closeSheet} title={holiday ? "Edit day off" : "Mark holiday"} subtitle="Holiday, break, and personal days are excluded from every course that would have met." footer={<button form="holiday-form" className="btn btn-primary press w-full" type="submit">Save</button>}>
        {sheet?.kind === "holiday" ? <HolidayForm existing={holiday} date={sheet.date} /> : null}
      </BottomSheet>
      <BottomSheet open={sheet?.kind === "topics"} onClose={closeSheet} title="Add topics" subtitle="Paste a unit list or add a handful of lines. Status starts as pending." footer={<button form="topics-form" className="btn btn-primary press w-full" type="submit">Add topics</button>}>
        {sheet?.kind === "topics" ? <TopicsForm courseId={sheet.courseId} /> : null}
      </BottomSheet>
      <BottomSheet open={sheet?.kind === "import"} onClose={closeSheet} title="Import timetable" subtitle="One course per line. Duplicate codes are skipped." footer={<button form="import-form" className="btn btn-primary press w-full" type="submit">Import</button>}>
        {sheet?.kind === "import" ? <ImportForm /> : null}
      </BottomSheet>
      <BottomSheet open={sheet?.kind === "extra"} onClose={closeSheet} title="Extra lecture" subtitle="Use this for a makeup on a day the course doesn't normally meet. It counts toward the open session, and it won't rewrite the weekly timetable." footer={<button form="extra-form" className="btn btn-primary press w-full" type="submit">Save extra lecture</button>}>
        {sheet?.kind === "extra" ? <ExtraForm date={sheet.date} courseId={sheet.courseId} /> : null}
      </BottomSheet>
      <BottomSheet open={sheet?.kind === "session"} onClose={closeSheet} title="Session start" subtitle="The open session counts lectures from this date through today. Archived sessions stay as they were." footer={<button form="session-form" className="btn btn-primary press w-full" type="submit">Update start date</button>}>
        {sheet?.kind === "session" ? <SessionForm courseId={sheet.courseId} /> : null}
      </BottomSheet>
    </>
  );
}

function CourseForm({ existing }: { existing?: Course }) {
  const { saveCourse, deleteCourse, closeSheet, askConfirm, today } = useApp();
  const [name, setName] = useState(existing?.name ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [color, setColor] = useState(existing?.color ?? COURSE_COLORS[0]);
  const [instructor, setInstructor] = useState(existing?.instructor ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [target, setTarget] = useState(existing?.targetAttendance ?? 75);
  const [sessionStartDate, setSessionStartDate] = useState(existing?.sessionStartDate ?? today);
  const [slots, setSlots] = useState<TimeSlot[]>(existing?.slots ?? [{ id: uid("slot"), day: new Date().getDay() as Weekday, startTime: "09:00", endTime: "10:30", label: "Lecture" }]);
  const [error, setError] = useState("");

  const updateSlot = (id: string, patch: Partial<TimeSlot>) => setSlots((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <form
      id="course-form"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !code.trim()) return setError("Name and short code are required.");
        if (slots.some((s) => timeToMinutes(s.endTime) <= timeToMinutes(s.startTime))) return setError("Each slot needs an end time after its start.");
        const now = new Date().toISOString();
        saveCourse({
          id: existing?.id ?? uid("course"),
          name: name.trim(),
          code: code.trim().toUpperCase(),
          color,
          instructor: instructor.trim(),
          location: location.trim(),
          slots,
          targetAttendance: target,
          sessionStartDate,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }, !existing);
        closeSheet();
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2"><Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Algorithms" /></Field></div>
        <Field label="Code"><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS201" /></Field>
      </div>
      <Field label="Color">
        <div className="flex gap-2">
          {COURSE_COLORS.map((swatch) => (
            <button key={swatch} type="button" aria-label={swatch} onClick={() => setColor(swatch)} className="h-8 w-8 rounded-full press" style={{ background: swatch, outline: color === swatch ? "2px solid white" : "2px solid transparent", outlineOffset: 2 }} />
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Instructor"><input className="input" value={instructor} onChange={(e) => setInstructor(e.target.value)} placeholder="Prof. Iyer" /></Field>
        <Field label="Location"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="LH-204" /></Field>
      </div>
      <Field label={`Target ${target}%`} hint="Used for the miss / recover advice on the open session.">
        <input type="range" min={50} max={100} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full accent-[#7b6cff]" />
      </Field>
      <Field label="Session start" hint="Lectures before this date are not part of the open session.">
        <input type="date" className="input" value={sessionStartDate} onChange={(e) => setSessionStartDate(e.target.value)} />
      </Field>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="kicker text-white/55">Weekly slots</span>
          <PressButton className="text-xs font-semibold text-[#c4b8ff]" onClick={() => setSlots((list) => [...list, { id: uid("slot"), day: list[0]?.day ?? 1, startTime: "11:00", endTime: "12:00", label: "Lecture" }])}>Add slot</PressButton>
        </div>
        {slots.map((slot, index) => (
          <div key={slot.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Slot {index + 1}</span>
              {slots.length > 1 ? <button type="button" className="text-rose-300" onClick={() => setSlots((list) => list.filter((s) => s.id !== slot.id))}>Remove</button> : null}
            </div>
            <select className="select" value={slot.day} onChange={(e) => updateSlot(slot.id, { day: Number(e.target.value) as Weekday })}>
              {WEEKDAY_LONG.map((day, i) => <option key={day} value={i}>{day}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="time" className="input" value={slot.startTime} onChange={(e) => updateSlot(slot.id, { startTime: e.target.value })} />
              <input type="time" className="input" value={slot.endTime} onChange={(e) => updateSlot(slot.id, { endTime: e.target.value })} />
            </div>
            <input className="input" value={slot.label} onChange={(e) => updateSlot(slot.id, { label: e.target.value })} placeholder="Lecture, Lab, Tutorial" />
          </div>
        ))}
      </div>
      {error ? errText(error) : null}
      {existing ? (
        <PressButton className="btn btn-danger w-full" onClick={() => askConfirm({ title: "Delete course?", body: "Attendance, session history, and syllabus for this course will be removed. Exams and reminders stay, unlinked.", confirmLabel: "Delete course", danger: true, onConfirm: () => { deleteCourse(existing.id); closeSheet(); } })}>Delete course</PressButton>
      ) : null}
    </form>
  );
}

function ReminderForm({ existing }: { existing?: Reminder }) {
  const { state, saveReminder, deleteReminder, closeSheet, askConfirm, today } = useApp();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [type, setType] = useState<ReminderType>(existing?.type ?? "assignment");
  const [courseId, setCourseId] = useState(existing?.courseId ?? "");
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? today);
  const [dueTime, setDueTime] = useState(existing?.dueTime ?? "18:00");
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? "medium");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [remindDaysBefore, setRemindDaysBefore] = useState(existing?.remindDaysBefore ?? 1);
  const [error, setError] = useState("");
  return (
    <form id="reminder-form" className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      if (!title.trim()) return setError("Give the reminder a title.");
      if (!dueDate) return setError("Pick a due date.");
      const now = new Date().toISOString();
      saveReminder({
        id: existing?.id ?? uid("rem"),
        title: title.trim(),
        type,
        courseId: courseId || null,
        dueDate,
        dueTime,
        priority,
        notes: notes.trim(),
        remindDaysBefore,
        completed: existing?.completed ?? false,
        notified: existing ? existing.notified && existing.dueDate === dueDate && existing.remindDaysBefore === remindDaysBefore : false,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }, !existing);
      closeSheet();
    }}>
      <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Problem set 5" /></Field>
      <Field label="Type"><Segmented value={type} options={REMINDER_TYPES} onChange={setType} /></Field>
      <Field label="Course">
        <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">No course</option>
          {state.courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Due date"><input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        <Field label="Time"><input type="time" className="input" value={dueTime} onChange={(e) => setDueTime(e.target.value)} /></Field>
      </div>
      <Field label="Priority"><Segmented value={priority} options={PRIORITIES} onChange={setPriority} /></Field>
      <Field label="Remind me" hint="0 means at the due time. Notifications fire while the app is open.">
        <input type="number" min={0} max={30} className="input" value={remindDaysBefore} onChange={(e) => setRemindDaysBefore(Number(e.target.value))} />
      </Field>
      <Field label="Notes"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What does done look like?" /></Field>
      {error ? errText(error) : null}
      {existing ? <PressButton className="btn btn-danger w-full" onClick={() => askConfirm({ title: "Delete reminder?", body: existing.title, confirmLabel: "Delete", danger: true, onConfirm: () => { deleteReminder(existing.id); closeSheet(); } })}>Delete reminder</PressButton> : null}
    </form>
  );
}

function ExamForm({ existing, bulk }: { existing?: Exam; bulk?: boolean }) {
  const { state, saveExam, saveExams, deleteExam, closeSheet, askConfirm, today, pushToast } = useApp();
  const [mode, setMode] = useState<"one" | "paste">(bulk ? "paste" : "one");
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [courseId, setCourseId] = useState(existing?.courseId ?? state.courses[0]?.id ?? "");
  const [date, setDate] = useState(existing?.date ?? today);
  const [startTime, setStartTime] = useState(existing?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(existing?.endTime ?? "12:00");
  const [venue, setVenue] = useState(existing?.venue ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const preview = useMemo(() => parseExamList(paste, state.courses), [paste, state.courses]);
  return (
    <form id="exam-form" className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      if (mode === "paste" && !existing) {
        if (!preview.exams.length) return setError(preview.issues[0]?.message ?? "Nothing to import.");
        saveExams(preview.exams.map((exam) => ({
          id: uid("exam"),
          courseId: exam.courseId,
          subject: exam.subject,
          date: exam.date,
          startTime: exam.startTime,
          endTime: exam.endTime,
          venue: exam.venue,
          notes: exam.notes,
          createdAt: new Date().toISOString(),
        })));
        pushToast({ title: `Added ${preview.exams.length} exams`, body: "Linked exams close their session the day after." });
        closeSheet();
        return;
      }
      if (!subject.trim()) return setError("Subject is required.");
      if (!date) return setError("Date is required.");
      if (timeToMinutes(endTime) < timeToMinutes(startTime)) return setError("End time is before the start.");
      saveExam({
        id: existing?.id ?? uid("exam"),
        courseId: courseId || null,
        subject: subject.trim(),
        date,
        startTime,
        endTime,
        venue: venue.trim(),
        notes: notes.trim(),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      }, !existing);
      closeSheet();
    }}>
      {!existing ? <Segmented value={mode} options={[{ id: "one", label: "One exam" }, { id: "paste", label: "Paste list" }]} onChange={setMode} /> : null}
      {mode === "one" || existing ? (
        <>
          <Field label="Subject"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Internal 2" /></Field>
          <Field label="Linked course" hint="Leave unlinked if this exam should not close a session.">
            <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">No course</option>
              {state.courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start"><input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
            <Field label="End"><input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>
          </div>
          <Field label="Venue"><input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Hall A" /></Field>
          <Field label="Notes"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </>
      ) : (
        <>
          <Field label="List" hint="Subject | date | 09:00-12:00 | venue | notes. A code or exact course name links the exam.">
            <textarea className="textarea" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"CS201 | 2026-04-12 | 09:00-12:00 | Hall A | End-sem\nSignals | 18 Apr | 14:00-16:00 | Lab 3"} />
          </Field>
          <div className="space-y-2">
            {preview.exams.map((exam, i) => (
              <div key={`${exam.date}-${i}`} className="rounded-2xl border border-white/8 px-3 py-2 text-sm">
                <div className="font-medium">{exam.subject}</div>
                <div className="text-white/60">{formatPretty(exam.date)} · {exam.startTime}–{exam.endTime} {exam.venue ? `· ${exam.venue}` : ""}</div>
                <div className={exam.linked ? "text-emerald-300" : "text-amber-200"}>{exam.linked ? "Will close that course's session the day after" : "Not linked — won't close a session"}</div>
              </div>
            ))}
            {preview.issues.map((issue) => <p key={issue.line} className="text-xs text-rose-300">{issue.message}</p>)}
          </div>
        </>
      )}
      {error ? errText(error) : null}
      {existing ? <PressButton className="btn btn-danger w-full" onClick={() => askConfirm({ title: "Delete exam?", body: "If this exam already closed a session, that history stays.", confirmLabel: "Delete exam", danger: true, onConfirm: () => { deleteExam(existing.id); closeSheet(); } })}>Delete exam</PressButton> : null}
    </form>
  );
}

function HolidayForm({ existing, date }: { existing?: Holiday; date?: string }) {
  const { saveHoliday, deleteHoliday, closeSheet, askConfirm, today } = useApp();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [kind, setKind] = useState<HolidayKind>(existing?.kind ?? "holiday");
  const [startDate, setStartDate] = useState(existing?.startDate ?? date ?? today);
  const [endDate, setEndDate] = useState(existing?.endDate ?? date ?? today);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState("");
  return (
    <form id="holiday-form" className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      if (!title.trim()) return setError("Name the day off.");
      if (endDate < startDate) return setError("End date is before the start.");
      saveHoliday({
        id: existing?.id ?? uid("hol"),
        title: title.trim(),
        kind,
        startDate,
        endDate,
        notes: notes.trim(),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      }, !existing);
      closeSheet();
    }}>
      <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Foundation Day" /></Field>
      <Field label="Kind"><Segmented value={kind} options={HOLIDAY_KINDS} onChange={setKind} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Start"><input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label="End"><input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      {error ? errText(error) : null}
      {existing ? <PressButton className="btn btn-danger w-full" onClick={() => askConfirm({ title: "Remove this day off?", body: "Lectures on those dates will count again.", confirmLabel: "Remove", danger: true, onConfirm: () => { deleteHoliday(existing.id); closeSheet(); } })}>Remove</PressButton> : null}
    </form>
  );
}

function TopicsForm({ courseId }: { courseId?: string }) {
  const { state, addTopicGroups, closeSheet } = useApp();
  const [selected, setSelected] = useState(courseId || state.courses[0]?.id || "");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const groups = useMemo(() => parseTopicList(text), [text]);
  const count = groups.reduce((n, g) => n + g.topics.length, 0);
  return (
    <form id="topics-form" className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      if (!selected) return setError("Add a course first.");
      if (!count) return setError("Paste at least one topic.");
      addTopicGroups(selected, groups);
      closeSheet();
    }}>
      <Field label="Course">
        <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {state.courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
        </select>
      </Field>
      <Field label="Topics" hint="Start a line with Unit, Module, Chapter, or end it with a colon to open a new unit.">
        <textarea className="textarea min-h-40" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Unit 1: Introduction\nDefinitions\nExamples\n\nUnit 2: Applications\nCase study"} />
      </Field>
      <p className="text-sm text-white/60">{count} topic{count === 1 ? "" : "s"} across {groups.length} unit{groups.length === 1 ? "" : "s"}</p>
      {error ? errText(error) : null}
    </form>
  );
}

function ImportForm() {
  const { importCourses, closeSheet, pushToast, today } = useApp();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const parsed = useMemo(() => parseTimetable(text), [text]);
  return (
    <form id="import-form" className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      if (!parsed.courses.length) return setError(parsed.issues[0]?.message ?? "No courses found.");
      const now = new Date().toISOString();
      const skipped = importCourses(parsed.courses.map((item, index) => ({
        id: uid("course"),
        ...item.course,
        color: item.course.color || COURSE_COLORS[index % COURSE_COLORS.length],
        sessionStartDate: item.course.sessionStartDate || today,
        createdAt: now,
        updatedAt: now,
      })));
      pushToast({ title: "Timetable imported", body: skipped ? `${skipped} duplicate code${skipped === 1 ? "" : "s"} skipped.` : "Courses added." });
      closeSheet();
    }}>
      <Field label="Paste timetable" hint="CODE | Name | Instructor | Location | Mon 09:00-10:30 Lecture; Wed 14:00-15:30 Lab | 75 | 2026-01-12">
        <textarea className="textarea min-h-36" value={text} onChange={(e) => setText(e.target.value)} placeholder={"CS201 | Algorithms | Prof. Iyer | LH-204 | Mon 09:00-10:30 Lecture; Wed 09:00-10:30 Lecture | 75 | 2026-01-12"} />
      </Field>
      {parsed.courses.map((item) => (
        <div key={item.course.code + item.course.name} className="rounded-2xl border border-white/8 px-3 py-2 text-sm">
          <div className="font-medium">{item.course.code} · {item.course.name}</div>
          <div className="text-white/60">{describeSlots(item.course.slots)}</div>
        </div>
      ))}
      {parsed.issues.map((issue) => <p key={issue.line} className="text-xs text-rose-300">{issue.message} — {issue.line}</p>)}
      {error ? errText(error) : null}
    </form>
  );
}

function ExtraForm({ date, courseId }: { date?: string; courseId?: string }) {
  const { state, setMark, closeSheet, today } = useApp();
  const [selected, setSelected] = useState(courseId || state.courses[0]?.id || "");
  const [when, setWhen] = useState(date || today);
  const [label, setLabel] = useState("Extra");
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:00");
  const [status, setStatus] = useState<MarkStatus>("present");
  const [error, setError] = useState("");
  return (
    <form id="extra-form" className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      if (!selected) return setError("Pick a course.");
      if (!when) return setError("Pick a date.");
      setMark({
        courseId: selected,
        date: when,
        slotId: null,
        slotLabel: label.trim() || "Extra",
        startTime,
        endTime,
        isExtra: true,
        status,
      });
      closeSheet();
    }}>
      <Field label="Course">
        <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {state.courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
        </select>
      </Field>
      <Field label="Date" hint="Any date works, even if this course never meets then.">
        <input type="date" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
      </Field>
      <Field label="Label"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Makeup, Extra, Tutorial" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Start"><input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
        <Field label="End"><input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>
      </div>
      <Field label="Status">
        <TriState value={status} onChange={(next) => next && setStatus(next)} />
      </Field>
      {error ? errText(error) : null}
    </form>
  );
}

function SessionForm({ courseId }: { courseId: string }) {
  const { state, setSessionStart, closeSheet } = useApp();
  const course = state.courses.find((c) => c.id === courseId);
  const [date, setDate] = useState(course?.sessionStartDate ?? todayStr());
  const latest = state.sessions.filter((s) => s.courseId === courseId).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  if (!course) return null;
  return (
    <form id="session-form" className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      setSessionStart(course.id, date);
      closeSheet();
    }}>
      <Field label="Open session starts">
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {latest ? <p className="text-sm text-white/50">Last archived session ended {formatPretty(latest.endDate)}. Starting on or before that date will overlap history — both views will still calculate, but the same lecture can appear in two windows.</p> : null}
      <p className="text-sm text-white/50">A future linked exam does not close this session until the day after it is held.</p>
    </form>
  );
}

export function slotPreview(raw: string) {
  return parseSlots(raw);
}
