import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../api";
import { Button, ConfirmationModal, EmptyState, LoadingState, StatusBadge, StatusMessage } from "../components/UI";

const CAN_FILL = ["ready", "needs_attention", "awaiting_submit"];

const TABS = [
  { key: "all", label: "All", match: () => true },
  { key: "active", label: "In progress", match: (s) => ["draft", "awaiting_approval", "ready", "awaiting_submit", "submitting"].includes(s) },
  { key: "sent", label: "Sent", match: (s) => ["submitted", "interview", "offer"].includes(s) },
  { key: "attention", label: "Needs attention", match: (s) => s === "needs_attention" },
  { key: "closed", label: "Rejected", match: (s) => s === "rejected" },
];

/* Where an application is on its way. Five steps, so the row shows progress without a chart. */
const STEPS = ["draft", "awaiting_approval", "ready", "awaiting_submit", "submitted"];
function stepIndex(status) {
  if (["interview", "offer", "rejected"].includes(status)) return STEPS.length;
  if (status === "submitting") return 4;
  const i = STEPS.indexOf(status);
  return i < 0 ? 0 : i + 1;
}

function Progress({ status }) {
  const done = stepIndex(status);
  const bad = status === "needs_attention";
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Step ${Math.min(done, STEPS.length)} of ${STEPS.length}`}>
      {STEPS.map((s, i) => (
        <span key={s} className={`h-1.5 w-5 rounded-full ${i < done ? (bad ? "bg-bad" : status === "rejected" ? "bg-faint" : "bg-brand-solid") : "bg-surface-2"}`} />
      ))}
    </div>
  );
}

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

function Actions({ item, busy, onFill, onMark, onDelete }) {
  const canFill = CAN_FILL.includes(item.status);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canFill && item.apply_method !== "none" && (
        <Button size="sm" onClick={() => onFill(item.application_id, item.apply_method)} disabled={!!busy}>{item.apply_method === "email" ? "Prepare email" : "Fill form"}</Button>
      )}
      {canFill && <Button size="sm" variant="secondary" onClick={() => onMark(item)} disabled={!!busy}>Mark applied</Button>}
      {canFill && item.apply_method === "none" && <span className="text-xs text-warn">No automatic method. Apply by hand.</span>}
      <button
        onClick={() => onDelete(item)}
        disabled={!!busy || item.status === "submitting"}
        title={item.status === "submitting" ? "A submission is in progress" : "Delete application"}
        aria-label={`Delete application for ${item.company || item.role || "this job"}`}
        className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-bad-bg hover:text-bad disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Applications({ userId, onFilled, search = "" }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [watch, setWatch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [tab, setTab] = useState("all");

  const load = async () => {
    try {
      setRows(await api.applications(userId));
      setError("");
    } catch (e) {
      setError(`Could not load applications: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    api.applications(userId)
      .then((applications) => { if (active) { setRows(applications); setError(""); } })
      .catch((e) => { if (active) setError(`Could not load applications: ${e.message}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const fill = async (id, method) => {
    setBusy(method === "email" ? "Preparing the email..." : "Opening and filling the application form...");
    setMsg("");
    setError("");
    try {
      const result = await api.fill(id, watch);
      if (result.status === "needs_attention") {
        setMsg(`Needs your attention: ${result.reason}${result.missing ? ` (${result.missing.join(", ")})` : ""}`);
        await load();
      } else {
        onFilled?.();
      }
    } catch (e) {
      setError(`Could not prepare submission: ${e.message}`);
      await load();
    } finally {
      setBusy("");
    }
  };

  const markApplied = async (item) => {
    setBusy("Updating application...");
    setMsg("");
    setError("");
    try {
      await api.markApplied(item.application_id);
      await load();
      setMsg("Application marked as submitted.");
    } catch (e) {
      setError(`Could not update application: ${e.message}`);
    } finally {
      setBusy("");
      setConfirming(null);
    }
  };

  const deleteApplication = async (item) => {
    setBusy("Deleting application...");
    setMsg("");
    setError("");
    try {
      const result = await api.deleteApplication(item.application_id);
      await load();
      setMsg(result.cleanup_warnings?.length
        ? `Application removed, but these generated files could not be deleted: ${result.cleanup_warnings.join(", ")}.`
        : "Application removed from your tracking list.");
    } catch (e) {
      setError(`Could not delete application: ${e.message}`);
    } finally {
      setBusy("");
      setDeleting(null);
    }
  };

  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((item) => `${item.company || ""} ${item.role || ""} ${item.status || ""} ${item.reference_number || ""}`.toLowerCase().includes(query));
  }, [rows, search]);

  const visibleRows = useMemo(() => searched.filter((r) => TABS.find((t) => t.key === tab).match(r.status)), [searched, tab]);

  if (loading) return <LoadingState label="Loading your applications..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Applications</h1>
          <p className="mt-2 text-sm text-muted">Everything you've started, and how far along it is.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={watch} onChange={(e) => setWatch(e.target.checked)} className="h-4 w-4 accent-[var(--brand-solid)]" />
          Show the browser while filling
        </label>
      </div>

      {busy && <div role="status" className="rounded-xl bg-brand-bg px-4 py-3 text-sm text-brand">{busy}</div>}
      <StatusMessage message={error || msg} error={!!error} />

      {rows.length === 0 && !error ? (
        <EmptyState title="No applications yet" description="Prepare one from an opportunity and it will be tracked here." />
      ) : (
        <div>
          <div role="tablist" aria-label="Filter applications" className="flex gap-1 overflow-x-auto border-b border-line">
            {TABS.map((t) => {
              const n = searched.filter((r) => t.match(r.status)).length;
              const on = tab === t.key;
              return (
                <button key={t.key} role="tab" aria-selected={on} onClick={() => setTab(t.key)} className={`-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${on ? "border-brand-solid text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                  {t.label} <span className="num ml-1 text-xs text-faint">{n}</span>
                </button>
              );
            })}
          </div>

          {visibleRows.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">{searched.length ? "Nothing in this tab." : "No applications match your search."}</p>
          ) : (
            <ul className="divide-y divide-line">
              {visibleRows.map((item) => (
                <li key={item.application_id} className="grid gap-x-6 gap-y-3 py-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{item.company || "Company not specified"}</p>
                    <p className="truncate text-sm text-muted">{item.role || "Role not specified"}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3"><StatusBadge status={item.status} /><Progress status={item.status} /></div>
                    <p className="text-xs text-muted">
                      {item.submitted_at ? `Sent ${formatDate(item.submitted_at)}` : "Not sent yet"}
                      {item.reference_number && <span className="ml-2 break-all text-faint" title="Reference">{item.reference_number}</span>}
                    </p>
                    {item.note && <p className="text-xs leading-5 text-bad">{item.note}</p>}
                  </div>
                  <Actions item={item} busy={busy} onFill={fill} onMark={setConfirming} onDelete={setDeleting} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {confirming && <ConfirmationModal title="Mark this application as submitted?" description={`Only confirm if you have already applied to ${confirming.company || "this company"} outside ApplyPilot. This updates its tracking status and does not submit anything.`} confirmLabel="Mark as submitted" onCancel={() => setConfirming(null)} onConfirm={() => markApplied(confirming)} busy={!!busy} />}
      {deleting && <ConfirmationModal title="Delete this application?" description={`This permanently removes the ${deleting.company || deleting.role || "job"} application and its local documents from ApplyPilot, including any pending approvals. It will not withdraw an application already sent to the employer. This cannot be undone.`} confirmLabel="Delete application" onCancel={() => setDeleting(null)} onConfirm={() => deleteApplication(deleting)} busy={!!busy} danger />}
    </div>
  );
}
