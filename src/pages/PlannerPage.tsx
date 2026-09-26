import { useState } from "react";
import { Check, ClipboardCheck, FileText, FlaskConical, HelpCircle, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { formatTime, relativeDay } from "../lib/dates";
import { asset } from "../lib/ids";
import { reminderDue } from "../lib/notify";
import { overdueReminders, upcomingReminders } from "../lib/selectors";
import type { Reminder, ReminderType } from "../types";
import { cn } from "../utils/cn";
import { EmptyState, Glass, PressButton, Segmented, Stagger, StaggerItem } from "../components/ui";

const ICONS: Record<ReminderType, typeof Bell> = {
  assignment: FileText,
  test: ClipboardCheck,
  quiz: HelpCircle,
  lab: FlaskConical,
  other: Bell,
};

export function PlannerPage() {
  const { state, today, openSheet } = useApp();
  const [tab, setTab] = useState<"upcoming" | "overdue" | "done">("upcoming");
  const now = new Date();
  const lists = {
    upcoming: upcomingReminders(state, now),
    overdue: overdueReminders(state, now),
    done: state.reminders.filter((r) => r.completed).sort((a, b) => reminderDue(b) - reminderDue(a)),
  };
  const items = lists[tab];
  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker text-[#c4b8ff]">Planner</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight">Reminders</h1>
        </div>
        <Link to="/backlogs" className="text-xs font-semibold text-[#c4b8ff]">Backlogs</Link>
      </div>
      <div className="mt-4">
        <Segmented
          value={tab}
          options={[
            { id: "upcoming", label: `Upcoming ${lists.upcoming.length}` },
            { id: "overdue", label: `Overdue ${lists.overdue.length}` },
            { id: "done", label: "Done" },
          ]}
          onChange={setTab}
        />
      </div>
      <PressButton className="btn btn-primary mt-4 w-full" onClick={() => openSheet({ kind: "reminder" })}>New reminder</PressButton>
      {!items.length ? (
        <div className="mt-5">
          <EmptyState image={asset("images/empty-desk.jpg")} title={tab === "overdue" ? "Nothing overdue" : tab === "done" ? "Nothing completed yet" : "No upcoming deadlines"} body="Add an assignment, quiz, test, or lab and choose how many days before to be reminded." />
        </div>
      ) : (
        <Stagger className="mt-4 space-y-2">
          {items.map((reminder) => <StaggerItem key={reminder.id}><ReminderRow reminder={reminder} today={today} /></StaggerItem>)}
        </Stagger>
      )}
    </div>
  );
}

function ReminderRow({ reminder, today }: { reminder: Reminder; today: string }) {
  const { state, toggleReminder, openSheet } = useApp();
  const Icon = ICONS[reminder.type];
  const course = state.courses.find((c) => c.id === reminder.courseId);
  const overdue = !reminder.completed && reminderDue(reminder) < Date.now();
  return (
    <Glass className={cn("flex items-start gap-3 p-3", overdue && "border-rose-400/25")}>
      <button
        type="button"
        aria-label={reminder.completed ? "Mark not done" : "Mark done"}
        onClick={() => toggleReminder(reminder.id)}
        className={cn("press mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl border", reminder.completed ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200" : "border-white/10 bg-white/5 text-white/50")}
      >
        {reminder.completed ? <Check size={16} /> : <Icon size={16} />}
      </button>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openSheet({ kind: "reminder", id: reminder.id })}>
        <p className={cn("font-medium", reminder.completed && "text-white/55 line-through")}>{reminder.title}</p>
        <p className="mt-0.5 text-xs text-white/60">
          {overdue ? "Overdue" : relativeDay(reminder.dueDate, today)} · {formatTime(reminder.dueTime)}
          {course ? ` · ${course.code}` : ""} · {reminder.type}
          {reminder.remindDaysBefore ? ` · reminds ${reminder.remindDaysBefore}d before` : ""}
        </p>
        {reminder.notes ? <p className="mt-1 line-clamp-2 text-xs text-white/35">{reminder.notes}</p> : null}
      </button>
      <span className={cn("mt-2 h-2 w-2 rounded-full", reminder.priority === "high" ? "bg-rose-400" : reminder.priority === "medium" ? "bg-amber-300" : "bg-white/20")} />
    </Glass>
  );
}
