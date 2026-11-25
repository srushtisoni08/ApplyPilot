import { useEffect, useState } from "react";
import { api } from "./api";

const TAG = {
  suitable: "bg-green-100 text-green-800",
  unsuitable: "bg-red-100 text-red-800",
  uncertain: "bg-yellow-100 text-yellow-800",
};

export default function Opportunities({ userId }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      setItems(await api.matches(userId));
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };
  useEffect(() => {
    load();
  }, [userId]);

  const scan = async () => {
    setBusy("Scanning inbox and scoring...");
    setMsg("");
    try {
      const s = await api.scanEmails(userId);
      const m = await api.runMatching(userId);
      await load();
      setMsg(
        `Fetched ${s.fetched}, saved ${s.saved.length} new, scored ${m.matched.length}.` +
          (s.errors?.length || m.errors?.length ? " Some items failed, check the backend terminal." : "") +
          (m.profile_confirmed === false ? " Note: your profile is not confirmed yet." : "")
      );
    } catch (e) {
      setMsg("Error: " + e.message);
    }
    setBusy("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Opportunities</h2>
        <button
          onClick={scan}
          disabled={!!busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Scan emails
        </button>
      </div>
      {busy && <p className="text-sm text-blue-600">{busy}</p>}
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-slate-600"}`}>{msg}</p>}

      {items.length === 0 && !busy && (
        <p className="text-sm text-slate-500">Nothing yet. Confirm your profile, then click "Scan emails".</p>
      )}

      <div className="space-y-3">
        {items.map((o) => (
          <div key={o.opportunity_id} className="rounded-xl border bg-white">
            <button
              onClick={() => setOpen(open === o.opportunity_id ? null : o.opportunity_id)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <div>
                <div className="font-semibold">{o.company || "Unknown company"}</div>
                <div className="text-sm text-slate-600">{o.role || "Unknown role"}</div>
                {o.deadline && <div className="text-xs text-slate-400">Deadline: {o.deadline}</div>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold">{Math.round(o.score)}%</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TAG[o.category]}`}>
                  {o.category}
                </span>
              </div>
            </button>
            {open === o.opportunity_id && (
              <div className="border-t px-4 py-3 text-sm space-y-2">
                <p>{o.explanation}</p>
                {o.apply_link && (
                  <a
                    href={o.apply_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline"
                  >
                    Open application link
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}