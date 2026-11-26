import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, BriefcaseBusiness, CalendarDays, ExternalLink, MailSearch, MapPin, Sparkles } from "lucide-react";
import { api } from "../api";
import { EmptyState, LoadingState, StatusBadge, StatusMessage } from "../components/UI";

function formatDeadline(value) {
  if (!value) return "No deadline provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function Opportunities({ userId, onPrepared, search = "", onScanned }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [sort, setSort] = useState("match");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setItems(await api.matches(userId));
      setError("");
    } catch (e) {
      setError(`Could not load opportunities: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    api.matches(userId).then((matches) => {
      if (active) {
        setItems(matches);
        setError("");
      }
    }).catch((e) => {
      if (active) setError(`Could not load opportunities: ${e.message}`);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  const scan = async () => {
    setBusy("Scanning your inbox and matching roles...");
    setMsg("");
    setError("");
    try {
      const result = await api.scanEmails(userId);
      const matching = await api.runMatching(userId);
      await load();
      onScanned?.();
      setMsg(`Fetched ${result.fetched}, saved ${result.saved.length} new, scored ${matching.matched.length}.` +
        (result.errors?.length || matching.errors?.length ? " Some items failed. Please check the server logs." : "") +
        (matching.profile_confirmed === false ? " Confirm your profile to improve matching." : ""));
    } catch (e) {
      setError(`Gmail scan failed: ${e.message}`);
    } finally {
      setBusy("");
    }
  };

  const prepare = async (oppId) => {
    setBusy("Preparing resume and cover letter...");
    setMsg("");
    setError("");
    try {
      await api.startApplication(oppId);
      onPrepared?.();
    } catch (e) {
      setError(`Could not prepare application: ${e.message}`);
    } finally {
      setBusy("");
    }
  };

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = items.filter((item) => `${item.company || ""} ${item.role || ""} ${item.category || ""} ${item.explanation || ""}`.toLowerCase().includes(query));
    return filtered.sort((a, b) => {
      if (sort === "company") return (a.company || "").localeCompare(b.company || "");
      if (sort === "deadline") {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      }
      return (b.score || 0) - (a.score || 0);
    });
  }, [items, search, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-[#5F6368]">Find your next move</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202124] sm:text-3xl">Opportunities</h1><p className="mt-2 text-sm text-[#5F6368]">Roles discovered in your Gmail and matched to your profile.</p></div>
        <button onClick={scan} disabled={!!busy} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0B57D0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0842A0] disabled:opacity-50"><MailSearch className="h-4 w-4" />Scan emails</button>
      </div>
      {busy && <div className="rounded-xl bg-[#E8F0FE] px-4 py-3 text-sm text-[#0B57D0]">{busy}</div>}
      <StatusMessage message={error || msg} error={!!error} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#5F6368]">{items.length} {items.length === 1 ? "opportunity" : "opportunities"}</p>
        <label className="flex items-center gap-2 text-sm text-[#5F6368]"><ArrowDownUp className="h-4 w-4" /><span className="sr-only">Sort opportunities</span><select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-full border border-[#DADCE0] bg-white px-3 py-2 text-[#202124] outline-none focus:border-[#0B57D0]"><option value="match">Best match</option><option value="deadline">Deadline</option><option value="company">Company name</option></select></label>
      </div>

      {loading ? <LoadingState label="Loading opportunities..." /> : visibleItems.length === 0 ? (
        <EmptyState title={items.length ? "No matching opportunities" : "Nothing here yet"} description={items.length ? "Try another search, or clear the search field." : "Scan Gmail to discover job opportunities. ApplyPilot will compare them with your profile."} action={items.length ? null : <button onClick={scan} disabled={!!busy} className="rounded-full bg-[#0B57D0] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Scan Gmail</button>} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleItems.map((item) => (
            <article key={item.opportunity_id} className="rounded-2xl border border-[#DADCE0] bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#E8F0FE] text-[#0B57D0]"><BriefcaseBusiness className="h-6 w-6" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><h2 className="truncate text-lg font-semibold text-[#202124]">{item.role || "Role not specified"}</h2><p className="mt-0.5 truncate text-sm font-medium text-[#5F6368]">{item.company || "Company not specified"}</p></div>
                    <div className="text-right"><p className="text-2xl font-semibold text-[#0B57D0]">{Math.round(item.score)}%</p><p className="text-xs text-[#5F6368]">match</p></div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <StatusBadge status={item.category} />
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F3F4] px-2.5 py-1 text-[#5F6368]"><CalendarDays className="h-3.5 w-3.5" />{formatDeadline(item.deadline)}</span>
                    {item.location && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F3F4] px-2.5 py-1 text-[#5F6368]"><MapPin className="h-3.5 w-3.5" />{item.location}</span>}
                  </div>
                  {item.explanation && <p className="mt-4 line-clamp-2 text-sm leading-6 text-[#5F6368]">{item.explanation}</p>}
                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#E8EAED] pt-4">
                    {item.category !== "unsuitable" && <button onClick={() => prepare(item.opportunity_id)} disabled={!!busy} className="rounded-full bg-[#0B57D0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0842A0] disabled:opacity-50">Prepare application</button>}
                    {item.apply_link && <a href={item.apply_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-[#0B57D0] hover:bg-[#E8F0FE]">Application link <ExternalLink className="h-3.5 w-3.5" /></a>}
                    <button onClick={() => setOpen(open === item.opportunity_id ? null : item.opportunity_id)} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-[#5F6368] hover:bg-[#F1F3F4]"><Sparkles className="h-4 w-4" />{open === item.opportunity_id ? "Hide details" : "Details"}</button>
                  </div>
                  {open === item.opportunity_id && <div className="mt-3 rounded-xl bg-[#F6F8FC] p-4 text-sm leading-6 text-[#444746]"><p className="font-medium text-[#202124]">Match explanation</p><p className="mt-1">{item.explanation || "No additional match explanation is available."}</p></div>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
