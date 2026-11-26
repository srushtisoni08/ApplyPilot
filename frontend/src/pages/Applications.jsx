import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Trash2, TriangleAlert } from "lucide-react";
import { api } from "../api";
import { ConfirmationModal, EmptyState, LoadingState, StatusBadge, StatusMessage } from "../components/UI";

const CAN_FILL = ["ready", "needs_attention", "awaiting_submit"];
const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString();
};

export default function Applications({ userId, onFilled, search = "" }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [watch, setWatch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);
  const [deleting, setDeleting] = useState(null);

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
    api.applications(userId).then((applications) => {
      if (active) {
        setRows(applications);
        setError("");
      }
    }).catch((e) => {
      if (active) setError(`Could not load applications: ${e.message}`);
    }).finally(() => {
      if (active) setLoading(false);
    });
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

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((item) => `${item.company || ""} ${item.role || ""} ${item.status || ""} ${item.reference_number || ""}`.toLowerCase().includes(query));
  }, [rows, search]);

  if (loading) return <LoadingState label="Loading your applications..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-[#5F6368]">Keep everything in one place</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202124] sm:text-3xl">Applications</h1><p className="mt-2 text-sm text-[#5F6368]">Track each application from preparation through submission.</p></div>
        <label className="flex items-center gap-2 text-sm text-[#5F6368]"><input type="checkbox" checked={watch} onChange={(event) => setWatch(event.target.checked)} className="h-4 w-4 accent-[#0B57D0]" />Show browser while filling</label>
      </div>
      {busy && <div className="rounded-xl bg-[#E8F0FE] px-4 py-3 text-sm text-[#0B57D0]">{busy}</div>}
      <StatusMessage message={error || msg} error={!!error} />
      {rows.length === 0 && !error ? <EmptyState title="No applications yet" description="Start preparing an application from one of your opportunities. Your progress will appear here." /> : visibleRows.length === 0 ? <EmptyState title="No matching applications" description="Try a different search or clear the search field." /> : (
        <div className="overflow-hidden rounded-2xl border border-[#DADCE0] bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8F9FA] text-xs font-semibold uppercase tracking-wide text-[#5F6368]"><tr><th className="px-5 py-4">Company / role</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Submitted</th><th className="px-4 py-4">Reference</th><th className="px-5 py-4 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-[#E8EAED]">
                {visibleRows.map((item) => <tr key={item.application_id} className="hover:bg-[#FAFBFF]">
                  <td className="px-5 py-4"><p className="font-semibold text-[#202124]">{item.company || "Company not specified"}</p><p className="mt-1 text-[#5F6368]">{item.role || "Role not specified"}</p></td>
                  <td className="px-4 py-4"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-4 text-[#5F6368]">{formatDate(item.submitted_at)}</td>
                  <td className="max-w-48 truncate px-4 py-4 text-[#5F6368]" title={item.reference_number || ""}>{item.reference_number || "—"}</td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-2">
                    {CAN_FILL.includes(item.status) && item.apply_method !== "none" && <button onClick={() => fill(item.application_id, item.apply_method)} disabled={!!busy} className="rounded-full bg-[#0B57D0] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0842A0] disabled:opacity-50">{item.apply_method === "email" ? "Prepare email" : "Fill form"}</button>}
                    {CAN_FILL.includes(item.status) && <button onClick={() => setConfirming(item)} disabled={!!busy} className="rounded-full border border-[#DADCE0] px-3.5 py-2 text-xs font-semibold text-[#444746] hover:bg-[#F1F3F4] disabled:opacity-50">Mark applied</button>}
                    <button onClick={() => setDeleting(item)} disabled={!!busy || item.status === "submitting"} title={item.status === "submitting" ? "A submission is in progress" : "Delete application"} aria-label={`Delete application for ${item.company || item.role || "this job"}`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-[#B3261E] hover:bg-[#FCE8E6] disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" />Delete</button>
                    {item.apply_method === "none" && CAN_FILL.includes(item.status) && <span className="inline-flex items-center gap-1 text-xs text-[#8D5B00]" title="No supported automatic application method"><TriangleAlert className="h-4 w-4" />Manual apply</span>}
                  </div></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-[#E8EAED] md:hidden">
            {visibleRows.map((item) => <article key={item.application_id} className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold text-[#202124]">{item.company || "Company not specified"}</h2><p className="mt-1 text-sm text-[#5F6368]">{item.role || "Role not specified"}</p></div><StatusBadge status={item.status} /></div>
              <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-[#5F6368]">Submitted</p><p className="mt-1">{formatDate(item.submitted_at)}</p></div><div><p className="text-xs text-[#5F6368]">Reference</p><p className="mt-1 truncate" title={item.reference_number || ""}>{item.reference_number || "—"}</p></div></div>
              <div className="flex flex-wrap gap-2">
                {CAN_FILL.includes(item.status) && item.apply_method !== "none" && <button onClick={() => fill(item.application_id, item.apply_method)} disabled={!!busy} className="rounded-full bg-[#0B57D0] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{item.apply_method === "email" ? "Prepare email" : "Fill form"}</button>}
                {CAN_FILL.includes(item.status) && <button onClick={() => setConfirming(item)} disabled={!!busy} className="rounded-full border border-[#DADCE0] px-4 py-2 text-xs font-semibold text-[#444746] disabled:opacity-50">Mark applied</button>}
                {item.apply_method === "none" && CAN_FILL.includes(item.status) && <span className="inline-flex items-center gap-1 text-xs text-[#8D5B00]"><ExternalLink className="h-4 w-4" />Apply manually</span>}
                <button onClick={() => setDeleting(item)} disabled={!!busy || item.status === "submitting"} title={item.status === "submitting" ? "A submission is in progress" : "Delete application"} aria-label={`Delete application for ${item.company || item.role || "this job"}`} className="inline-flex items-center gap-1 rounded-full border border-[#F2B8B5] px-4 py-2 text-xs font-semibold text-[#B3261E] hover:bg-[#FCE8E6] disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" />Delete</button>
              </div>
            </article>)}
          </div>
        </div>
      )}
      {confirming && <ConfirmationModal title="Mark this application as submitted?" description={`Only confirm if you have already applied to ${confirming.company || "this company"} outside ApplyPilot. This updates its tracking status and does not submit anything.`} confirmLabel="Mark as submitted" onCancel={() => setConfirming(null)} onConfirm={() => markApplied(confirming)} busy={!!busy} />}
      {deleting && <ConfirmationModal title="Delete this application?" description={`This permanently removes the ${deleting.company || deleting.role || "job"} application and its local documents from ApplyPilot, including any pending approvals. It will not withdraw an application already sent to the employer. This cannot be undone.`} confirmLabel="Delete application" onCancel={() => setDeleting(null)} onConfirm={() => deleteApplication(deleting)} busy={!!busy} danger />}
    </div>
  );
}
