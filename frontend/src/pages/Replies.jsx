import { useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState, LoadingState, StatusBadge, StatusMessage } from "../components/UI";

const CATEGORY = {
  offer: { label: "Offer / selected", cls: "bg-[#E6F4EA] text-[#137333]" },
  interview: { label: "Interview", cls: "bg-[#E8F0FE] text-[#0B57D0]" },
  rejection: { label: "Rejection", cls: "bg-[#FCE8E6] text-[#B3261E]" },
  received: { label: "Received", cls: "bg-[#F1F3F4] text-[#444746]" },
  other: { label: "Other", cls: "bg-[#FEF7E0] text-[#B06000]" },
};
const FILTERS = [["all", "All"], ["offer", "Offers"], ["interview", "Interviews"], ["rejection", "Rejections"], ["received", "Received"], ["other", "Other"]];

const when = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
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

  const q = search.trim().toLowerCase();
  const shown = (rows || []).filter((r) =>
    (filter === "all" || r.category === filter) &&
    (!q || [r.company, r.role, r.subject, r.sender].some((v) => (v || "").toLowerCase().includes(q))));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#DADCE0] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Replies</h2>
            <p className="mt-1 max-w-2xl text-sm text-[#5F6368]">
              Emails from companies about applications you submitted. ApplyPilot reads your last 3 days of mail,
              matches each email to an application by company name, and updates the status for interviews, offers and rejections.
            </p>
          </div>
          <button onClick={check} disabled={busy} className="rounded-full bg-[#0B57D0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0842A0] disabled:opacity-50">
            {busy ? "Checking inbox..." : "Check for replies"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter === k ? "bg-[#D3E3FD] text-[#001D35]" : "bg-[#F1F3F4] text-[#444746] hover:bg-[#E8EAED]"}`}>{label}</button>
          ))}
        </div>
        {error && <div className="mt-4"><StatusMessage message={error} error /></div>}
        {note && <div className="mt-4"><StatusMessage message={note} /></div>}
      </section>

      {rows === null && !error ? <LoadingState label="Loading replies..." /> : shown.length === 0 ? (
        <EmptyState title="No replies yet" description="Replies show up here after you submit an application and the company emails you back. Press Check for replies to look now." />
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const c = CATEGORY[r.category] || CATEGORY.other;
            return (
              <li key={r.id} className="rounded-2xl border border-[#DADCE0] bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.company || "Unknown company"}</span>
                  <span className="text-sm text-[#5F6368]">{r.role}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.cls}`}>{c.label}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-[#5F6368]">
                    Application: <StatusBadge status={r.application_status} />
                  </span>
                </div>
                <div className="mt-3 text-sm font-medium text-[#202124]">{r.subject || "Reply received (details were not saved for this older email)"}</div>
                {r.sender && <div className="text-xs text-[#5F6368]">From {r.sender}</div>}
                {r.snippet && <p className="mt-2 whitespace-pre-line rounded-xl bg-[#F6F8FC] p-3 text-sm text-[#444746]">{r.snippet}{r.snippet.length >= 500 ? "..." : ""}</p>}
                {r.reason && <p className="mt-2 text-xs text-[#5F6368]">Why this label: {r.reason}</p>}
                <p className="mt-2 text-xs text-[#80868B]">Found {when(r.received_at)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}