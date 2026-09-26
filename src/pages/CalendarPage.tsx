import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { holidayOn, lecturesOn } from "../lib/attendance";
import { formatLong, formatTimeRange, todayStr } from "../lib/dates";
import { cn } from "../utils/cn";
import { Glass, PressButton } from "../components/ui";

export function CalendarPage() {
  const { state, today, openSheet } = useApp();
  const [cursor, setCursor] = useState(() => parseISO(today));
  const [selected, setSelected] = useState(today);
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selectedHoliday = holidayOn(selected, state.holidays);
  const selectedExams = state.exams.filter((e) => e.date === selected).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const selectedReminders = state.reminders.filter((r) => r.dueDate === selected && !r.completed);
  const selectedLectures = lecturesOn(state, selected);

  return (
    <div className="page">
      <p className="kicker text-[#c4b8ff]">Calendar</p>
      <div className="mt-1 flex items-center justify-between">
        <h1 className="text-[28px] font-semibold tracking-tight">{format(cursor, "MMMM yyyy")}</h1>
        <div className="flex gap-1">
          <PressButton className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5" aria-label="Previous month" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft size={18} /></PressButton>
          <PressButton className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5" aria-label="Next month" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight size={18} /></PressButton>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white/35">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, cursor);
          const holiday = holidayOn(key, state.holidays);
          const exams = state.exams.some((e) => e.date === key);
          const reminders = state.reminders.some((r) => r.dueDate === key && !r.completed);
          const lectures = !holiday && state.courses.some((c) => c.slots.some((s) => s.day === day.getDay()));
          const active = key === selected;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={cn(
                "press flex h-12 flex-col items-center justify-center rounded-2xl text-sm",
                active ? "bg-[#7b6cff] text-white" : holiday ? "bg-amber-300/10 text-amber-50" : "text-white/80",
                !inMonth && "opacity-30",
                key === today && !active && "ring-1 ring-[#7b6cff]/70",
              )}
            >
              <span className="tabular-nums">{format(day, "d")}</span>
              <span className="mt-0.5 flex gap-0.5">
                {exams ? <i className="h-1 w-1 rounded-full bg-current" /> : null}
                {reminders ? <i className="h-1 w-1 rounded-full bg-amber-300" /> : null}
                {lectures ? <i className="h-1 w-1 rounded-full bg-emerald-300" /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-white/45">Violet day · exam. Amber dot · deadline. Green dot · lecture. Amber wash · day off.</p>

      <Glass className="mt-4 p-4">
        <p className="text-sm font-semibold">{formatLong(selected)}</p>
        {selectedHoliday ? (
          <button type="button" className="mt-2 block text-left text-sm text-amber-100" onClick={() => openSheet({ kind: "holiday", id: selectedHoliday.id })}>
            {selectedHoliday.title} · {selectedHoliday.kind}. Lectures excluded. Tap to edit.
          </button>
        ) : null}
        {selectedExams.map((exam) => {
          const course = state.courses.find((c) => c.id === exam.courseId);
          return (
            <button key={exam.id} type="button" className="mt-3 block w-full text-left" onClick={() => openSheet({ kind: "exam", id: exam.id })}>
              <p className="font-medium">{exam.subject}</p>
              <p className="text-xs text-white/60">{formatTimeRange(exam.startTime, exam.endTime)}{exam.venue ? ` · ${exam.venue}` : ""}{course ? ` · ${course.code}` : ""}</p>
            </button>
          );
        })}
        {selectedReminders.map((reminder) => (
          <button key={reminder.id} type="button" className="mt-3 block w-full text-left" onClick={() => openSheet({ kind: "reminder", id: reminder.id })}>
            <p className="font-medium">{reminder.title}</p>
            <p className="text-xs text-white/60">Due {formatTimeRange(reminder.dueTime, reminder.dueTime)} · {reminder.priority}</p>
          </button>
        ))}
        {selectedLectures.slots.map((slot) => (
          <p key={slot.key} className="mt-3 text-sm text-white/70">{formatTimeRange(slot.startTime, slot.endTime)} · {slot.course.code} {slot.label}</p>
        ))}
        {!selectedHoliday && !selectedExams.length && !selectedReminders.length && !selectedLectures.slots.length ? <p className="mt-2 text-sm text-white/55">Nothing on this day.</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <PressButton className="btn btn-ghost" onClick={() => openSheet({ kind: "exam" })}>Add exam</PressButton>
          <PressButton className="btn btn-ghost" onClick={() => openSheet({ kind: "holiday", date: selected })}>Mark day off</PressButton>
        </div>
        <Link to={`/attendance/past?date=${selected}`} className="mt-3 block text-center text-xs font-semibold text-[#c4b8ff]">Mark attendance for this day</Link>
      </Glass>

      <section className="mt-6">
        <p className="kicker text-white/35">Coming exams</p>
        <div className="mt-3 space-y-2">
          {state.exams.filter((e) => e.date >= todayStr()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6).map((exam) => (
            <button key={exam.id} type="button" className="glass w-full rounded-[18px] px-3.5 py-3 text-left press" onClick={() => { setSelected(exam.date); setCursor(parseISO(exam.date)); openSheet({ kind: "exam", id: exam.id }); }}>
              <p className="text-sm font-medium">{exam.subject}</p>
              <p className="text-xs text-white/55">{formatLong(exam.date)} · {formatTimeRange(exam.startTime, exam.endTime)}{exam.venue ? ` · ${exam.venue}` : ""}</p>
            </button>
          ))}
          {!state.exams.some((e) => e.date >= today) ? <p className="text-sm text-white/55">No upcoming exams. Add one and it lands on this calendar.</p> : null}
        </div>
      </section>
    </div>
  );
}
