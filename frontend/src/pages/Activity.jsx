import { useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState, LoadingState, StatusMessage } from "../components/UI";

const TONE = {
  ok: "bg-[#E6F4EA] text-[#137333]",
  failed: "bg-[#FCE8E6] text-[#B3261E]",
  error: "bg-[#FCE8E6] text-[#B3261E]",
  blocked: "bg-[#FEF7E0] text-[#B06000]",
  needs_attention: "bg-[#FEF7E0] text-[#B06000]",
};
const LEVEL = { read: "Read-only", draft: "Draft, needs your approval", submit: "Submit" };

const brief = (o) => {
  if (!o) return "";
  const s = JSON.stringify(o);
  return s.length > 140 ? s.slice(0, 140) + "..." : s;
};

export default function Activity() {
  const [rows, setRows] = useState(null);
  const [report, setReport] = useState(null);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.activity().then((r) => active && setRows(r)).catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, []);

  const run = async () => {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      setReport(await api.runAgent(auto));
      setRows(await api.activity());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const card = "rounded-2xl border border-[#DADCE0] bg-white p-5";
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[#5F6368]">System logs and AI actions</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202124] sm:text-3xl">Activity</h1>
        <p className="mt-2 text-sm text-[#5F6368]">Audit log of every action taken and what was approved.</p>
      </div>
      <section className={card}>
        <h2 className="text-lg font-semibold">AI agent</h2>
        <p className="mt-1 text-sm text-[#5F6368]">
          Observe, plan, execute, verify. It reads your inbox, scores jobs and tracks replies. It can draft documents,
          but it can never submit anything: every send needs your approval.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button onClick={run} disabled={busy} className="rounded-full bg-[#0B57D0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0842A0] disabled:opacity-50">
            {busy ? "Running..." : "Run agent now"}
          </button>
          <label className="flex items-center gap-2 text-sm text-[#444746]">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Also draft resumes for suitable jobs (max 3)
          </label>
        </div>
        {error && <div className="mt-4"><StatusMessage message={error} error /></div>}

        {report?.blocked && <div className="mt-4"><StatusMessage message={report.blocked} error /></div>}
        {report && !report.blocked && (
          <div className="mt-5 space-y-4">
            <ul className="space-y-2">
              {report.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-[#F6F8FC] p-3 text-sm">
                  <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.ok ? TONE.ok : TONE.failed}`}>{s.ok ? "done" : "problem"}</span>
                  <div>
                    <div className="font-medium">{s.tool} <span className="font-normal text-[#5F6368]">({LEVEL[s.level]})</span></div>
                    <div className="text-[#5F6368]">{s.reason}</div>
                    {s.note && <div className="text-[#B06000]">{s.note}</div>}
                  </div>
                </li>
              ))}
              {report.steps.length === 0 && <li className="text-sm text-[#5F6368]">Nothing to do right now.</li>}
            </ul>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-[#DADCE0] p-3"><b>{report.state.waiting_for_you}</b> waiting for your approval</div>
              <div className="rounded-xl border border-[#DADCE0] p-3"><b>{report.state.needs_attention.length}</b> need attention{report.state.needs_attention.map((a) => <div key={a.application_id} className="text-[#5F6368]">{a.company} - {a.role}</div>)}</div>
              <div className="rounded-xl border border-[#DADCE0] p-3"><b>{report.state.manual_only.length}</b> need manual apply (no link or email){report.state.manual_only.map((a) => <div key={a.opportunity_id} className="text-[#5F6368]">{a.company} - {a.role}</div>)}</div>
            </div>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">Activity log</h2>
        <p className="mt-1 text-sm text-[#5F6368]">Every action taken for you: what ran, the result, and who approved it.</p>
        <div className="mt-4 overflow-x-auto">
          {rows === null ? <LoadingState label="Loading activity..." /> : rows.length === 0 ? (
            <EmptyState title="No activity yet" description="Actions will appear here once you scan or apply." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-[#5F6368]">
                <tr><th className="p-2">Time</th><th className="p-2">Action</th><th className="p-2">Status</th><th className="p-2">Approved by</th><th className="p-2">Details</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[#E8EAED] align-top">
                    <td className="p-2 whitespace-nowrap text-[#5F6368]">{String(r.time).replace("T", " ").slice(0, 16)}</td>
                    <td className="p-2 font-medium">{r.tool}</td>
                    <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE[r.status] || TONE.ok}`}>{r.status}</span></td>
                    <td className="p-2">{r.approved_by || "-"}</td>
                    <td className="p-2 break-all text-xs text-[#5F6368]">{brief(r.output)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}