import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CheckCheck, Clock3, FileCheck2, MailSearch, Sparkles } from "lucide-react";
import { api } from "../api";
import { EmptyState, LoadingState, StatCard, StatusBadge, StatusMessage } from "../components/UI";

const HINT = {
  draft: "Draft started",
  awaiting_approval: "Waiting for you to review the resume",
  ready: "Resume approved, ready to fill the form",
  awaiting_submit: "Form filled, waiting for your final approval",
  submitting: "Submitting now",
  needs_attention: "Not sent. Open Applications for the reason",
  rejected: "Rejected by the company",
};

function detail(item) {
  if (["submitted", "interview", "offer"].includes(item.status) && item.submitted_at) {
    const d = new Date(item.submitted_at);
    return `Submitted ${Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString()}`;
  }
  if (item.status === "needs_attention" && item.note) return item.note;
  return HINT[item.status] || "In progress";
}

export default function Dashboard({ user, pending, onNavigate, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [opportunities, approvals, applications] = await Promise.all([
        api.matches(user.id),
        api.approvals(user.id),
        api.applications(user.id),
      ]);
      setData({ opportunities, approvals, applications });
      setError("");
    } catch (e) {
      setError(`Could not load dashboard data: ${e.message}`);
    }
  }, [user.id]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.matches(user.id),
      api.approvals(user.id),
      api.applications(user.id),
    ]).then(([opportunities, approvals, applications]) => {
      if (!active) return;
      setData({ opportunities, approvals, applications });
      setError("");
    }).catch((e) => {
      if (active) setError(`Could not load dashboard data: ${e.message}`);
    });
    return () => { active = false; };
  }, [user.id, refreshKey]);

  const scan = async () => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const fetched = await api.scanEmails(user.id);
      const matched = await api.runMatching(user.id);
      await load();
      setMessage(`Inbox scan complete: ${fetched.fetched} emails checked, ${fetched.saved.length} new opportunities saved, and ${matched.matched.length} opportunities scored.`);
    } catch (e) {
      setError(`Gmail scan failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!data && !error) return <LoadingState label="Gathering your application activity..." />;

  const opportunities = data?.opportunities || [];
  const applications = data?.applications || [];
  const suitable = opportunities.filter((item) => item.category === "suitable").length;
  const submitted = applications.filter((item) => item.status === "submitted" || item.status === "interview" || item.status === "offer").length;

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#5F6368]">Your workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202124] sm:text-3xl">Good to see you, {(user.full_name || "there").split(" ")[0]}</h1>
          <p className="mt-2 text-sm text-[#5F6368]">A clear view of your opportunities and application progress.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={scan} disabled={busy || !user.gmail_connected} className="inline-flex items-center gap-2 rounded-full bg-[#0B57D0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0842A0] disabled:cursor-not-allowed disabled:opacity-50">
            <MailSearch className="h-4 w-4" />{busy ? "Scanning..." : "Scan Gmail"}
          </button>
          <button onClick={() => onNavigate("approvals")} className="inline-flex items-center gap-2 rounded-full border border-[#DADCE0] bg-white px-5 py-2.5 text-sm font-semibold text-[#202124] hover:bg-[#F8F9FA]">
            View approvals <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <StatusMessage message={error || message} error={!!error} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Matched opportunities" value={opportunities.length} icon={BriefcaseBusiness} detail="Discovered and scored from your inbox" />
        <StatCard label="Suitable matches" value={suitable} icon={Sparkles} tone="green" detail="Based on your confirmed profile" />
        <StatCard label="Pending approvals" value={data.approvals?.length ?? pending} icon={CheckCheck} tone="amber" detail="Your review is required before action" />
        <StatCard label="Submitted applications" value={submitted} icon={FileCheck2} tone="slate" detail="Submitted and later-stage applications" />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#DADCE0] bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div><h2 className="font-semibold text-[#202124]">Recent opportunities</h2><p className="mt-1 text-sm text-[#5F6368]">Your strongest matches</p></div>
            <button onClick={() => onNavigate("opportunities")} className="rounded-full p-2 text-[#0B57D0] hover:bg-[#E8F0FE]" aria-label="View all opportunities"><ArrowRight className="h-5 w-5" /></button>
          </div>
          {opportunities.length === 0 ? (
            <EmptyState title="No opportunities yet" description="Connect Gmail and scan your inbox to discover roles matched to your profile." action={<button onClick={user.gmail_connected ? scan : () => onNavigate("profile")} disabled={busy} className="rounded-full bg-[#0B57D0] px-4 py-2 text-sm font-semibold text-white">{user.gmail_connected ? "Scan Gmail" : "Connect Gmail"}</button>} />
          ) : (
            <div className="divide-y divide-[#E8EAED]">
              {opportunities.slice(0, 4).map((item) => (
                <button key={item.opportunity_id} onClick={() => onNavigate("opportunities")} className="flex w-full items-center gap-3 py-4 text-left first:pt-0 last:pb-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E8F0FE] text-[#0B57D0]"><BriefcaseBusiness className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-[#202124]">{item.role || "Role not specified"}</p><p className="truncate text-sm text-[#5F6368]">{item.company || "Company not specified"}</p></div>
                  <div className="text-right"><p className="font-semibold text-[#202124]">{Math.round(item.score)}%</p><StatusBadge status={item.category} /></div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#DADCE0] bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div><h2 className="font-semibold text-[#202124]">Application activity</h2><p className="mt-1 text-sm text-[#5F6368]">Your latest application updates</p></div>
            <button onClick={() => onNavigate("applications")} className="rounded-full p-2 text-[#0B57D0] hover:bg-[#E8F0FE]" aria-label="View all applications"><ArrowRight className="h-5 w-5" /></button>
          </div>
          {applications.length === 0 ? (
            <EmptyState title="No applications started" description="Prepare an application from any opportunity to see it tracked here." action={<button onClick={() => onNavigate("opportunities")} className="rounded-full bg-[#0B57D0] px-4 py-2 text-sm font-semibold text-white">Browse opportunities</button>} />
          ) : (
            <div className="divide-y divide-[#E8EAED]">
              {applications.slice(0, 4).map((item) => (
                <button key={item.application_id} onClick={() => onNavigate("applications")} className="flex w-full items-center gap-3 py-4 text-left first:pt-0 last:pb-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F1F3F4] text-[#5F6368]"><Clock3 className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-[#202124]">{item.role || "Role not specified"}</p><p className="truncate text-sm text-[#5F6368]">{item.company || "Company not specified"} · {detail(item)}</p></div>
                  <StatusBadge status={item.status} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
