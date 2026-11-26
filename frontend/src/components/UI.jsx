import { AlertCircle, CheckCircle2, LoaderCircle, Search } from "lucide-react";

export function LoadingState({ label = "Loading..." }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#DADCE0] bg-white px-5 py-6 text-sm text-[#5F6368]">
      <LoaderCircle className="h-5 w-5 animate-spin text-[#0B57D0]" />
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="grid justify-items-center rounded-2xl border border-dashed border-[#DADCE0] bg-white px-6 py-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#F1F3F4] text-[#5F6368]">
        <Search className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-[#202124]">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-[#5F6368]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatusMessage({ message, error = false }) {
  if (!message) return null;
  const Icon = error ? AlertCircle : CheckCircle2;
  return (
    <div role={error ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${error ? "bg-[#FCE8E6] text-[#B3261E]" : "bg-[#E6F4EA] text-[#137333]"}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function StatusBadge({ status }) {
  const styles = {
    suitable: "bg-[#E6F4EA] text-[#137333]",
    unsuitable: "bg-[#FCE8E6] text-[#B3261E]",
    uncertain: "bg-[#FEF7E0] text-[#8D5B00]",
    draft: "bg-[#F1F3F4] text-[#5F6368]",
    awaiting_approval: "bg-[#FEF7E0] text-[#8D5B00]",
    ready: "bg-[#E8F0FE] text-[#0B57D0]",
    awaiting_submit: "bg-[#FEF7E0] text-[#8D5B00]",
    submitting: "bg-[#FEF7E0] text-[#8D5B00]",
    submitted: "bg-[#E6F4EA] text-[#137333]",
    needs_attention: "bg-[#FCE8E6] text-[#B3261E]",
    interview: "bg-[#F3E8FD] text-[#7627BB]",
    rejected: "bg-[#F1F3F4] text-[#5F6368]",
    offer: "bg-[#E6F4EA] text-[#137333]",
  };
  const label = (status || "draft").replaceAll("_", " ");
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[status] || styles.draft}`}>{label}</span>;
}

export function StatCard({ label, value, detail, icon: Icon, tone = "blue" }) {
  const colors = {
    blue: "bg-[#E8F0FE] text-[#0B57D0]",
    green: "bg-[#E6F4EA] text-[#137333]",
    amber: "bg-[#FEF7E0] text-[#8D5B00]",
    slate: "bg-[#F1F3F4] text-[#5F6368]",
  };
  return (
    <article className="rounded-2xl border border-[#DADCE0] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#5F6368]">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#202124]">{value}</p>
        </div>
        {Icon && <div className={`grid h-10 w-10 place-items-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></div>}
      </div>
      {detail && <p className="mt-2 text-xs text-[#5F6368]">{detail}</p>}
    </article>
  );
}

export function ConfirmationModal({ title, description, confirmLabel, onConfirm, onCancel, busy = false, danger = false }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#202124]/40 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="confirmation-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="confirmation-title" className="text-lg font-semibold text-[#202124]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#5F6368]">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-full px-4 py-2 text-sm font-medium text-[#5F6368] hover:bg-[#F1F3F4] disabled:opacity-50">Go back</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${danger ? "bg-[#D93025] hover:bg-[#B3261E]" : "bg-[#0B57D0] hover:bg-[#0842A0]"}`}>{busy ? "Working..." : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
