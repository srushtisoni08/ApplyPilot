import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, BriefcaseBusiness, CalendarClock, CheckCheck, Clock3, FileCheck2, Lightbulb, MailSearch, Sparkles, Target, TrendingUp } from "lucide-react";
import { api } from "../api";
import ScoreRing from "../components/ScoreRing";
import { Button, EmptyState, Skeleton, StatCard, StatusBadge, StatusMessage } from "../components/UI";

const HINT = {
  draft: "Draft started",
  awaiting_approval: "Waiting for you to review the resume",
  ready: "Resume approved, ready to fill the form",
  awaiting_submit: "Form filled, waiting for your final approval",
  submitting: "Submitting now",
  needs_attention: "Not sent. Open Applications for the reason",
  rejected: "Rejected by the company",
};

const STAGES = [
  { key: "Started", statuses: ["draft", "awaiting_approval", "ready"] },
  { key: "Final review", statuses: ["awaiting_submit", "submitting"] },
  { key: "Submitted", statuses: ["submitted"] },
  { key: "Interview", statuses: ["interview"] },
  { key: "Offer", statuses: ["offer"] },
];

function detail(item) {
  if (["submitted", "interview", "offer"].includes(item.status) && item.submitted_at) {
    const d = new Date(item.submitted_at);
    return `Submitted ${Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString()}`;
  }
  if (item.status === "needs_attention" && item.note) return item.note;
  return HINT[item.status] || "In progress";
}

function daysUntil(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / 86400000);
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/* ---------- Chart pieces ---------- */
function ChartTip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lift">
      <p className="font-semibold text-ink">{p.payload.name}</p>
      <p className="num mt-0.5 text-muted">{p.value} {unit}{p.value === 1 ? "" : "s"}</p>
    </div>
  );
}

function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ScoreDistribution({ opportunities }) {
  const data = useMemo(() => {
    const bins = [0, 20, 40, 60, 80].map((start) => ({ name: `${start}-${start === 80 ? 100 : start + 19}%`, count: 0, start }));
    opportunities.forEach((o) => {
      const s = Math.max(0, Math.min(99, Math.round(o.score || 0)));
      bins[Math.floor(s / 20)].count += 1;
    });
    return bins;
  }, [opportunities]);
  return (
    <div className="h-52" role="img" aria-label={`Match score distribution: ${data.map((d) => `${d.name} ${d.count}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: "var(--line)" }} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--faint)", fontSize: 12 }} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTip unit="opportunit" />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={44} animationDuration={900}>
            {data.map((d) => <Cell key={d.name} fill="var(--brand-solid)" fillOpacity={0.45 + d.start / 160} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const CATS = [
  { key: "suitable", label: "Suitable", color: "var(--ok)" },
  { key: "uncertain", label: "Uncertain", color: "var(--warn)" },
  { key: "unsuitable", label: "Unsuitable", color: "var(--bad)" },
];

function CategoryDonut({ opportunities }) {
  const data = CATS.map((c) => ({ ...c, name: c.label, value: opportunities.filter((o) => o.category === c.key).length }));
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-40 w-40 shrink-0" role="img" aria-label={data.map((d) => `${d.label} ${d.value}`).join(", ")}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={total ? data : [{ name: "None", value: 1 }]} dataKey="value" innerRadius={50} outerRadius={72} paddingAngle={total ? 3 : 0} stroke="var(--surface)" strokeWidth={2} animationDuration={900}>
              {total ? data.map((d) => <Cell key={d.key} fill={d.color} />) : <Cell fill="var(--surface-2)" />}
            </Pie>
            {total > 0 && <Tooltip content={<ChartTip unit="opportunit" />} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><p className="num font-display text-2xl font-semibold text-ink">{total}</p><p className="text-[11px] text-muted">scored</p></div>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2.5 text-sm">
            <i aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 text-muted">{d.label}</span>
            <span className="num font-semibold text-ink">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pipeline({ applications }) {
  const data = STAGES.map((s) => ({ name: s.key, count: applications.filter((a) => s.statuses.includes(a.status)).length }));
  const attention = applications.filter((a) => a.status === "needs_attention").length;
  return (
    <>
      <div className="h-48" role="img" aria-label={`Pipeline: ${data.map((d) => `${d.name} ${d.count}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
            <XAxis type="number" allowDecimals={false} hide />
            <YAxis type="category" dataKey="name" width={84} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTip unit="application" />} />
            <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={18} animationDuration={900} background={{ fill: "var(--surface-2)", radius: 4 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {attention > 0 && <p className="mt-3 rounded-lg bg-bad-bg px-3 py-2 text-xs font-medium text-bad">{attention} application{attention === 1 ? "" : "s"} need attention</p>}
    </>
  );
}

/* ---------- Insights ---------- */
function buildInsights({ opportunities, applications, approvals }) {
  const out = [];
  const best = opportunities[0];
  if (best && best.score >= 60) out.push({ icon: Target, tone: "text-ok bg-ok-bg", title: `Strongest match: ${best.role || "a role"}${best.company ? ` at ${best.company}` : ""}`, text: `${Math.round(best.score)}% match. A good one to prepare first.`, go: "opportunities" });
  const soon = opportunities
    .map((o) => ({ o, d: daysUntil(o.deadline) }))
    .filter((x) => x.d !== null && x.d >= 0 && x.d <= 7 && x.o.category !== "unsuitable")
    .sort((a, b) => a.d - b.d);
  if (soon.length) out.push({ icon: CalendarClock, tone: "text-warn bg-warn-bg", title: `${soon.length} deadline${soon.length === 1 ? "" : "s"} within a week`, text: `${soon[0].o.company || "A company"} closes ${soon[0].d === 0 ? "today" : `in ${soon[0].d} day${soon[0].d === 1 ? "" : "s"}`}.`, go: "opportunities" });
  if (approvals.length) out.push({ icon: CheckCheck, tone: "text-brand bg-brand-bg", title: `${approvals.length} approval${approvals.length === 1 ? "" : "s"} waiting`, text: "Nothing goes out until you approve it.", go: "approvals" });
  const unprepared = opportunities.filter((o) => o.category === "suitable").length - applications.length;
  if (unprepared > 0 && opportunities.length) out.push({ icon: Sparkles, tone: "text-accent bg-accent-bg", title: `${unprepared} suitable role${unprepared === 1 ? "" : "s"} not started`, text: "Prepare an application to get a tailored resume and cover letter.", go: "opportunities" });
  const bad = applications.filter((a) => a.status === "needs_attention").length;
  if (bad) out.push({ icon: Clock3, tone: "text-bad bg-bad-bg", title: `${bad} application${bad === 1 ? "" : "s"} need attention`, text: "Open Applications to see what went wrong.", go: "applications" });
  return out.slice(0, 4);
}

function Insights({ items, onNavigate }) {
  if (!items.length) return <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">Insights appear here once you have scored opportunities.</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.title}>
          <button onClick={() => onNavigate(i.go)} className="flex w-full items-start gap-3 rounded-xl border border-line p-3.5 text-left transition-colors hover:bg-surface-2">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${i.tone}`}><i.icon className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{i.title}</span><span className="mt-0.5 block text-[13px] leading-5 text-muted">{i.text}</span></span>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-faint" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-7" role="status" aria-label="Loading dashboard">
      <Skeleton className="h-20 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 !rounded-2xl" />)}</div>
      <div className="grid gap-5 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 !rounded-2xl" />)}</div>
    </div>
  );
}

export default function Dashboard({ user, pending, onNavigate, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchAll = useCallback(
    () => Promise.all([api.matches(user.id), api.approvals(user.id), api.applications(user.id)]).then(([opportunities, approvals, applications]) => ({ opportunities, approvals, applications })),
    [user.id],
  );

  useEffect(() => {
    let active = true;
    fetchAll()
      .then((next) => { if (active) { setData(next); setError(""); } })
      .catch((e) => { if (active) setError(`Could not load dashboard data: ${e.message}`); });
    return () => { active = false; };
  }, [fetchAll, refreshKey]);

  const scan = async () => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const fetched = await api.scanEmails(user.id);
      const matched = await api.runMatching(user.id);
      setData(await fetchAll());
      setMessage(`Inbox scan complete: ${fetched.fetched} emails checked, ${fetched.saved.length} new opportunities saved, and ${matched.matched.length} opportunities scored.`);
    } catch (e) {
      setError(`Gmail scan failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const opportunities = useMemo(() => data?.opportunities || [], [data]);
  const applications = useMemo(() => data?.applications || [], [data]);
  const approvals = useMemo(() => data?.approvals || [], [data]);
  const insights = useMemo(() => buildInsights({ opportunities, applications, approvals }), [opportunities, applications, approvals]);

  if (!data && !error) return <DashboardSkeleton />;

  const suitable = opportunities.filter((o) => o.category === "suitable").length;
  const submitted = applications.filter((a) => ["submitted", "interview", "offer"].includes(a.status)).length;
  const avg = opportunities.length ? Math.round(opportunities.reduce((n, o) => n + (o.score || 0), 0) / opportunities.length) : 0;

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-brand">Your workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{greeting()}, {(user.full_name || "there").split(" ")[0]}</h1>
          <p className="mt-2 text-sm text-muted">
            {opportunities.length ? <>You have <span className="num font-semibold text-ink">{opportunities.length}</span> scored opportunities, averaging <span className="num font-semibold text-ink">{avg}%</span> match.</> : "A clear view of your opportunities and application progress."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={scan} loading={busy} disabled={!user.gmail_connected} icon={MailSearch}>{busy ? "Scanning..." : "Scan Gmail"}</Button>
          <Button variant="secondary" onClick={() => onNavigate("approvals")}>View approvals <ArrowRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <StatusMessage message={error || message} error={!!error} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Matched opportunities" value={opportunities.length} icon={BriefcaseBusiness} detail="Discovered and scored from your inbox" />
        <StatCard label="Suitable matches" value={suitable} icon={Sparkles} tone="green" detail="Based on your confirmed profile" />
        <StatCard label="Pending approvals" value={approvals.length ?? pending} icon={CheckCheck} tone="amber" detail="Your review is required before action" />
        <StatCard label="Submitted applications" value={submitted} icon={FileCheck2} tone="violet" detail="Submitted and later-stage applications" />
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Match quality" subtitle="How your opportunities score">
          {opportunities.length ? <ScoreDistribution opportunities={opportunities} /> : <p className="py-16 text-center text-sm text-muted">No scores yet.</p>}
        </Panel>
        <Panel title="Fit breakdown" subtitle="Suitable, uncertain and unsuitable">
          <CategoryDonut opportunities={opportunities} />
        </Panel>
        <Panel title="Application pipeline" subtitle="Where your applications stand">
          {applications.length ? <Pipeline applications={applications} /> : <p className="py-16 text-center text-sm text-muted">No applications started.</p>}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Panel title="Insights" subtitle="What deserves your attention" action={<Lightbulb className="h-5 w-5 text-warn" />}>
          <Insights items={insights} onNavigate={onNavigate} />
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Panel title="Top opportunities" subtitle="Your strongest matches" action={<button onClick={() => onNavigate("opportunities")} className="rounded-lg p-2 text-brand hover:bg-brand-bg" aria-label="View all opportunities"><ArrowRight className="h-5 w-5" /></button>}>
            {opportunities.length === 0 ? (
              <EmptyState title="No opportunities yet" description="Scan your inbox to discover roles matched to your profile." icon={TrendingUp} action={<Button size="sm" onClick={user.gmail_connected ? scan : () => onNavigate("profile")} disabled={busy}>{user.gmail_connected ? "Scan Gmail" : "Connect Gmail"}</Button>} />
            ) : (
              <div className="divide-y divide-line">
                {opportunities.slice(0, 4).map((item) => (
                  <button key={item.opportunity_id} onClick={() => onNavigate("opportunities")} className="flex w-full items-center gap-3 py-3.5 text-left first:pt-0 last:pb-0">
                    <ScoreRing score={item.score} category={item.category} size={44} stroke={4} />
                    <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{item.role || "Role not specified"}</p><p className="truncate text-sm text-muted">{item.company || "Company not specified"}</p></div>
                    <StatusBadge status={item.category} />
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Application activity" subtitle="Latest updates" action={<button onClick={() => onNavigate("applications")} className="rounded-lg p-2 text-brand hover:bg-brand-bg" aria-label="View all applications"><ArrowRight className="h-5 w-5" /></button>}>
            {applications.length === 0 ? (
              <EmptyState title="No applications started" description="Prepare one from any opportunity to track it here." icon={Clock3} action={<Button size="sm" onClick={() => onNavigate("opportunities")}>Browse opportunities</Button>} />
            ) : (
              <div className="divide-y divide-line">
                {applications.slice(0, 4).map((item) => (
                  <button key={item.application_id} onClick={() => onNavigate("applications")} className="flex w-full items-center gap-3 py-3.5 text-left first:pt-0 last:pb-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted"><Clock3 className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{item.role || "Role not specified"}</p><p className="truncate text-sm text-muted">{item.company || "Company not specified"} · {detail(item)}</p></div>
                    <StatusBadge status={item.status} />
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
