import { useEffect, useState } from "react";
import { Check, ExternalLink, ShieldAlert } from "lucide-react";
import { api } from "../api";
import { Button, ConfirmationModal, EmptyState, LoadingState, StatusMessage } from "../components/UI";

function Heading({ item, kind }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted">{kind}</p>
      <h2 className="mt-0.5 truncate font-display text-lg font-semibold text-ink">{item.role || "Role not specified"}</h2>
      <p className="truncate text-sm text-muted">{item.company || "Company not specified"}</p>
    </div>
  );
}

function SubmissionReview({ item, working, onDecide }) {
  const email = item.method === "email";
  return (
    <article className="card overflow-hidden border-warn/40">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5 sm:px-6">
        <Heading item={item} kind="Final review before sending" />
        <p className="max-w-xs text-[13px] leading-5 text-muted">
          {email ? "Approving sends the email below from your Gmail account." : "Approving submits this form to the company."} Nothing goes out before then.
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {!email && (
          <figure className="overflow-hidden rounded-xl border border-line bg-surface-2">
            <figcaption className="border-b border-line px-4 py-2.5 text-[13px] font-medium text-muted">What the form looks like now</figcaption>
            <img src={`${api.screenshotUrl(item.application_id)}&t=${item.approval_id}`} alt="Screenshot of the filled application form" crossOrigin="use-credentials" className="max-h-[480px] w-full object-contain object-top" />
          </figure>
        )}

        {!!item.preview?.length && (
          <dl className="divide-y divide-line rounded-xl border border-line">
            {item.preview.map((p, i) => (
              <div key={`${p.label}-${i}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
                <dt className="text-sm text-muted">{p.label}</dt>
                <dd className="break-words whitespace-pre-wrap text-sm text-ink">{p.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button variant="secondary" onClick={() => onDecide(item, "rejected")} disabled={working}>Cancel this one</Button>
          <Button onClick={() => onDecide(item, "approved")} disabled={working} icon={Check}>{email ? "Approve and send" : "Approve and submit"}</Button>
        </div>
      </div>
    </article>
  );
}

function ResumeReview({ item, working, onDecide }) {
  const passed = !!item.fact_check?.passed;
  const skills = item.selected?.skills || [];
  const projects = item.selected?.projects || [];
  return (
    <article className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5 sm:px-6">
        <Heading item={item} kind="Resume and cover letter" />
        <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${passed ? "text-ok" : "text-bad"}`}>
          {passed ? <Check className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {passed ? "Facts match your profile" : "Fact check found problems"}
        </span>
      </div>

      {!passed && (
        <div className="border-b border-bad/25 bg-bad-bg px-5 py-4 text-sm text-bad sm:px-6">
          <p className="font-semibold">Fix these before you can approve:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">{(item.fact_check?.issues || []).map((issue, i) => <li key={i}>{issue}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-px bg-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <section className="bg-surface p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-ink">Resume</h3>
          <p className="mt-1 text-sm text-muted">Open it and read it through before approving.</p>
          <div className="mt-4 flex flex-col items-start gap-2 text-sm font-medium">
            <a className="inline-flex items-center gap-1.5 text-brand hover:underline" href={api.fileUrl(item.application_id, "pdf")} target="_blank" rel="noreferrer">Open PDF <ExternalLink className="h-3.5 w-3.5" /></a>
            <a className="inline-flex items-center gap-1.5 text-brand hover:underline" href={api.fileUrl(item.application_id, "docx")} target="_blank" rel="noreferrer">Download Word file <ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
          <div className="mt-6 border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-ink">Pulled from your profile</h3>
            <p className="mt-1.5 text-sm leading-6 text-muted">
              {skills.length ? skills.join(", ") : "No skills selected."}
              {projects.length > 0 && <><br /><span className="text-ink">Projects:</span> {projects.join(", ")}</>}
            </p>
          </div>
        </section>
        <section className="bg-surface p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-ink">Cover letter</h3>
          <div className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-4 text-sm leading-6 text-ink/90">{item.cover_letter || "No cover letter preview available."}</div>
        </section>
      </div>

      <div className="flex flex-col-reverse justify-end gap-2 border-t border-line p-4 sm:flex-row sm:px-6">
        <Button variant="secondary" onClick={() => onDecide(item, "rejected")} disabled={working}>Reject</Button>
        <Button onClick={() => onDecide(item, "approved")} disabled={working || !passed}>Approve resume</Button>
      </div>
    </article>
  );
}

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
    api.approvals(userId)
      .then((approvals) => { if (active) { setItems(approvals); setError(""); } })
      .catch((e) => { if (active) setError(`Could not load approvals: ${e.message}`); })
      .finally(() => { if (active) setLoading(false); });
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
      if (result.application_status === "needs_attention") setError(result.message || "This application needs attention.");
      else setMsg(result.message || `Decision saved. Status: ${result.application_status}.`);
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

  if (loading) return <LoadingState label="Loading items waiting for you..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Approvals</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          {items.length ? `${items.length} waiting. ApplyPilot won't send anything until you've approved it here.` : "ApplyPilot won't send anything until you've approved it here."}
        </p>
      </div>

      <StatusMessage message={error || msg} error={!!error} />
      {busy && <div role="status" className="rounded-xl bg-brand-bg px-4 py-3 text-sm text-brand">Working on it. Submitting to a real website can take up to a minute.</div>}

      {items.length === 0 && !error ? (
        <EmptyState title="Nothing to review" description="When a resume is ready or a form has been filled, it shows up here." />
      ) : (
        <div className="space-y-5">
          {items.map((item) => item.kind === "submission"
            ? <SubmissionReview key={item.approval_id} item={item} working={busy === item.approval_id} onDecide={requestDecision} />
            : <ResumeReview key={item.approval_id} item={item} working={busy === item.approval_id} onDecide={requestDecision} />)}
        </div>
      )}

      {confirmation && (
        <ConfirmationModal
          title={confirmation.method === "email" ? "Send this application email?" : "Submit this application?"}
          description={confirmation.method === "email" ? "ApplyPilot will send the reviewed message and resume from your connected Gmail account. This can't be undone." : "ApplyPilot will submit the reviewed form to the employer. Check that every detail on screen is correct first."}
          confirmLabel={confirmation.method === "email" ? "Send email" : "Submit application"}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => decide(confirmation, "approved")}
          busy={busy === confirmation.approval_id}
        />
      )}
    </div>
  );
}
