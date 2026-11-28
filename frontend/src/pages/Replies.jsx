import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Button, EmptyState, LoadingState, StatusBadge, StatusMessage } from "../components/UI";

const CATEGORY = {
  offer: { label: "Offer", dot: "bg-ok", text: "text-ok" },
  interview: { label: "Interview", dot: "bg-brand-solid", text: "text-brand" },
  rejection: { label: "Rejection", dot: "bg-bad", text: "text-bad" },
  received: { label: "Received", dot: "bg-faint", text: "text-muted" },
  other: { label: "Other", dot: "bg-warn", text: "text-warn" },
};
const TABS = [["all", "All"], ["offer", "Offers"], ["interview", "Interviews"], ["rejection", "Rejections"], ["received", "Received"], ["other", "Other"]];

const when = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

export default function Replies({ userId, search = "" }) {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let active = true;
    api.replies(userId).then((r) => active && setRows(r)).catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, [userId]);

  const check = async () => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const r = await api.checkReplies();
      setRows(r.replies);
      setNote(r.updates.length
        ? `${r.updates.length} application(s) updated: ${r.updates.map((u) => `${u.company} is now ${u.status}`).join(", ")}`
        : "Checked your inbox. No new status changes.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows || []).filter((r) => !q || [r.company, r.role, r.subject, r.sender].some((v) => (v || "").toLowerCase().includes(q)));
  }, [rows, search]);
  const shown = searched.filter((r) => filter === "all" || r.category === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Replies</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Employer emails about applications you've sent. ApplyPilot reads the last 3 days of your inbox, matches each email to an application by company name, and updates its status.
          </p>
        </div>
        <Button onClick={check} loading={busy}>{busy ? "Checking inbox..." : "Check for replies"}</Button>
      </div>

      <StatusMessage message={error} error />
      <StatusMessage message={note} />

      <div role="tablist" aria-label="Filter replies" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, label]) => {
          const n = searched.filter((r) => k === "all" || r.category === k).length;
          const on = filter === k;
          return (
            <button key={k} role="tab" aria-selected={on} onClick={() => setFilter(k)} className={`-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${on ? "border-brand-solid text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {label} <span className="num ml-1 text-xs text-faint">{n}</span>
            </button>
          );
        })}
      </div>

      {rows === null && !error ? <LoadingState label="Loading replies..." /> : shown.length === 0 ? (
        <EmptyState title="No replies yet" description="Once a company answers an application you've sent, it shows up here. Press Check for replies to look now." />
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((r) => {
            const c = CATEGORY[r.category] || CATEGORY.other;
            return (
              <li key={r.id} className="py-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-semibold text-ink">{r.company || "Unknown company"}</span>
                  {r.role && <span className="text-sm text-muted">{r.role}</span>}
                  <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${c.text}`}><i aria-hidden="true" className={`h-2 w-2 rounded-full ${c.dot}`} />{c.label}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-muted">Application <StatusBadge status={r.application_status} /></span>
                </div>
                <p className="mt-2 text-sm font-medium text-ink">{r.subject || "Reply received (details were not saved for this older email)"}</p>
                {r.sender && <p className="text-xs text-muted">From {r.sender} · {when(r.received_at)}</p>}
                {r.snippet && <p className="mt-3 whitespace-pre-line border-l-2 border-line pl-4 text-sm leading-6 text-muted">{r.snippet}{r.snippet.length >= 500 ? "..." : ""}</p>}
                {r.reason && <p className="mt-2 text-xs text-faint">Labelled {c.label.toLowerCase()} because: {r.reason}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
