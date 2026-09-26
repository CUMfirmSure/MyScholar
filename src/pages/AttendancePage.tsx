import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { formatPct, liveArchiveStats, planForDate, type DayPlanItem } from "../lib/attendance";
import { addDaysStr, eachDate, formatFull, formatLong, relativeDay } from "../lib/dates";
import { allSnapshots, bufferCopy, sessionLabel } from "../lib/selectors";
import type { MarkStatus } from "../types";
import { Glass, PressButton, ProgressRing, Stagger, StaggerItem, TriState } from "../components/ui";
import { cn } from "../utils/cn";

export function AttendancePage() {
  const { state, today, openSheet } = useApp();
  void state;
  const snaps = allSnapshots(state, today);
  return (
    <div className="page">
      <p className="kicker text-[#c4b8ff]">Attendance</p>
      <h1 className="mt-1 text-[28px] font-semibold tracking-tight">Open sessions</h1>
      <p className="mt-1 text-sm text-white/60">Calculated from each course's session start through today. Holidays and cancelled lectures are left out.</p>
      <PressButton className="btn btn-primary mt-4 w-full" onClick={() => openSheet({ kind: "course" })}>Add course</PressButton>
      <Link to={`/attendance/past?date=${today}`} className="btn btn-ghost mt-2 w-full">Edit past & extra lectures</Link>
      {!snaps.length ? <p className="mt-8 text-sm text-white/60">No courses yet. Add one to start a session.</p> : (
        <Stagger className="mt-5 space-y-3">
          {snaps.map((snap) => (
            <StaggerItem key={snap.course.id}>
              <Link to={`/course/${snap.course.id}`} className="block">
                <Glass className="flex items-center gap-3 p-3.5 press">
                  <ProgressRing value={snap.stats.percentage} risk={snap.below} label={`${snap.course.code} attendance`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: snap.course.color }} />
                      <p className="truncate font-semibold">{snap.course.name}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-white/55">{snap.course.code} · {sessionLabel(snap, today)}</p>
                    <p className={cn("mt-1 text-sm", snap.below ? "text-rose-200" : "text-white/70")}>{bufferCopy(snap)}</p>
                    <p className="mt-1 text-[11px] tabular-nums text-white/35">{snap.stats.attended} attended · {snap.stats.scheduled} counted{snap.stats.unmarked ? ` · ${snap.stats.unmarked} unmarked` : ""}</p>
                  </div>
                </Glass>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
      {state.sessions.length ? (
        <section className="mt-8">
          <p className="kicker text-white/35">Closed sessions</p>
          <div className="mt-3 space-y-2">
            {state.sessions.slice().sort((a, b) => b.endDate.localeCompare(a.endDate)).map((archive) => {
              const course = state.courses.find((c) => c.id === archive.courseId);
              const stats = liveArchiveStats(state, archive, today);
              const exam = state.exams.find((e) => e.id === archive.examId);
              return (
                <Glass key={archive.id} className="px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{course?.code ?? "Course"} · Session {archive.sessionNumber}</p>
                      <p className="text-xs text-white/55">{formatLong(archive.startDate)} – {formatLong(archive.endDate)}{exam ? ` · ${exam.subject}` : ""}</p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">{formatPct(stats.percentage)}</p>
                  </div>
                </Glass>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function PastAttendancePage() {
  const { today, setMark, openSheet } = useApp();
  const [params] = useSearchParams();
  const initial = params.get("date") || today;
  const [cursor, setCursor] = useState(initial);
  const [rangeOn, setRangeOn] = useState(false);
  const [from, setFrom] = useState(addDaysStr(initial, -6));
  const [to, setTo] = useState(initial);

  useEffect(() => {
    const next = params.get("date");
    if (next) {
      setCursor(next);
      setTo(next);
    }
  }, [params]);

  const dates = useMemo(() => {
    if (!rangeOn) return [cursor];
    const start = from <= to ? from : to;
    const end = from <= to ? to : from;
    const all = eachDate(start, end, 46);
    return all.slice(-45).reverse();
  }, [rangeOn, cursor, from, to]);
  const clipped = rangeOn && eachDate(from <= to ? from : to, from <= to ? to : from, 80).length > 45;

  return (
    <div className="page">
      <Link to="/attendance" className="text-xs font-semibold text-[#c4b8ff]">← Attendance</Link>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Past attendance</h1>
      <p className="mt-1 text-sm leading-relaxed text-white/60">Each lecture has its own Present, Absent, or Cancelled control. Marking one never changes another — including two slots of the same course. Tap the selected status again to undo.</p>

      <Glass className="mt-4 p-3">
        <div className="flex items-center justify-between">
          <PressButton className="grid h-10 w-10 place-items-center rounded-xl bg-white/5" aria-label="Previous day" onClick={() => setCursor(addDaysStr(cursor, -1))}><ChevronLeft size={18} /></PressButton>
          <div className="text-center">
            <p className="text-sm font-semibold">{relativeDay(cursor, today)}</p>
            <p className="text-xs text-white/55">{formatLong(cursor)}</p>
          </div>
          <PressButton className="grid h-10 w-10 place-items-center rounded-xl bg-white/5" aria-label="Next day" onClick={() => setCursor(addDaysStr(cursor, 1))}><ChevronRight size={18} /></PressButton>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input type="date" className="input" value={cursor} onChange={(e) => e.target.value && setCursor(e.target.value)} />
          <PressButton className={cn("btn", rangeOn ? "btn-primary" : "btn-ghost")} onClick={() => setRangeOn((v) => !v)}>{rangeOn ? "Single day" : "Date range"}</PressButton>
          {cursor !== today && !rangeOn ? <PressButton className="btn btn-ghost col-span-2" onClick={() => setCursor(today)}>Jump to today</PressButton> : null}
        </div>
        {rangeOn ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        ) : null}
      </Glass>
      {clipped ? <p className="mt-2 text-xs text-amber-100/80">Showing the latest 45 days of that range.</p> : null}

      <PressButton className="btn btn-ghost mt-3 w-full" onClick={() => openSheet({ kind: "extra", date: cursor })}><Plus size={16} /> Add extra lecture</PressButton>

      <div className="mt-5 space-y-6">
        {dates.map((date) => (
          <DayBlock key={date} date={date} today={today} onExtra={() => openSheet({ kind: "extra", date })} onStatus={(item, status) => {
            setMark({
              courseId: item.courseId,
              date: item.date,
              slotId: item.isExtra ? null : item.slotId,
              slotLabel: item.label,
              startTime: item.startTime,
              endTime: item.endTime,
              isExtra: item.isExtra,
              recordId: item.recordId,
              status,
            });
          }} />
        ))}
      </div>
    </div>
  );
}

function DayBlock({
  date,
  today,
  onStatus,
  onExtra,
}: {
  date: string;
  today: string;
  onStatus: (item: DayPlanItem, status: MarkStatus | null) => void;
  onExtra: () => void;
}) {
  const { state } = useApp();
  const { holiday, items } = planForDate(state, date);
  const visible = items.filter((item) => !item.excluded);
  const excluded = items.filter((item) => item.excluded);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{formatFull(date)}</h2>
        <span className="text-[11px] text-white/35">{relativeDay(date, today)}</span>
      </div>
      {holiday ? (
        <Glass className="mb-2 px-3 py-2 text-sm text-amber-100/90">
          {holiday.title} · scheduled lectures excluded
        </Glass>
      ) : null}
      {!visible.length && !excluded.length ? <p className="text-sm text-white/35">No scheduled lectures.</p> : null}
      <Stagger className="space-y-2">
        {visible.map((item) => (
          <StaggerItem key={item.key}>
            <LectureControl item={item} onStatus={onStatus} />
          </StaggerItem>
        ))}
      </Stagger>
      {excluded.length ? <p className="mt-2 text-xs text-white/45">{excluded.length} scheduled slot{excluded.length === 1 ? "" : "s"} hidden because of the day off.</p> : null}
      <button type="button" className="mt-2 text-xs font-semibold text-[#c4b8ff]" onClick={onExtra}>+ Extra on this day</button>
    </section>
  );
}

function LectureControl({ item, onStatus }: { item: DayPlanItem; onStatus: (item: DayPlanItem, status: MarkStatus | null) => void }) {
  return (
    <Glass className="p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{item.courseCode} · {item.label}{item.isExtra ? " · extra" : ""}</p>
          <p className="text-xs text-white/55">{item.startTime}–{item.endTime} · {item.courseName}</p>
        </div>
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
      </div>
      <TriState value={item.status} onChange={(status) => onStatus(item, status)} />
    </Glass>
  );
}
