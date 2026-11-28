import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, CalendarDays, ExternalLink, LayoutGrid, List, Mail, MailSearch, MapPin, SearchX, Sparkles, X } from "lucide-react";
import { api } from "../api";
import ScoreRing from "../components/ScoreRing";
import { Button, EmptyState, Skeleton, StatusBadge, StatusMessage } from "../components/UI";

const VIEW_KEY = "applypilot-opp-view";
const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "suitable", label: "Suitable" },
  { key: "uncertain", label: "Uncertain" },
  { key: "unsuitable", label: "Unsuitable" },
];
const METHODS = [
  { key: "all", label: "Any method" },
  { key: "email", label: "Email" },
  { key: "web", label: "Web form" },
];

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}

function formatDeadline(value) {
  if (!value) return "No deadline";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function deadlineChip(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return { text: formatDeadline(value), tone: "bg-surface-2 text-muted" };
  const days = Math.ceil((d - new Date()) / 86400000);
  if (days < 0) return { text: "Closed", tone: "bg-surface-2 text-faint" };
  if (days <= 3) return { text: days === 0 ? "Closes today" : `${days}d left`, tone: "bg-bad-bg text-bad" };
  if (days <= 7) return { text: `${days}d left`, tone: "bg-warn-bg text-warn" };
  return { text: formatDeadline(value), tone: "bg-surface-2 text-muted" };
}

function methodOf(item) {
  return item.apply_method === "email" ? "email" : "web";
}

function Chip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${active ? "border-brand-solid bg-brand-solid text-white" : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink"}`}
    >
      {children}
      {count !== undefined && <span className={`num text-[11px] ${active ? "text-white/80" : "text-faint"}`}>{count}</span>}
    </button>
  );
}

function MetaChips({ item }) {
  const chip = deadlineChip(item.deadline);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <StatusBadge status={item.category} />
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${chip.tone}`}><CalendarDays className="h-3.5 w-3.5" />{chip.text}</span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 font-medium text-muted">{methodOf(item) === "email" ? <Mail className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}{methodOf(item) === "email" ? "Email" : "Web form"}</span>
      {item.location && <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 font-medium text-muted"><MapPin className="h-3.5 w-3.5" />{item.location}</span>}
    </div>
  );
}
const APPLIED = ["submitted", "interview", "offer", "rejected"];
const canPrepare = (item) => item.category !== "unsuitable" && !APPLIED.includes(item.application_status);
function OpportunityCard({ item, index, busy, onOpen, onPrepare }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.03 }}
      whileHover={{ y: -2 }}
      className="card flex flex-col p-5 transition-shadow hover:shadow-lift"
    >
      <div className="flex items-start gap-4">
        <ScoreRing score={item.score} category={item.category} size={58} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-semibold text-ink">{item.role || "Role not specified"}</h2>
          <p className="mt-0.5 truncate text-sm font-medium text-muted">{item.company || "Company not specified"}</p>
        </div>
      </div>
      <div className="mt-4"><MetaChips item={item} /></div>
      {item.explanation && <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted">{item.explanation}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4 mt-5">
        {canPrepare(item)
          ? <Button size="sm" onClick={() => onPrepare(item.opportunity_id)} disabled={!!busy}>Prepare application</Button>
          : APPLIED.includes(item.application_status) && <span className="text-xs font-medium text-muted">Already {item.application_status}</span>}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onOpen(item)}><Sparkles className="h-4 w-4" />Details</Button>
      </div>
    </motion.article>
  );
}

function OpportunityRow({ item, index, busy, onOpen, onPrepare }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index, 10) * 0.02 }}
      className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors hover:bg-surface-2/60 sm:px-5"
    >
      <ScoreRing score={item.score} category={item.category} size={44} stroke={4} />
      <button onClick={() => onOpen(item)} className="min-w-0 flex-1 basis-48 text-left">
        <p className="truncate font-semibold text-ink">{item.role || "Role not specified"}</p>
        <p className="truncate text-sm text-muted">{item.company || "Company not specified"}</p>
      </button>
      <div className="hidden md:block"><MetaChips item={item} /></div>
      <div className="flex items-center gap-2">
        {canPrepare(item)
          ? <Button size="sm" onClick={() => onPrepare(item.opportunity_id)} disabled={!!busy}>Prepare</Button>
          : APPLIED.includes(item.application_status) && <span className="text-xs font-medium text-muted">Already {item.application_status}</span>}
        <Button size="sm" variant="secondary" onClick={() => onOpen(item)}>Details</Button>
      </div>
    </motion.li>
  );
}

function DetailDrawer({ item, busy, onClose, onPrepare }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end bg-[#0b1120]/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`${item.role || "Opportunity"} details`}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="flex h-full w-full max-w-lg flex-col border-l border-line bg-surface shadow-pop"
      >
        <header className="flex items-start gap-4 border-b border-line p-5 sm:p-6">
          <ScoreRing score={item.score} category={item.category} size={72} stroke={6} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold leading-tight text-ink">{item.role || "Role not specified"}</h2>
            <p className="mt-1 text-sm font-medium text-muted">{item.company || "Company not specified"}</p>
          </div>
          <button autoFocus onClick={onClose} aria-label="Close details" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          <MetaChips item={item} />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface-2 p-3.5"><dt className="text-xs font-semibold text-muted">Match score</dt><dd className="num mt-1 font-display text-xl font-semibold text-ink">{Math.round(item.score)}%</dd></div>
            <div className="rounded-xl bg-surface-2 p-3.5"><dt className="text-xs font-semibold text-muted">Deadline</dt><dd className="mt-1 font-display text-xl font-semibold text-ink">{formatDeadline(item.deadline)}</dd></div>
          </dl>
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles className="h-4 w-4 text-accent" />Why this match</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">{item.explanation || "No additional match explanation is available."}</p>
          </section>
          {item.apply_link && (
            <section>
              <h3 className="text-sm font-semibold text-ink">Application link</h3>
              <a href={item.apply_link} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1.5 break-all text-sm font-medium text-brand hover:underline">{item.apply_link}<ExternalLink className="h-3.5 w-3.5 shrink-0" /></a>
            </section>
          )}
        </div>

        <footer className="flex gap-2 border-t border-line p-4 sm:p-5">
          {canPrepare(item) ? (
            <Button className="flex-1" onClick={() => onPrepare(item.opportunity_id)} disabled={!!busy}>Prepare application</Button>
          ) : (
            <p className="flex-1 self-center text-sm text-muted">
              {APPLIED.includes(item.application_status)
                ? `You already applied to this role (${item.application_status}).`
                : "This role was marked unsuitable for your profile."}
            </p>
          )}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </footer>
      </motion.aside>
    </motion.div>
  );
}

export default function Opportunities({ userId, onPrepared, search = "", onScanned }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [sort, setSort] = useState("match");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(readView);
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState("all");
  const [closingSoon, setClosingSoon] = useState(false);

  const changeView = (next) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage blocked: view just isn't remembered */
    }
  };

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
    api.matches(userId)
      .then((matches) => { if (active) { setItems(matches); setError(""); } })
      .catch((e) => { if (active) setError(`Could not load opportunities: ${e.message}`); })
      .finally(() => { if (active) setLoading(false); });
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
      setSelected(null);
      onPrepared?.();
    } catch (e) {
      setError(`Could not prepare application: ${e.message}`);
    } finally {
      setBusy("");
    }
  };

  const counts = useMemo(() => {
    const c = { all: items.length };
    CATEGORIES.slice(1).forEach(({ key }) => { c[key] = items.filter((i) => i.category === key).length; });
    return c;
  }, [items]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (method !== "all" && methodOf(item) !== method) return false;
      if (closingSoon) {
        const d = item.deadline ? Math.ceil((new Date(item.deadline) - new Date()) / 86400000) : NaN;
        if (!(d >= 0 && d <= 7)) return false;
      }
      return `${item.company || ""} ${item.role || ""} ${item.category || ""} ${item.explanation || ""}`.toLowerCase().includes(query);
    });
    return filtered.sort((a, b) => {
      if (sort === "company") return (a.company || "").localeCompare(b.company || "");
      if (sort === "deadline") {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      }
      return (b.score || 0) - (a.score || 0);
    });
  }, [items, search, sort, category, method, closingSoon]);

  const filtering = category !== "all" || method !== "all" || closingSoon || search.trim();
  const clearFilters = () => { setCategory("all"); setMethod("all"); setClosingSoon(false); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-brand">Find your next move</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Opportunities</h1>
          <p className="mt-2 text-sm text-muted">Roles discovered in your Gmail and matched to your profile.</p>
        </div>
        <Button onClick={scan} loading={!!busy && busy.startsWith("Scanning")} disabled={!!busy} icon={MailSearch}>Scan emails</Button>
      </div>

      {busy && <div role="status" className="rounded-xl bg-brand-bg px-4 py-3 text-sm font-medium text-brand">{busy}</div>}
      <StatusMessage message={error || msg} error={!!error} />

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => <Chip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)} count={counts[c.key]}>{c.label}</Chip>)}
          <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-line sm:block" />
          {METHODS.map((m) => <Chip key={m.key} active={method === m.key} onClick={() => setMethod(m.key)}>{m.label}</Chip>)}
          <Chip active={closingSoon} onClick={() => setClosingSoon(!closingSoon)}><CalendarDays className="h-3.5 w-3.5" />Closing in 7 days</Chip>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            Showing <span className="num font-semibold text-ink">{visibleItems.length}</span> of <span className="num">{items.length}</span>
            {filtering && <button onClick={clearFilters} className="ml-3 font-semibold text-brand hover:underline">Clear filters</button>}
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-muted">
              <ArrowDownUp className="h-4 w-4" /><span className="sr-only">Sort opportunities</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 rounded-xl border border-line bg-surface px-3 text-ink outline-none focus:border-brand">
                <option value="match">Best match</option>
                <option value="deadline">Deadline</option>
                <option value="company">Company name</option>
              </select>
            </label>
            <div role="group" aria-label="Layout" className="flex rounded-xl border border-line bg-surface-2 p-0.5">
              {[["cards", LayoutGrid, "Card view"], ["list", List, "List view"]].map(([key, Icon, label]) => (
                <button key={key} type="button" onClick={() => changeView(key)} aria-pressed={view === key} aria-label={label} title={label} className={`grid h-8 w-9 place-items-center rounded-[10px] transition-colors ${view === key ? "bg-surface text-brand shadow-card" : "text-muted hover:text-ink"}`}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2" role="status" aria-label="Loading opportunities">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-52 !rounded-2xl" />)}</div>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={items.length ? SearchX : undefined}
          title={items.length ? "No matching opportunities" : "Nothing here yet"}
          description={items.length ? "Try different filters, or clear the search field." : "Scan Gmail to discover job opportunities. ApplyPilot will compare them with your profile."}
          action={items.length ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : <Button onClick={scan} disabled={!!busy} icon={MailSearch}>Scan Gmail</Button>}
        />
      ) : view === "cards" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {visibleItems.map((item, i) => <OpportunityCard key={item.opportunity_id} item={item} index={i} busy={busy} onOpen={setSelected} onPrepare={prepare} />)}
          </AnimatePresence>
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {visibleItems.map((item, i) => <OpportunityRow key={item.opportunity_id} item={item} index={i} busy={busy} onOpen={setSelected} onPrepare={prepare} />)}
        </ul>
      )}

      <AnimatePresence>
        {selected && <DetailDrawer key="drawer" item={selected} busy={busy} onClose={() => setSelected(null)} onPrepare={prepare} />}
      </AnimatePresence>
    </div>
  );
}
