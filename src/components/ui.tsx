import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { formatPct } from "../lib/attendance";
import type { MarkStatus } from "../types";
import { asset } from "../lib/ids";

export function Glass({ className, children, style }: { className?: string; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={cn("glass rounded-[22px]", className)} style={style}>
      {children}
    </div>
  );
}

export function PressButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn("press", className)} {...props}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="kicker text-white/55">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1.5 block text-xs leading-relaxed text-white/55">{hint}</span> : null}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-1 rounded-2xl bg-black/30 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "press rounded-xl px-2 py-2 text-[12px] font-semibold",
            value === opt.id ? "bg-white/12 text-white shadow-sm" : "text-white/60",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const STATUS_STYLE: Record<MarkStatus, string> = {
  present: "bg-emerald-400/20 text-emerald-200",
  absent: "bg-rose-400/18 text-rose-200",
  cancelled: "bg-amber-300/15 text-amber-100",
};

export function TriState({
  value,
  onChange,
  disabled,
  includeCancelled = true,
}: {
  value: MarkStatus | null;
  onChange: (next: MarkStatus | null) => void;
  disabled?: boolean;
  includeCancelled?: boolean;
}) {
  const options: MarkStatus[] = includeCancelled ? ["present", "absent", "cancelled"] : ["present", "absent"];
  return (
    <div className={cn("grid gap-1 rounded-xl bg-black/30 p-1", disabled && "pointer-events-none opacity-40")} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }} role="group">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          aria-pressed={value === opt}
          onClick={() => onChange(value === opt ? null : opt)}
          className={cn(
            "press rounded-lg px-1 py-2 text-[11px] font-semibold capitalize",
            value === opt ? STATUS_STYLE[opt] : "text-white/60",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function ProgressRing({
  value,
  size = 72,
  stroke = 6,
  risk = false,
  label,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  risk?: boolean;
  label?: string;
}) {
  const raw = useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const text = formatPct(value);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `Attendance ${text}`}>
      <div className="absolute inset-1 rounded-full" style={{ background: risk ? "radial-gradient(circle, rgba(251,113,133,0.18), transparent 68%)" : "radial-gradient(circle, rgba(123,108,255,0.2), transparent 68%)" }} />
      <svg width={size} height={size} className="relative block">
        <defs>
          <linearGradient id={raw} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={risk ? "#fb7185" : "#d6ccff"} />
            <stop offset="100%" stopColor={risk ? "#f59e0b" : "#7b6cff"} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${raw})`}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - pct / 100) }}
            transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className={cn("font-semibold tabular-nums", size < 64 ? "text-[11px]" : "text-[13px]")}>{text}</span>
      </div>
    </div>
  );
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.055, delayChildren: 0.03 } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const controls = useDragControls();
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open ? (
        <div className="absolute inset-0 z-50">
          <motion.button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 flex max-h-[92%] flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#101119]/95 shadow-2xl backdrop-blur-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={reduce ? { duration: 0.01 } : { type: "spring", damping: 28, stiffness: 320, mass: 0.82 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 750) onClose();
            }}
          >
            <div className="flex cursor-grab justify-center py-3 active:cursor-grabbing" onPointerDown={(e) => controls.start(e)}>
              <div className="h-1.5 w-11 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pb-3">
              <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
              {subtitle ? <p className="mt-1 text-sm leading-relaxed text-white/50">{subtitle}</p> : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
            {footer ? <div className="border-t border-white/8 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="absolute inset-0 z-[60] grid place-items-end px-5 pb-8 sm:place-items-center">
          <motion.button type="button" aria-label="Dismiss" className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="glass relative w-full max-w-sm rounded-[24px] p-5"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-ghost press" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className={cn("btn press", danger ? "btn-danger" : "btn-primary")}
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function EmptyState({
  image,
  title,
  body,
  action,
}: {
  image?: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03]">
      {image ? <img src={image} alt="" className="h-40 w-full object-cover opacity-90" /> : null}
      <div className="p-5">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/50">{body}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export function SkeletonHome() {
  return (
    <div className="page space-y-4">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-2xl" />
        <div className="space-y-2">
          <div className="skeleton h-3 w-24 rounded-full" />
          <div className="skeleton h-3 w-16 rounded-full" />
        </div>
      </div>
      <div className="skeleton h-4 w-28 rounded-full" />
      <div className="skeleton h-10 w-48 rounded-2xl" />
      <div className="skeleton h-36 rounded-[24px]" />
      <div className="skeleton h-28 rounded-[24px]" />
      <div className="skeleton h-24 rounded-[24px]" />
    </div>
  );
}

export function AppHeader({ trailing }: { trailing?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <img src={asset("images/mark.jpg")} alt="" className="h-9 w-9 rounded-2xl object-cover shadow-lg shadow-violet-500/20" />
        <div>
          <div className="text-[15px] font-semibold tracking-tight">ScholarFlow</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">On this device</div>
        </div>
      </div>
      {trailing}
    </div>
  );
}

export function iconButtonClass() {
  return "press grid h-10 w-10 place-items-center rounded-2xl border border-white/8 bg-white/[0.04] text-white/80";
}

export { asset };
