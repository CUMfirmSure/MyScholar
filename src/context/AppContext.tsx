import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createSampleState } from "../data/sample";
import { emptyState, loadState, normalize, saveState } from "../data/storage";
import { reconcileSessions } from "../lib/attendance";
import { todayStr } from "../lib/dates";
import { uid } from "../lib/ids";
import { pushSystemNotification, shouldNotify } from "../lib/notify";
import type {
  ActivityLog,
  AppState,
  Course,
  Exam,
  Holiday,
  LogAction,
  MarkPayload,
  Reminder,
  TopicStatus,
} from "../types";

export type SheetState =
  | { kind: "course"; id?: string }
  | { kind: "reminder"; id?: string }
  | { kind: "exam"; id?: string; bulk?: boolean }
  | { kind: "holiday"; id?: string; date?: string }
  | { kind: "topics"; courseId?: string }
  | { kind: "import" }
  | { kind: "extra"; date?: string; courseId?: string }
  | { kind: "session"; courseId: string };

export interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

export interface ToastItem {
  id: string;
  title: string;
  body?: string;
}

interface AppContextValue {
  state: AppState;
  today: string;
  ready: boolean;
  sheet: SheetState | null;
  confirm: ConfirmState | null;
  toasts: ToastItem[];
  openSheet: (sheet: SheetState) => void;
  closeSheet: () => void;
  askConfirm: (confirm: ConfirmState) => void;
  closeConfirm: () => void;
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  saveCourse: (course: Course, isNew: boolean) => void;
  deleteCourse: (id: string) => void;
  setSessionStart: (courseId: string, date: string) => void;
  saveExam: (exam: Exam, isNew: boolean) => void;
  saveExams: (exams: Exam[]) => void;
  deleteExam: (id: string) => void;
  setMark: (payload: MarkPayload) => void;
  saveHoliday: (holiday: Holiday, isNew: boolean) => void;
  deleteHoliday: (id: string) => void;
  saveReminder: (reminder: Reminder, isNew: boolean) => void;
  deleteReminder: (id: string) => void;
  toggleReminder: (id: string) => void;
  addTopicGroups: (courseId: string, groups: { unit: string; topics: string[] }[]) => void;
  setTopicStatus: (id: string, status: TopicStatus) => void;
  deleteTopic: (id: string) => void;
  deleteUnit: (id: string) => void;
  importCourses: (courses: Course[]) => number;
  dismissSample: () => void;
  resetAll: () => void;
  loadSample: () => void;
  importBackup: (state: AppState) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function boot(): AppState {
  return reconcileSessions(loadState() ?? createSampleState(), todayStr());
}

function withLog(state: AppState, action: LogAction, entity: string, summary: string): AppState {
  const entry: ActivityLog = {
    id: uid("log"),
    action,
    entity,
    summary,
    timestamp: new Date().toISOString(),
  };
  return { ...state, logs: [entry, ...state.logs].slice(0, 400) };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(boot);
  const [today, setToday] = useState(todayStr);
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const fired = useRef(new Set<string>());

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 680);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const tick = () => {
      const next = todayStr();
      setToday((prev) => {
        if (prev !== next) {
          setState((current) => reconcileSessions(current, next));
          return next;
        }
        return prev;
      });
    };
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, []);

  const pushToast = (toast: Omit<ToastItem, "id">) => {
    const id = uid("toast");
    setToasts((list) => [...list, { ...toast, id }].slice(-3));
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 4400);
  };

  useEffect(() => {
    const due = state.reminders.filter((r) => shouldNotify(r) && !fired.current.has(r.id));
    if (!due.length) return;
    due.forEach((reminder) => {
      fired.current.add(reminder.id);
      const code = state.courses.find((c) => c.id === reminder.courseId)?.code;
      pushToast({
        title: reminder.title,
        body: code ? `Reminder window · ${code}` : "Reminder window reached",
      });
      pushSystemNotification(
        reminder.title,
        code ? `${code} is due ${reminder.dueDate} ${reminder.dueTime}` : `Due ${reminder.dueDate} ${reminder.dueTime}`,
      );
    });
    const ids = new Set(due.map((r) => r.id));
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) => (ids.has(r.id) ? { ...r, notified: true } : r)),
    }));
    // pushToast is stable enough for this local notifier; re-running on reminder changes is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.reminders, state.courses]);

  const commit = (recipe: (prev: AppState) => AppState) => {
    setState((prev) => reconcileSessions(recipe(prev), todayStr()));
  };

  const saveCourse = (course: Course, isNew: boolean) => {
    commit((prev) =>
      withLog(
        { ...prev, courses: isNew ? [...prev.courses, course] : prev.courses.map((c) => (c.id === course.id ? course : c)) },
        isNew ? "create" : "update",
        "course",
        `${isNew ? "Added" : "Updated"} ${course.code} · ${course.name}.`,
      ),
    );
  };

  const deleteCourse = (id: string) => {
    commit((prev) => {
      const course = prev.courses.find((c) => c.id === id);
      return withLog(
        {
          ...prev,
          courses: prev.courses.filter((c) => c.id !== id),
          attendance: prev.attendance.filter((a) => a.courseId !== id),
          sessions: prev.sessions.filter((s) => s.courseId !== id),
          units: prev.units.filter((u) => u.courseId !== id),
          topics: prev.topics.filter((t) => t.courseId !== id),
          exams: prev.exams.map((e) => (e.courseId === id ? { ...e, courseId: null } : e)),
          reminders: prev.reminders.map((r) => (r.courseId === id ? { ...r, courseId: null } : r)),
        },
        "delete",
        "course",
        `Deleted ${course?.code ?? "course"} and its attendance history.`,
      );
    });
  };

  const setSessionStart = (courseId: string, date: string) => {
    commit((prev) => {
      const course = prev.courses.find((c) => c.id === courseId);
      return withLog(
        {
          ...prev,
          courses: prev.courses.map((c) =>
            c.id === courseId ? { ...c, sessionStartDate: date, updatedAt: new Date().toISOString() } : c,
          ),
        },
        "update",
        "session",
        `Moved ${course?.code ?? "course"} open session start to ${date}.`,
      );
    });
  };

  const saveExam = (exam: Exam, isNew: boolean) => {
    commit((prev) => {
      const course = prev.courses.find((c) => c.id === exam.courseId);
      const link = course ? ` Linked to ${course.code}; the open session closes the day after the exam.` : "";
      return withLog(
        { ...prev, exams: isNew ? [...prev.exams, exam] : prev.exams.map((e) => (e.id === exam.id ? exam : e)) },
        isNew ? "create" : "update",
        "exam",
        `${isNew ? "Added" : "Updated"} ${exam.subject}.${link}`,
      );
    });
  };

  const saveExams = (exams: Exam[]) => {
    commit((prev) =>
      withLog(
        { ...prev, exams: [...prev.exams, ...exams] },
        "create",
        "exam",
        `Added ${exams.length} exam${exams.length === 1 ? "" : "s"}. Linked exams close their course session the day after they are held.`,
      ),
    );
  };

  const deleteExam = (id: string) => {
    commit((prev) => {
      const exam = prev.exams.find((e) => e.id === id);
      return withLog(
        { ...prev, exams: prev.exams.filter((e) => e.id !== id) },
        "delete",
        "exam",
        `Deleted ${exam?.subject ?? "exam"}. Any session it already closed stays in history.`,
      );
    });
  };

  const setMark = (payload: MarkPayload) => {
    commit((prev) => {
      const course = prev.courses.find((c) => c.id === payload.courseId);
      const label = `${course?.code ?? "Class"} ${payload.slotLabel || (payload.isExtra ? "extra" : "lecture")} · ${payload.date}`;
      let attendance = prev.attendance;
      if (payload.status == null) {
        attendance = payload.recordId
          ? attendance.filter((a) => a.id !== payload.recordId)
          : attendance.filter(
              (a) => !(a.courseId === payload.courseId && a.date === payload.date && !a.isExtra && a.slotId === payload.slotId),
            );
        return withLog({ ...prev, attendance }, "mark", "attendance", `Cleared ${label}.`);
      }
      const now = new Date().toISOString();
      if (payload.recordId) {
        attendance = attendance.map((a) =>
          a.id === payload.recordId
            ? { ...a, status: payload.status!, slotLabel: payload.slotLabel, startTime: payload.startTime, endTime: payload.endTime, updatedAt: now }
            : a,
        );
      } else if (!payload.isExtra) {
        const existing = attendance.find(
          (a) => a.courseId === payload.courseId && a.date === payload.date && !a.isExtra && a.slotId === payload.slotId,
        );
        attendance = existing
          ? attendance.map((a) => (a.id === existing.id ? { ...a, status: payload.status!, updatedAt: now } : a))
          : [
              ...attendance,
              {
                id: uid("att"),
                courseId: payload.courseId,
                date: payload.date,
                slotId: payload.slotId,
                slotLabel: payload.slotLabel,
                startTime: payload.startTime,
                endTime: payload.endTime,
                status: payload.status,
                isExtra: false,
                createdAt: now,
                updatedAt: now,
              },
            ];
      } else {
        attendance = [
          ...attendance,
          {
            id: uid("att"),
            courseId: payload.courseId,
            date: payload.date,
            slotId: null,
            slotLabel: payload.slotLabel || "Extra",
            startTime: payload.startTime,
            endTime: payload.endTime,
            status: payload.status,
            isExtra: true,
            createdAt: now,
            updatedAt: now,
          },
        ];
      }
      return withLog({ ...prev, attendance }, "mark", "attendance", `Marked ${label} ${payload.status}.`);
    });
  };

  const saveHoliday = (holiday: Holiday, isNew: boolean) => {
    commit((prev) =>
      withLog(
        { ...prev, holidays: isNew ? [...prev.holidays, holiday] : prev.holidays.map((h) => (h.id === holiday.id ? holiday : h)) },
        isNew ? "create" : "update",
        "holiday",
        `${isNew ? "Marked" : "Updated"} ${holiday.title} (${holiday.startDate}${holiday.endDate !== holiday.startDate ? `–${holiday.endDate}` : ""}).`,
      ),
    );
  };

  const deleteHoliday = (id: string) => {
    commit((prev) => {
      const holiday = prev.holidays.find((h) => h.id === id);
      return withLog(
        { ...prev, holidays: prev.holidays.filter((h) => h.id !== id) },
        "delete",
        "holiday",
        `Removed ${holiday?.title ?? "holiday"}. Those days count as lectures again.`,
      );
    });
  };

  const saveReminder = (reminder: Reminder, isNew: boolean) => {
    commit((prev) =>
      withLog(
        {
          ...prev,
          reminders: isNew ? [...prev.reminders, reminder] : prev.reminders.map((r) => (r.id === reminder.id ? reminder : r)),
        },
        isNew ? "create" : "update",
        "reminder",
        `${isNew ? "Added" : "Updated"} reminder “${reminder.title}”.`,
      ),
    );
  };

  const deleteReminder = (id: string) => {
    commit((prev) => {
      const reminder = prev.reminders.find((r) => r.id === id);
      return withLog(
        { ...prev, reminders: prev.reminders.filter((r) => r.id !== id) },
        "delete",
        "reminder",
        `Deleted reminder “${reminder?.title ?? ""}”.`,
      );
    });
  };

  const toggleReminder = (id: string) => {
    commit((prev) => {
      const reminder = prev.reminders.find((r) => r.id === id);
      const completed = !reminder?.completed;
      return withLog(
        {
          ...prev,
          reminders: prev.reminders.map((r) =>
            r.id === id ? { ...r, completed, updatedAt: new Date().toISOString() } : r,
          ),
        },
        "update",
        "reminder",
        `${completed ? "Completed" : "Reopened"} “${reminder?.title ?? "reminder"}”.`,
      );
    });
  };

  const addTopicGroups = (courseId: string, groups: { unit: string; topics: string[] }[]) => {
    commit((prev) => {
      let units = [...prev.units];
      let topics = [...prev.topics];
      let added = 0;
      groups.forEach((group) => {
        let unit = units.find((u) => u.courseId === courseId && u.name.toLowerCase() === group.unit.toLowerCase());
        if (!unit) {
          unit = {
            id: uid("unit"),
            courseId,
            name: group.unit || "General",
            order: units.filter((u) => u.courseId === courseId).length,
          };
          units = [...units, unit];
        }
        const base = topics.filter((t) => t.unitId === unit!.id).length;
        const next = group.topics.map((title, index) => ({
          id: uid("top"),
          unitId: unit!.id,
          courseId,
          title,
          status: "pending" as TopicStatus,
          order: base + index,
        }));
        topics = [...topics, ...next];
        added += next.length;
      });
      return withLog({ ...prev, units, topics }, "create", "syllabus", `Added ${added} topic${added === 1 ? "" : "s"}.`);
    });
  };

  const setTopicStatus = (id: string, status: TopicStatus) => {
    commit((prev) => {
      const topic = prev.topics.find((t) => t.id === id);
      return withLog(
        { ...prev, topics: prev.topics.map((t) => (t.id === id ? { ...t, status } : t)) },
        "update",
        "syllabus",
        `Marked “${topic?.title ?? "topic"}” ${status.replace("_", " ")}.`,
      );
    });
  };

  const deleteTopic = (id: string) => {
    commit((prev) => {
      const topic = prev.topics.find((t) => t.id === id);
      return withLog(
        { ...prev, topics: prev.topics.filter((t) => t.id !== id) },
        "delete",
        "syllabus",
        `Removed topic “${topic?.title ?? ""}”.`,
      );
    });
  };

  const deleteUnit = (id: string) => {
    commit((prev) => {
      const unit = prev.units.find((u) => u.id === id);
      return withLog(
        {
          ...prev,
          units: prev.units.filter((u) => u.id !== id),
          topics: prev.topics.filter((t) => t.unitId !== id),
        },
        "delete",
        "syllabus",
        `Removed ${unit?.name ?? "unit"} and its topics.`,
      );
    });
  };

  const importCourses = (courses: Course[]) => {
    const existing = new Set(state.courses.map((c) => c.code.toLowerCase()));
    const fresh = courses.filter((c) => !existing.has(c.code.toLowerCase()));
    if (fresh.length) {
      commit((prev) =>
        withLog(
          { ...prev, courses: [...prev.courses, ...fresh] },
          "create",
          "course",
          `Imported ${fresh.length} course${fresh.length === 1 ? "" : "s"} from a timetable.`,
        ),
      );
    }
    return courses.length - fresh.length;
  };

  const dismissSample = () => setState((prev) => ({ ...prev, meta: { ...prev.meta, sampleBannerDismissed: true } }));
  const resetAll = () => setState(emptyState());
  const loadSample = () => setState(reconcileSessions(createSampleState(), todayStr()));
  const importBackup = (incoming: AppState) => setState(reconcileSessions(normalize(incoming), todayStr()));

  const value: AppContextValue = {
    state,
    today,
    ready,
    sheet,
    confirm,
    toasts,
    openSheet: setSheet,
    closeSheet: () => setSheet(null),
    askConfirm: setConfirm,
    closeConfirm: () => setConfirm(null),
    pushToast,
    saveCourse,
    deleteCourse,
    setSessionStart,
    saveExam,
    saveExams,
    deleteExam,
    setMark,
    saveHoliday,
    deleteHoliday,
    saveReminder,
    deleteReminder,
    toggleReminder,
    addTopicGroups,
    setTopicStatus,
    deleteTopic,
    deleteUnit,
    importCourses,
    dismissSample,
    resetAll,
    loadSample,
    importBackup,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
