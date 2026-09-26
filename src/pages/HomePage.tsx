import { format, parseISO } from "date-fns";
import { Bell, ChevronRight, ScrollText, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { holidayOn, lecturesOn } from "../lib/attendance";
import { addDaysStr, countdownLabel, dayDiff, formatTimeRange, greeting, relativeDay } from "../lib/dates";
import { asset } from "../lib/ids";
import { reminderDue } from "../lib/notify";
import { allSnapshots, dashboardExam, insightCopy, urgentReminders } from "../lib/selectors";
import { cn } from "../utils/cn";
import { AppHeader, EmptyState, Glass, PressButton, ProgressRing, Stagger, StaggerItem, TriState, iconButtonClass } from "../components/ui";

export function HomePage() {
  const { state, today, setMark, openSheet, dismissSample } = useApp();
  const snaps = allSnapshots(state, today);
  const risks = snaps.filter((s) => s.atRisk).slice(0, 2);
  const { holiday, slots } = lecturesOn(state, today);
  const exam = dashboardExam(state, today);
  const examCourse = exam ? state.courses.find((c) => c.id === exam.courseId) : undefined;
  const pending = exam?.courseId ? state.topics.filter((t) => t.courseId === exam.courseId && t.status === "pending").length : 0;
  const deadlines = urgentReminders(state, today, new Date(), 3);
  const tomorrowOff = holidayOn(addDaysStr(today, 1), state.holidays);
  const now = Date.now();

  return (
    <div className="page">
      <AppHeader
        trailing={
          <div className="flex gap-2">
            <Link to="/logs" className={iconButtonClass()} aria-label="Activity log"><ScrollText size={18} /></Link>
            <Link to="/settings" className={iconButtonClass()} aria-label="Settings"><Settings size={18} /></Link>
          </div>
        }
      />
      <p className="text-[13px] font-medium text-[#c4b8ff]">{greeting()}</p>
      <h1 className="serif mt-1 text-[42px] leading-[0.95]">{format(parseISO(today), "EEEE")}</h1>
      <p className="mt-1 text-sm text-white/60">{format(parseISO(today), "d MMMM")}</p>

      {state.meta.isSample && !state.meta.sampleBannerDismissed ? (
        <Glass className="mt-4 flex items-start gap-3 p-3.5">
          <img src={asset("images/welcome.jpg")} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Sample semester</p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/50">Numbers are illustrative so you can see sessions, misses, and a near exam. Reset in Settings when you want a blank slate.</p>
          </div>
          <button type="button" className="text-xs text-white/55" onClick={dismissSample} aria-label="Dismiss sample note">✕</button>
        </Glass>
      ) : null}

      {!state.courses.length ? (
        <div className="mt-6">
          <EmptyState
            image={asset("images/welcome.jpg")}
            title="Your semester, kept quietly on this phone."
            body="Add a course or load a sample week. Attendance, exams, and reminders never leave the device."
            action={
              <div className="flex gap-2">
                <PressButton className="btn btn-primary" onClick={() => openSheet({ kind: "course" })}>Add course</PressButton>
                <PressButton className="btn btn-ghost" onClick={() => openSheet({ kind: "import" })}>Import</PressButton>
              </div>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <section>
            <div className="mb-1 flex items-end justify-between">
              <div>
                <p className="kicker text-white/35">Today</p>
                <h2 className="mt-1 text-lg font-semibold">{holiday ? holiday.title : slots.length ? `${slots.length} lecture${slots.length === 1 ? "" : "s"} to mark` : "Nothing scheduled"}</h2>
              </div>
              <Link to={`/attendance/past?date=${today}`} className="text-xs font-semibold text-[#c4b8ff]">Past days</Link>
            </div>
            {!holiday && slots.length ? <p className="mb-3 text-xs text-white/50">Tap a status again to undo. Two slots on the same day are marked separately.</p> : <div className="mb-3" />}
            {holiday ? (
              <Glass className="p-4">
                <p className="text-sm text-white/70">{holiday.kind === "personal" ? "Personal day" : holiday.kind === "break" ? "Break" : "Holiday"}. Scheduled lectures are excluded from attendance.</p>
                <PressButton className="btn btn-ghost mt-3" onClick={() => openSheet({ kind: "extra", date: today })}>Log an extra class</PressButton>
              </Glass>
            ) : slots.length ? (
              <div className="relative">
                <div className="absolute bottom-3 left-[5px] top-3 w-px bg-white/10" />
                <Stagger className="space-y-3">
                  {slots.map((slot) => (
                    <StaggerItem key={slot.key} className="relative pl-6">
                      <span className="absolute left-0 top-5 h-2.5 w-2.5 rounded-full ring-4 ring-[#06070b]" style={{ background: slot.course.color }} />
                      <Glass className="overflow-hidden p-3.5" style={{ background: `linear-gradient(180deg, ${slot.course.color}18, rgba(255,255,255,0.03) 48%)` }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold tabular-nums text-white/60">{formatTimeRange(slot.startTime, slot.endTime)}</p>
                            <p className="mt-0.5 font-semibold">{slot.course.name}</p>
                            <p className="text-xs text-white/60">{slot.course.code} · {slot.label}{slot.location ? ` · ${slot.location}` : ""}</p>
                          </div>
                        </div>
                        {slot.status === "cancelled" ? (
                          <div className="mt-3 flex items-center justify-between text-xs text-amber-100">
                            <span>Cancelled — not counted</span>
                            <button type="button" className="font-semibold text-white/70" onClick={() => setMark({ courseId: slot.course.id, date: today, slotId: slot.slotId, slotLabel: slot.label, startTime: slot.startTime, endTime: slot.endTime, isExtra: false, recordId: slot.recordId, status: null })}>Undo</button>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <TriState
                              includeCancelled={false}
                              value={slot.status}
                              onChange={(next) => setMark({
                                courseId: slot.course.id,
                                date: today,
                                slotId: slot.slotId,
                                slotLabel: slot.label,
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                                isExtra: false,
                                recordId: slot.recordId,
                                status: next,
                              })}
                            />
                          </div>
                        )}
                      </Glass>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            ) : (
              <Glass className="flex items-center gap-3 p-3.5">
                <img src={asset("images/empty-desk.jpg")} alt="" className="h-14 w-16 rounded-2xl object-cover" />
                <div className="flex-1">
                  <p className="text-sm text-white/70">No lectures on the weekly timetable.</p>
                  <PressButton className="mt-2 text-xs font-semibold text-[#c4b8ff]" onClick={() => openSheet({ kind: "extra", date: today })}>Had a makeup class?</PressButton>
                </div>
              </Glass>
            )}
            {tomorrowOff ? <p className="mt-3 text-xs text-white/55">Tomorrow is {tomorrowOff.title}. Lectures that day won't count.</p> : null}
          </section>

          {risks.length ? (
            <section>
              <p className="kicker text-white/35">Needs you</p>
              <Stagger className="mt-3 space-y-3">
                {risks.map((snap) => (
                  <StaggerItem key={snap.course.id}>
                    <Link to={`/course/${snap.course.id}`} className="block">
                      <Glass className="flex items-center gap-3 p-3.5 press">
                        <ProgressRing value={snap.stats.percentage} risk={snap.below} size={68} label={`${snap.course.name} ${snap.stats.percentage ?? "no"} percent`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: snap.course.color }}>{snap.course.code}</p>
                          <p className="mt-1 text-sm leading-snug text-white/85">{insightCopy(snap)}</p>
                          {snap.stats.unmarked > 0 ? <p className="mt-1 text-xs text-amber-100/80">{snap.stats.unmarked} unmarked past lecture{snap.stats.unmarked === 1 ? "" : "s"} count as missed.</p> : null}
                        </div>
                      </Glass>
                    </Link>
                  </StaggerItem>
                ))}
              </Stagger>
            </section>
          ) : null}

          {exam ? (
            <section>
              <Glass className="overflow-hidden p-4">
                <p className="kicker text-[#c4b8ff]">Next exam</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <p className={cn("serif leading-none", dayDiff(exam.date, today) <= 1 ? "text-[34px]" : "text-[52px]")}>{dayDiff(exam.date, today) <= 1 ? countdownLabel(exam.date, today) : dayDiff(exam.date, today)}</p>
                    {dayDiff(exam.date, today) > 1 ? <p className="text-sm text-white/55">days</p> : null}
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="font-semibold">{exam.subject}</p>
                    <p className="text-sm text-white/55">{examCourse?.code ?? "Unlinked"} · {format(parseISO(exam.date), "EEE d MMM")}</p>
                    <p className="text-xs text-white/55">{formatTimeRange(exam.startTime, exam.endTime)}{exam.venue ? ` · ${exam.venue}` : ""}</p>
                  </div>
                </div>
                {pending > 0 ? (
                  <Link to={`/syllabus?course=${exam.courseId}`} className="mt-3 flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-2 text-sm text-[#d6ccff]">
                    <span>{pending} topic{pending === 1 ? "" : "s"} still pending</span>
                    <ChevronRight size={16} />
                  </Link>
                ) : null}
              </Glass>
            </section>
          ) : null}

          {deadlines.length ? (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <p className="kicker text-white/35">Due</p>
                <Link to="/planner" className="text-xs font-semibold text-[#c4b8ff]">Planner</Link>
              </div>
              <Stagger className="space-y-2">
                {deadlines.map((reminder) => {
                  const overdue = reminderDue(reminder) < now;
                  const course = state.courses.find((c) => c.id === reminder.courseId);
                  return (
                    <StaggerItem key={reminder.id}>
                      <Link to="/planner" className="block">
                        <Glass className={cn("flex items-center gap-3 p-3.5", overdue && "border-rose-400/30")}>
                          <div className={cn("grid h-9 w-9 place-items-center rounded-2xl", overdue ? "bg-rose-400/15 text-rose-200" : "bg-white/5 text-white/70")}>
                            <Bell size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{reminder.title}</p>
                            <p className="text-xs text-white/60">{overdue ? "Overdue" : relativeDay(reminder.dueDate, today)} · {reminder.dueTime}{course ? ` · ${course.code}` : ""}</p>
                          </div>
                          <span className={cn("h-2 w-2 rounded-full", reminder.priority === "high" ? "bg-rose-400" : reminder.priority === "medium" ? "bg-amber-300" : "bg-white/25")} />
                        </Glass>
                      </Link>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
