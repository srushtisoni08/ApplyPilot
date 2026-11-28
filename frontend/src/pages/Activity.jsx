import { useEffect, useState } from "react";
import { api } from "../api";
import { Button, EmptyState, LoadingState, StatusMessage } from "../components/UI";

const TONE = {
  ok: "text-ok",
  failed: "text-bad",
  error: "text-bad",
  blocked: "text-warn",
  needs_attention: "text-warn",
};
const LEVEL = { read: "read-only", draft: "draft, needs your approval", submit: "submit" };

const brief = (o) => {
  if (!o) return "";
  const s = JSON.stringify(o);
  return s.length > 140 ? s.slice(0, 140) + "..." : s;
};

function Stat({ n, label, children }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="num font-display text-2xl font-semibold text-ink">{n}</p>
      <p className="mt-0.5 text-[13px] text-muted">{label}</p>
      {children}
    </div>
  );
}

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Activity</h1>
        <p className="mt-2 text-sm text-muted">A record of everything done on your behalf and who approved it.</p>
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="font-display text-base font-semibold text-ink">Run the agent</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              It reads your inbox, scores new jobs and checks for replies. It can draft resumes, but it never sends anything: every submission still waits for your approval.
            </p>
          </div>
          <Button onClick={run} loading={busy}>{busy ? "Running..." : "Run now"}</Button>
        </div>
        <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-4 w-4 accent-[var(--brand-solid)]" />
          Also draft resumes for suitable jobs (up to 3)
        </label>

        <StatusMessage message={error} error />
        {report?.blocked && <div className="mt-4"><StatusMessage message={report.blocked} error /></div>}

        {report && !report.blocked && (
          <div className="mt-6 space-y-5 border-t border-line pt-5">
            {report.steps.length === 0 ? (
              <p className="text-sm text-muted">Nothing to do right now.</p>
            ) : (
              <ol className="space-y-3">
                {report.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className={`mt-0.5 w-14 shrink-0 text-xs font-semibold ${s.ok ? TONE.ok : TONE.failed}`}>{s.ok ? "Done" : "Problem"}</span>
                    <div>
                      <p className="font-medium text-ink">{s.tool} <span className="font-normal text-muted">· {LEVEL[s.level] || s.level}</span></p>
                      <p className="text-muted">{s.reason}</p>
                      {s.note && <p className="text-warn">{s.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat n={report.state.waiting_for_you} label="waiting for your approval" />
              <Stat n={report.state.needs_attention.length} label="need attention">
                {report.state.needs_attention.map((a) => <p key={a.application_id} className="mt-1 truncate text-xs text-muted">{a.company} · {a.role}</p>)}
              </Stat>
              <Stat n={report.state.manual_only.length} label="have no link or email, apply by hand">
                {report.state.manual_only.map((a) => <p key={a.opportunity_id} className="mt-1 truncate text-xs text-muted">{a.company} · {a.role}</p>)}
              </Stat>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-base font-semibold text-ink">Log</h2>
        <div className="mt-3 overflow-x-auto">
          {rows === null ? <LoadingState label="Loading activity..." /> : rows.length === 0 ? (
            <EmptyState title="Nothing logged yet" description="Actions appear here once you scan an inbox or start an application." />
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-[13px] text-muted">
                <tr><th className="py-2 pr-4 font-medium">Time</th><th className="py-2 pr-4 font-medium">Action</th><th className="py-2 pr-4 font-medium">Result</th><th className="py-2 pr-4 font-medium">Approved by</th><th className="py-2 font-medium">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="num whitespace-nowrap py-3 pr-4 text-muted">{String(r.time).replace("T", " ").slice(0, 16)}</td>
                    <td className="py-3 pr-4 font-medium text-ink">{r.tool}</td>
                    <td className={`py-3 pr-4 font-medium ${TONE[r.status] || TONE.ok}`}>{r.status}</td>
                    <td className="py-3 pr-4 text-muted">{r.approved_by || "-"}</td>
                    <td className="break-all py-3 text-xs text-muted">{brief(r.output)}</td>
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
