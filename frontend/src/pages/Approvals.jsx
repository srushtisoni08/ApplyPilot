import { useEffect, useState } from "react";
import { AlertTriangle, FileText, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { ConfirmationModal, EmptyState, LoadingState, StatusMessage } from "../components/UI";

export default function Approvals({ userId, onDecided }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setItems(await api.approvals(userId));
      setError("");
    } catch (e) {
      setError(`Could not load approvals: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    api.approvals(userId).then((approvals) => {
      if (active) {
        setItems(approvals);
        setError("");
      }
    }).catch((e) => {
      if (active) setError(`Could not load approvals: ${e.message}`);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  const decide = async (item, decision) => {
    setBusy(item.approval_id);
    setMsg("");
    setError("");
    try {
      const result = await api.decide(item.approval_id, decision);
      await load();
      onDecided?.();
      setMsg(`Decision saved. Application status: ${result.application_status}.`);
    } catch (e) {
      setError(`Could not update approval: ${e.message}`);
    } finally {
      setBusy(null);
      setConfirmation(null);
    }
  };

  const requestDecision = (item, decision) => {
    if (item.kind === "submission" && decision === "approved") setConfirmation(item);
    else decide(item, decision);
  };

  if (loading) return <LoadingState label="Loading items that need your review..." />;

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-medium text-[#5F6368]">Your decision matters</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202124] sm:text-3xl">Approvals</h1><p className="mt-2 text-sm text-[#5F6368]">Review every document and submission before it leaves your account.</p></div>
      <StatusMessage message={error || msg} error={!!error} />
      {busy && <div className="rounded-xl bg-[#E8F0FE] px-4 py-3 text-sm text-[#0B57D0]">Working on your decision...</div>}
      {items.length === 0 && !error ? <EmptyState title="All caught up" description="New documents and application submissions will appear here for your review." /> : (
        <div className="space-y-5">
          {items.map((item) => item.kind === "submission" ? (
            <article key={item.approval_id} className="overflow-hidden rounded-2xl border border-[#F9AB00]/60 bg-white shadow-sm">
              <div className="flex items-start gap-3 bg-[#FEF7E0] px-5 py-4 sm:px-6">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#8D5B00]" />
                <div><p className="font-semibold text-[#5F4300]">Final review before submission</p><p className="mt-1 text-sm text-[#6B5A2E]">Nothing is sent or submitted until you approve this step.</p></div>
              </div>
              <div className="space-y-5 p-5 sm:p-6">
                <div><h2 className="text-lg font-semibold text-[#202124]">{item.role || "Role not specified"}</h2><p className="text-sm text-[#5F6368]">{item.company || "Company not specified"}</p></div>
                {item.method !== "email" && (
                  <div className="overflow-hidden rounded-xl border border-[#DADCE0] bg-[#F8F9FA]">
                    <div className="flex items-center gap-2 border-b border-[#DADCE0] px-4 py-3 text-sm font-medium text-[#444746]"><FileText className="h-4 w-4" />Filled application preview</div>
                    <img src={`${api.screenshotUrl(item.application_id)}&t=${item.approval_id}`} alt="Preview of the filled application form" crossOrigin="use-credentials" className="max-h-[480px] w-full object-contain object-top" />
                  </div>
                )}
                {!!item.preview?.length && <div className="overflow-hidden rounded-xl border border-[#DADCE0]">
                  <div className="border-b border-[#E8EAED] bg-[#F8F9FA] px-4 py-3 text-sm font-medium text-[#444746]">Submission details</div>
                  <dl className="divide-y divide-[#E8EAED]">
                    {item.preview.map((preview, index) => <div key={`${preview.label}-${index}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_1fr]"><dt className="text-sm text-[#5F6368]">{preview.label}</dt><dd className="break-words whitespace-pre-wrap text-sm text-[#202124]">{preview.value}</dd></div>)}
                  </dl>
                </div>}
                <p className="rounded-xl bg-[#FEF7E0] px-4 py-3 text-sm leading-6 text-[#6B5A2E]">{item.method === "email" ? "Approving sends this application email from your connected Gmail account." : "Approving submits the filled form to the company."} Please review the details above before proceeding.</p>
                <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                  <button onClick={() => requestDecision(item, "rejected")} disabled={busy === item.approval_id} className="rounded-full border border-[#DADCE0] px-5 py-2.5 text-sm font-semibold text-[#444746] hover:bg-[#F1F3F4] disabled:opacity-50">Cancel submission</button>
                  <button onClick={() => requestDecision(item, "approved")} disabled={busy === item.approval_id} className="rounded-full bg-[#188038] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#137333] disabled:opacity-50">{item.method === "email" ? "Approve & send email" : "Approve & submit"}</button>
                </div>
              </div>
            </article>
          ) : (
            <article key={item.approval_id} className="rounded-2xl border border-[#DADCE0] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[#5F6368]">Resume and cover letter review</p><h2 className="mt-1 text-lg font-semibold text-[#202124]">{item.role || "Role not specified"}</h2><p className="text-sm text-[#5F6368]">{item.company || "Company not specified"}</p></div>
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${item.fact_check?.passed ? "bg-[#E6F4EA] text-[#137333]" : "bg-[#FCE8E6] text-[#B3261E]"}`}>
                  <ShieldCheck className="h-4 w-4" />{item.fact_check?.passed ? "Fact check passed" : "Fact check failed"}
                </span>
              </div>
              {!item.fact_check?.passed && <div className="mt-4 rounded-xl bg-[#FCE8E6] p-4 text-sm text-[#B3261E]"><p className="font-semibold">Resolve these fact-check issues before approval:</p><ul className="mt-2 list-disc space-y-1 pl-5">{(item.fact_check?.issues || []).map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-[#DADCE0] p-4">
                  <h3 className="font-semibold text-[#202124]">Resume files</h3>
                  <p className="mt-1 text-sm text-[#5F6368]">Preview or download your generated resume.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a className="rounded-full border border-[#DADCE0] px-4 py-2 text-sm font-medium text-[#0B57D0] hover:bg-[#E8F0FE]" href={api.fileUrl(item.application_id, "pdf")} target="_blank" rel="noreferrer">Preview / download PDF</a>
                    <a className="rounded-full border border-[#DADCE0] px-4 py-2 text-sm font-medium text-[#0B57D0] hover:bg-[#E8F0FE]" href={api.fileUrl(item.application_id, "docx")} target="_blank" rel="noreferrer">Download DOCX</a>
                  </div>
                </section>
                <section className="rounded-xl border border-[#DADCE0] p-4">
                  <h3 className="font-semibold text-[#202124]">Tailored cover letter</h3>
                  <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#F8F9FA] p-4 text-sm leading-6 text-[#444746]">{item.cover_letter || "No cover letter preview available."}</div>
                </section>
              </div>
              <div className="mt-4 rounded-xl bg-[#F6F8FC] p-4 text-sm text-[#5F6368]"><span className="font-semibold text-[#202124]">Profile details used: </span>{(item.selected?.skills || []).join(", ") || "No selected skills"}{item.selected?.projects?.length > 0 && <> · Projects: {item.selected.projects.join(", ")}</>}</div>
              <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
                <button onClick={() => requestDecision(item, "rejected")} disabled={busy === item.approval_id} className="rounded-full border border-[#DADCE0] px-5 py-2.5 text-sm font-semibold text-[#444746] hover:bg-[#F1F3F4] disabled:opacity-50">Reject</button>
                <button onClick={() => requestDecision(item, "approved")} disabled={busy === item.approval_id || !item.fact_check?.passed} className="rounded-full bg-[#0B57D0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0842A0] disabled:cursor-not-allowed disabled:opacity-50">Approve resume</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {confirmation && <ConfirmationModal title={confirmation.method === "email" ? "Send this application email?" : "Submit this application?"} description={confirmation.method === "email" ? "ApplyPilot will send the reviewed message and resume from your connected Gmail account. This action cannot be undone." : "ApplyPilot will submit the reviewed form to the employer. Please confirm that all visible details are correct."} confirmLabel={confirmation.method === "email" ? "Send email" : "Submit application"} onCancel={() => setConfirmation(null)} onConfirm={() => decide(confirmation, "approved")} busy={busy === confirmation.approval_id} />}
    </div>
  );
}
