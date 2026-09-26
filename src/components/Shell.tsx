import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, BookOpen, BookPlus, CalendarDays, GraduationCap, Home, ListChecks, ListPlus, Plus, TreePalm, Upload, UserCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { overdueReminders } from "../lib/selectors";
import { cn } from "../utils/cn";
import { SheetHost } from "./forms";
import { ConfirmDialog, SkeletonHome } from "./ui";
import { HomePage } from "../pages/HomePage";
import { AttendancePage, PastAttendancePage } from "../pages/AttendancePage";
import { PlannerPage } from "../pages/PlannerPage";
import { CalendarPage } from "../pages/CalendarPage";
import { SyllabusPage } from "../pages/SyllabusPage";
import { BacklogsPage, CoursePage, LogsPage, SettingsPage } from "../pages/MorePages";

const TABS = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/attendance", label: "Attendance", icon: UserCheck, match: (p: string) => p.startsWith("/attendance") || p.startsWith("/course") },
  { to: "/planner", label: "Planner", icon: ListChecks, match: (p: string) => p.startsWith("/planner") || p.startsWith("/backlogs") },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/calendar") },
  { to: "/syllabus", label: "Syllabus", icon: BookOpen, match: (p: string) => p.startsWith("/syllabus") },
];

export function Shell() {
  const { ready, sheet, confirm, closeConfirm, toasts, today, state } = useApp();
  const location = useLocation();
  const reduce = useReducedMotion();
  const overdue = overdueReminders(state).length;

  useEffect(() => {
    document.querySelector(".app-scroll")?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="app-viewport">
      <div className="app-phone">
        <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-[#7b6cff]/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-32 h-48 w-48 rounded-full bg-[#5eead4]/10 blur-3xl" />
        <div className="app-scroll">
          {ready ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, filter: "blur(10px)" }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(8px)" }}
                transition={{ duration: reduce ? 0.01 : 0.34, ease: [0.22, 1, 0.36, 1] }}
              >
                <Routes location={location}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/attendance/past" element={<PastAttendancePage />} />
                  <Route path="/planner" element={<PlannerPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/syllabus" element={<SyllabusPage />} />
                  <Route path="/course/:id" element={<CoursePage />} />
                  <Route path="/logs" element={<LogsPage />} />
                  <Route path="/backlogs" element={<BacklogsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          ) : (
            <SkeletonHome />
          )}
        </div>
        {!sheet ? <SpeedDial /> : null}
        <nav className="dock" aria-label="Primary">
          {TABS.map((tab) => {
            const active = tab.match(location.pathname);
            const Icon = tab.icon;
            return (
              <NavLink key={tab.to} to={tab.to} className="relative grid place-items-center gap-0.5 py-1.5 text-[10px] font-semibold">
                {active ? <motion.span layoutId="tab-pill" className="absolute inset-1 rounded-2xl bg-white/10" transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
                <span className={cn("relative", active ? "text-white" : "text-white/45")}>
                  <Icon size={18} />
                  {tab.to === "/planner" && overdue > 0 ? <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-rose-400" /> : null}
                </span>
                <span className={cn("relative max-w-full truncate text-[9px] tracking-tight", active ? "text-white" : "text-white/45")}>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <SheetHost />
        <ConfirmDialog
          open={Boolean(confirm)}
          title={confirm?.title ?? ""}
          body={confirm?.body ?? ""}
          confirmLabel={confirm?.confirmLabel ?? "Confirm"}
          danger={confirm?.danger}
          onConfirm={() => confirm?.onConfirm()}
          onClose={closeConfirm}
        />
        <div className="pointer-events-none absolute inset-x-4 top-[calc(12px+env(safe-area-inset-top))] z-[70] space-y-2">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div key={toast.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass pointer-events-auto rounded-2xl px-3.5 py-3">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.body ? <p className="text-xs text-white/55">{toast.body}</p> : null}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <span className="sr-only">{today}</span>
      </div>
    </div>
  );
}

function SpeedDial() {
  const { openSheet, today } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);
  const actions = [
    { label: "Mark attendance", icon: UserCheck, run: () => navigate(`/attendance/past?date=${today}`) },
    { label: "New reminder", icon: Bell, run: () => openSheet({ kind: "reminder" }) },
    { label: "Add exam", icon: GraduationCap, run: () => openSheet({ kind: "exam" }) },
    { label: "Add course", icon: BookPlus, run: () => openSheet({ kind: "course" }) },
    { label: "Add topics", icon: ListPlus, run: () => openSheet({ kind: "topics" }) },
    { label: "Mark holiday", icon: TreePalm, run: () => openSheet({ kind: "holiday" }) },
    { label: "Import timetable", icon: Upload, run: () => openSheet({ kind: "import" }) },
  ];
  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button type="button" aria-label="Close quick actions" className="absolute inset-0 z-[35] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
        ) : null}
      </AnimatePresence>
      <div className="absolute right-[18px] z-40 flex flex-col items-end" style={{ bottom: "calc(92px + env(safe-area-inset-bottom))" }}>
        <AnimatePresence>
          {open ? (
            <div className="mb-3 flex flex-col-reverse items-end gap-2.5">
              {actions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.label}
                    type="button"
                    initial={{ opacity: 0, y: 10, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.92 }}
                    transition={{ delay: index * 0.035, type: "spring", stiffness: 420, damping: 28 }}
                    className="press flex items-center gap-2"
                    onClick={() => {
                      setOpen(false);
                      action.run();
                    }}
                  >
                    <span className="rounded-full border border-white/10 bg-[#12131c]/90 px-3 py-1.5 text-xs font-semibold shadow-lg">{action.label}</span>
                    <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-[#161722] text-white shadow-lg">
                      <Icon size={18} />
                    </span>
                  </motion.button>
                );
              })}
            </div>
          ) : null}
        </AnimatePresence>
        <button type="button" className="fab press grid place-items-center" aria-label={open ? "Close quick actions" : "Quick actions"} onClick={() => setOpen((v) => !v)}>
          {open ? <X size={22} /> : <Plus size={24} />}
        </button>
      </div>
    </>
  );
}
