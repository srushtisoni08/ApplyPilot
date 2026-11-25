import { useEffect, useState } from "react";
import { api } from "../api";

const STATUS = {
  draft: "bg-slate-100 text-slate-700",
  awaiting_approval: "bg-yellow-100 text-yellow-800",
  ready: "bg-blue-100 text-blue-800",
  awaiting_submit: "bg-yellow-100 text-yellow-800",
  submitting: "bg-yellow-100 text-yellow-800",
  submitted: "bg-green-100 text-green-800",
  needs_attention: "bg-red-100 text-red-800",
  interview: "bg-purple-100 text-purple-800",
  rejected: "bg-slate-200 text-slate-700",
};
const CAN_FILL = ["ready", "needs_attention", "awaiting_submit"];

export default function Applications({ userId, onFilled }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [watch, setWatch] = useState(false);

  const load = async () => {
    try {
      setRows(await api.applications(userId));
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };
  useEffect(() => {
    load();
  }, [userId]);

  const fill = async (id) => {
    setBusy("Opening the form and filling it...");
    setMsg("");
    try {
      const r = await api.fill(id, watch);
      if (r.status === "needs_attention") {
        setMsg(`Needs your attention: ${r.reason}${r.missing ? " (" + r.missing.join(", ") + ")" : ""}`);
        await load();
      } else {
        onFilled?.();
      }
    } catch (e) {
      setMsg("Error: " + e.message);
      await load();
    }
    setBusy("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Applications</h2>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={watch} onChange={(e) => setWatch(e.target.checked)} />
          Show browser while filling
        </label>
      </div>
      {busy && <p className="text-sm text-blue-600">{busy}</p>}
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-amber-700"}`}>{msg}</p>}
      {rows.length === 0 && <p className="text-sm text-slate-500">No applications yet. Prepare one from Opportunities.</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="p-3">Company</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Submitted</th>
                <th className="p-3">Reference</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.application_id} className="border-t">
                  <td className="p-3 font-medium">{r.company || "-"}</td>
                  <td className="p-3">{r.role || "-"}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[r.status] || STATUS.draft}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3">{r.submitted_at ? r.submitted_at.slice(0, 10) : "-"}</td>
                  <td className="p-3">{r.reference_number || "-"}</td>
                  <td className="p-3 text-right">
                    {CAN_FILL.includes(r.status) && (
                      <button
                        onClick={() => fill(r.application_id)}
                        disabled={!!busy}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50"
                      >
                        Fill form
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}