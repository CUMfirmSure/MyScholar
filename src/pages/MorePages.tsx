import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { downloadBackup, readBackup } from "../data/storage";
import { formatPct, liveArchiveStats } from "../lib/attendance";
import { WEEKDAY_SHORT } from "../lib/constants";
import { formatLong, formatTimeRange } from "../lib/dates";
import { asset } from "../lib/ids";
import { notifyPermission, requestNotifyPermission } from "../lib/notify";
import { overdueReminders, snapshot, sessionLabel } from "../lib/selectors";
import type { LogAction } from "../types";
import { cn } from "../utils/cn";
import { EmptyState, Glass, PressButton, ProgressRing, Stagger, StaggerItem } from "../components/ui";

export function CoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, today, openSheet, deleteCourse, askConfirm } = useApp();
  const course = state.courses.find((c) => c.id === id);
  if (!course) {
    return <div className="page"><EmptyState title="Course not found" body="It may have been deleted on this device." action={<Link to="/attendance" className="text-sm text-[#c4b8ff]">Back to attendance</Link>} /></div>;
  }
  const snap = snapshot(state, course, today);
  const archives = state.sessions.filter((s) => s.courseId === course.id).sort((a, b) => a.sessionNumber - b.sessionNumber);
  const topics = state.topics.filter((t) => t.courseId === course.id);
  const done = topics.filter((t) => t.status === "done").length;
  return (
    <div className="page">
      <Link to="/attendance" className="text-xs font-semibold text-[#c4b8ff]">← Attendance</Link>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: course.color }}>{course.code}</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight">{course.name}</h1>
          <p className="mt-1 text-sm text-white/60">{course.instructor || "No instructor"}{course.location ? ` · ${course.location}` : ""}</p>
        </div>
        <ProgressRing value={snap.stats.percentage} risk={snap.below} size={84} />
      </div>
      <Glass className="mt-4 p-4">
        <p className="text-sm text-white/70">{sessionLabel(snap, today)} · target {course.targetAttendance}%</p>
        <p className="mt-1 text-sm text-white/60">{snap.stats.attended} attended · {snap.stats.scheduled} counted · {snap.stats.cancelled} cancelled{snap.stats.extras ? ` · ${snap.stats.extras} extra` : ""}</p>
        {snap.closing ? <p className="mt-2 text-sm text-[#d6ccff]">Closes the day after {snap.closing.subject} · {formatLong(snap.closing.date)}.</p> : <p className="mt-2 text-sm text-white/55">No upcoming exam linked. This session stays open through today.</p>}
        <PressButton className="btn btn-ghost mt-3" onClick={() => openSheet({ kind: "session", courseId: course.id })}>Edit session start</PressButton>
      </Glass>
      <section className="mt-6">
        <p className="kicker text-white/35">Session history</p>
        <div className="mt-3 space-y-2">
          {archives.map((archive) => {
            const stats = liveArchiveStats(state, archive, today);
            const exam = state.exams.find((e) => e.id === archive.examId);
            return (
              <Glass key={archive.id} className="px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Session {archive.sessionNumber}</p>
                  <p className="font-semibold tabular-nums">{formatPct(stats.percentage)}</p>
                </div>
                <p className="text-xs text-white/55">{formatLong(archive.startDate)} – {formatLong(archive.endDate)}{exam ? ` · closed by ${exam.subject}` : ""}</p>
              </Glass>
            );
          })}
          <Glass className="px-3.5 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Session {snap.sessionNumber} · open</p>
              <p className="font-semibold tabular-nums">{formatPct(snap.stats.percentage)}</p>
            </div>
            <p className="text-xs text-white/55">{formatLong(course.sessionStartDate)} – ongoing</p>
          </Glass>
        </div>
      </section>
      <section className="mt-6">
        <p className="kicker text-white/35">Weekly slots</p>
        <div className="mt-3 space-y-2">
          {course.slots.slice().sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime)).map((slot) => (
            <Glass key={slot.id} className="px-3.5 py-3 text-sm">
              <span className="text-white/60">{WEEKDAY_SHORT[slot.day]}</span> · {formatTimeRange(slot.startTime, slot.endTime)} · {slot.label}
            </Glass>
          ))}
          {!course.slots.length ? <p className="text-sm text-white/55">No weekly slots. Only extra lectures will count.</p> : null}
        </div>
      </section>
      <Link to={`/syllabus?course=${course.id}`} className="glass mt-4 block rounded-[22px] p-4">
        <p className="text-sm font-medium">Syllabus</p>
        <p className="text-xs text-white/55">{done}/{topics.length} topics done</p>
      </Link>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <PressButton className="btn btn-ghost" onClick={() => openSheet({ kind: "course", id: course.id })}>Edit course</PressButton>
        <PressButton className="btn btn-danger" onClick={() => askConfirm({ title: "Delete course?", body: "Attendance, session history, and syllabus will be removed.", confirmLabel: "Delete", danger: true, onConfirm: () => { deleteCourse(course.id); navigate("/attendance"); } })}>Delete</PressButton>
      </div>
    </div>
  );
}

const LOG_COLOR: Record<LogAction, string> = {
  create: "bg-emerald-300",
  update: "bg-[#c4b8ff]",
  delete: "bg-rose-300",
  mark: "bg-amber-200",
};

export function LogsPage() {
  const { state } = useApp();
  const [filter, setFilter] = useState<LogAction | "all">("all");
  const logs = state.logs.filter((log) => filter === "all" || log.action === filter);
  return (
    <div className="page">
      <Link to="/" className="text-xs font-semibold text-[#c4b8ff]">← Home</Link>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Activity</h1>
      <p className="mt-1 text-sm text-white/60">Every create, update, delete, and attendance mark on this device. Newest first.</p>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {(["all", "mark", "create", "update", "delete"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={cn("press shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize", filter === id ? "bg-white text-[#14141c]" : "bg-white/5 text-white/60")}>{id}</button>
        ))}
      </div>
      {!logs.length ? <div className="mt-5"><EmptyState image={asset("images/empty-desk.jpg")} title="No activity yet" body="Marks, edits, and new courses will show up here." /></div> : (
        <Stagger className="relative mt-5 space-y-0 pl-4">
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-white/10" />
          {logs.map((log) => (
            <StaggerItem key={log.id} className="relative pb-4">
              <span className={cn("absolute -left-[14px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[#06070b]", LOG_COLOR[log.action])} />
              <p className="text-sm leading-snug">{log.summary}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-white/45">{log.action} · {log.entity} · {format(parseISO(log.timestamp), "d MMM · HH:mm")}</p>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

export function BacklogsPage() {
  const { state, today, openSheet } = useApp();
  const overdue = overdueReminders(state);
  const below = state.courses.map((c) => snapshot(state, c, today)).filter((s) => s.below);
  const pending = state.topics.filter((t) => t.status === "pending");
  return (
    <div className="page">
      <Link to="/planner" className="text-xs font-semibold text-[#c4b8ff]">← Planner</Link>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Backlogs</h1>
      <p className="mt-1 text-sm text-white/60">Overdue work, open sessions under target, and syllabus still pending.</p>
      <section className="mt-5">
        <p className="kicker text-white/35">Overdue reminders · {overdue.length}</p>
        <div className="mt-2 space-y-2">
          {overdue.map((r) => (
            <button key={r.id} type="button" className="glass w-full rounded-[18px] px-3.5 py-3 text-left" onClick={() => openSheet({ kind: "reminder", id: r.id })}>
              <p className="text-sm font-medium">{r.title}</p>
              <p className="text-xs text-rose-200/80">Due {r.dueDate} · {r.dueTime}</p>
            </button>
          ))}
          {!overdue.length ? <p className="text-sm text-white/35">None.</p> : null}
        </div>
      </section>
      <section className="mt-6">
        <p className="kicker text-white/35">Under target · {below.length}</p>
        <div className="mt-2 space-y-2">
          {below.map((snap) => (
            <Link key={snap.course.id} to={`/course/${snap.course.id}`} className="glass block rounded-[18px] px-3.5 py-3">
              <p className="text-sm font-medium">{snap.course.code} · {formatPct(snap.stats.percentage)}</p>
              <p className="text-xs text-white/60">Target {snap.course.targetAttendance}% · open session</p>
            </Link>
          ))}
          {!below.length ? <p className="text-sm text-white/35">Every open session is at or above target.</p> : null}
        </div>
      </section>
      <section className="mt-6">
        <p className="kicker text-white/35">Pending topics · {pending.length}</p>
        <div className="mt-2 space-y-2">
          {pending.slice(0, 30).map((topic) => {
            const course = state.courses.find((c) => c.id === topic.courseId);
            return (
              <Link key={topic.id} to={`/syllabus?course=${topic.courseId}`} className="glass block rounded-[18px] px-3.5 py-3">
                <p className="text-sm">{topic.title}</p>
                <p className="text-xs text-white/55">{course?.code}</p>
              </Link>
            );
          })}
          {!pending.length ? <p className="text-sm text-white/35">No pending topics.</p> : null}
        </div>
      </section>
    </div>
  );
}

export function SettingsPage() {
  const { state, pushToast, askConfirm, resetAll, loadSample, importBackup } = useApp();
  const [perm, setPerm] = useState(notifyPermission());
  return (
    <div className="page">
      <Link to="/" className="text-xs font-semibold text-[#c4b8ff]">← Home</Link>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Settings</h1>
      <Glass className="mt-4 overflow-hidden">
        <img src={asset("images/welcome.jpg")} alt="" className="h-32 w-full object-cover" />
        <div className="p-4">
          <p className="font-semibold">ScholarFlow</p>
          <p className="mt-1 text-sm leading-relaxed text-white/50">Attendance, exams, holidays, syllabus, and reminders for one semester. Everything stays in local storage on this device. There is no account and no cloud sync — export a backup if you switch phones.</p>
        </div>
      </Glass>
      <section className="mt-5 space-y-2">
        <p className="kicker text-white/35">Reminders</p>
        <Glass className="p-4">
          <p className="text-sm">On-device notification permission: <span className="text-white/60">{perm}</span></p>
          <p className="mt-1 text-xs leading-relaxed text-white/55">Banners appear while the app is open. Background alerts on Android need a device build with the system notification permission; this preview never contacts a server.</p>
          <PressButton className="btn btn-ghost mt-3" onClick={async () => {
            const next = await requestNotifyPermission();
            setPerm(next);
            pushToast({ title: next === "granted" ? "Reminders enabled" : "Using in-app banners", body: next === "granted" ? "You'll be notified when a reminder window opens." : "Permission wasn't granted. Banners still show in the app." });
          }}>Enable reminders</PressButton>
        </Glass>
      </section>
      <section className="mt-5 space-y-2">
        <p className="kicker text-white/35">Data</p>
        <PressButton className="btn btn-ghost w-full" onClick={() => downloadBackup(state)}>Export backup</PressButton>
        <label className="btn btn-ghost w-full">
          Import backup
          <input type="file" accept="application/json" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const next = readBackup(await file.text());
            if (!next) return pushToast({ title: "Couldn't read that file" });
            importBackup(next);
            pushToast({ title: "Backup restored on this device" });
          }} />
        </label>
        <PressButton className="btn btn-ghost w-full" onClick={() => askConfirm({ title: "Load the sample semester?", body: "This replaces whatever is currently stored on this device.", confirmLabel: "Load sample", onConfirm: loadSample })}>Load sample semester</PressButton>
        <PressButton className="btn btn-danger w-full" onClick={() => askConfirm({ title: "Erase everything?", body: "Courses, marks, exams, and reminders on this device will be deleted. Export a backup first if you might want them back.", confirmLabel: "Erase data", danger: true, onConfirm: resetAll })}>Reset all data</PressButton>
      </section>
    </div>
  );
}
