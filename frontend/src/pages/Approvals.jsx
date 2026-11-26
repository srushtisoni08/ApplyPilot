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
      const r = await api.decide(id, decision);
      await load();
      setMsg(`Done. Application status: ${r.application_status}`);
    } catch (e) {
      setMsg("Error: " + e.message);
    }
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Waiting for you</h2>
      {busy && <p className="text-sm text-blue-600">Working... (submitting can take a few seconds)</p>}
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>{msg}</p>}
      {items.length === 0 && <p className="text-sm text-slate-500">Nothing to approve.</p>}

      {items.map((a) =>
        a.kind === "submission" ? (
          <div key={a.approval_id} className="rounded-xl border border-amber-300 bg-white p-4 space-y-3">
            <div>
              <div className="text-xs font-medium uppercase text-amber-700">Final review before submitting</div>
              <div className="font-semibold">{a.company || "Unknown company"}</div>
              <div className="text-sm text-slate-600">{a.role || "Unknown role"}</div>
            </div>
            {a.method !== "email" && (
              <img
                src={`${api.screenshotUrl(a.application_id)}&t=${a.approval_id}`}
                alt="Filled form"
                className="w-full rounded border"
              />
            )}
            <table className="w-full text-sm">
              <tbody>
                {(a.preview || []).map((p, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1.5 pr-3 text-slate-500 align-top">{p.label}</td>
                    <td className="py-1.5 break-words">{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-sm text-amber-700">{a.method === "email" ? "Clicking Send emails this application from your Gmail." : "Clicking Submit sends this application to the company."}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => decide(a.approval_id, "rejected")}
                disabled={busy === a.approval_id}
                className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => decide(a.approval_id, "approved")}
                disabled={busy === a.approval_id}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {a.method === "email" ? "Send email" : "Submit application"}
              </button>
            </div>
          </div>
        ) : (
          <div key={a.approval_id} className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">Resume and cover letter</div>
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
        )
      )}
    </div>
  );
}