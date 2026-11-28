import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Inbox, LoaderCircle } from "lucide-react";
import AnimatedNumber from "./AnimatedNumber";

/* ---------- Button ---------- */
const VARIANTS = {
  primary: "bg-brand-solid text-white shadow-sm hover:bg-brand-strong",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "bg-bad text-white hover:opacity-90",
};
const SIZES = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]" };

export function Button({ variant = "primary", size = "md", loading = false, icon: Icon, href, className = "", children, disabled, ...rest }) {
  const cls = `inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  const inner = (
    <>
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </>
  );
  if (href) {
    return (
      <motion.a href={href} whileTap={{ scale: 0.97 }} className={cls} {...rest}>
        {inner}
      </motion.a>
    );
  }
  return (
    <motion.button whileTap={disabled || loading ? undefined : { scale: 0.97 }} disabled={disabled || loading} className={cls} {...rest}>
      {inner}
    </motion.button>
  );
}

/* ---------- Tooltip (CSS only, shows on hover and keyboard focus) ---------- */
export function Tip({ label, children }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#101828] px-2 py-1 text-xs font-medium text-white opacity-0 shadow-pop transition-opacity delay-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

/* ---------- Loading / empty / messages ---------- */
export function Skeleton({ className = "" }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function LoadingState({ label = "Loading..." }) {
  return (
    <div className="card flex items-center gap-3 px-5 py-6 text-sm text-muted" role="status">
      <LoaderCircle className="h-5 w-5 animate-spin text-brand" />
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action, icon: Icon = Inbox }) {
  return (
    <div className="grid justify-items-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-14 text-center">
      <div className="relative mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand-bg text-brand">
        <span aria-hidden="true" className="absolute -inset-2 rounded-[1.25rem] border border-dashed border-brand/30" />
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-6 text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function StatusMessage({ message, error = false }) {
  if (!message) return null;
  const Icon = error ? AlertCircle : CheckCircle2;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${error ? "border-bad/25 bg-bad-bg text-bad" : "border-ok/25 bg-ok-bg text-ok"}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/* ---------- Status badge ---------- */
const BADGE = {
  suitable: "bg-ok-bg text-ok",
  unsuitable: "bg-bad-bg text-bad",
  uncertain: "bg-warn-bg text-warn",
  draft: "bg-surface-2 text-muted",
  awaiting_approval: "bg-warn-bg text-warn",
  ready: "bg-brand-bg text-brand",
  awaiting_submit: "bg-warn-bg text-warn",
  submitting: "bg-warn-bg text-warn",
  submitted: "bg-ok-bg text-ok",
  needs_attention: "bg-bad-bg text-bad",
  interview: "bg-accent-bg text-accent",
  rejected: "bg-surface-2 text-muted",
  offer: "bg-ok-bg text-ok",
};
const BADGE_LABEL = {
  awaiting_approval: "Review resume",
  awaiting_submit: "Approve submission",
  needs_attention: "Needs attention",
  submitting: "Submitting...",
  ready: "Ready to fill",
  rejected: "Rejected",
  interview: "Interview",
  offer: "Offer",
};

export function StatusBadge({ status }) {
  const label = BADGE_LABEL[status] || (status || "draft").replaceAll("_", " ");
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${BADGE[status] || BADGE.draft}`}>
      <i aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/* ---------- Stat card ---------- */
const TONES = {
  blue: "bg-brand-bg text-brand",
  green: "bg-ok-bg text-ok",
  amber: "bg-warn-bg text-warn",
  slate: "bg-surface-2 text-muted",
  violet: "bg-accent-bg text-accent",
};

export function StatCard({ label, value, detail, icon: Icon, tone = "blue" }) {
  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 360, damping: 26 }}
      className="card p-5 transition-shadow hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-muted">{label}</p>
        {Icon && (
          <div className={`grid h-9 w-9 place-items-center rounded-xl ${TONES[tone]}`}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
      </div>
      <p className="mt-3 font-display text-[2rem] font-semibold leading-none tracking-tight text-ink">
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
      </p>
      {detail && <p className="mt-2.5 text-xs text-muted">{detail}</p>}
    </motion.article>
  );
}

/* ---------- Confirmation dialog ---------- */
export function ConfirmationModal({ title, description, confirmLabel, onConfirm, onCancel, busy = false, danger = false }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 grid place-items-center bg-[#0b1120]/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-pop"
      >
        <h2 id="confirmation-title" className="font-display text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Go back</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {busy ? "Working..." : confirmLabel}
          </Button>
        </div>
      </motion.section>
    </motion.div>
  );
}