import { useEffect, useState } from "react";
import { api } from "../api";

export default function Approvals({ userId }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      setItems(await api.approvals(userId));
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };
  useEffect(() => {
    load();
  }, [userId]);

  const decide = async (id, decision) => {
    setBusy(id);
    setMsg("");
    try {
      await api.decide(id, decision);
      await load();
      setMsg(decision === "approved" ? "Approved. Application is ready." : "Rejected.");
    } catch (e) {
      setMsg("Error: " + e.message);
    }
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Waiting for you</h2>
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>{msg}</p>}
      {items.length === 0 && <p className="text-sm text-slate-500">Nothing to approve.</p>}

      {items.map((a) => (
        <div key={a.approval_id} className="rounded-xl border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{a.company || "Unknown company"}</div>
              <div className="text-sm text-slate-600">{a.role || "Unknown role"}</div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                a.fact_check?.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {a.fact_check?.passed ? "Fact check passed" : "Fact check failed"}
            </span>
          </div>

          {!a.fact_check?.passed && (
            <ul className="list-disc pl-5 text-sm text-red-700">
              {(a.fact_check?.issues || []).map((i, k) => <li key={k}>{i}</li>)}
            </ul>
          )}

          <div className="text-sm text-slate-600">
            <b>Included:</b> {(a.selected?.skills || []).join(", ")}
            {a.selected?.projects?.length > 0 && <> | Projects: {a.selected.projects.join(", ")}</>}
          </div>

          <pre className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm font-sans">{a.cover_letter}</pre>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a className="text-blue-600 underline" href={api.fileUrl(a.application_id, "pdf")} target="_blank" rel="noreferrer">Resume PDF</a>
            <a className="text-blue-600 underline" href={api.fileUrl(a.application_id, "docx")} target="_blank" rel="noreferrer">Resume DOCX</a>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => decide(a.approval_id, "rejected")}
                disabled={busy === a.approval_id}
                className="rounded-lg border px-4 py-2 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => decide(a.approval_id, "approved")}
                disabled={busy === a.approval_id || !a.fact_check?.passed}
                className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}