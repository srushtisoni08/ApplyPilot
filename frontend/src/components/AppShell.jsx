import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, Bell, BriefcaseBusiness, CheckCheck, ChevronLeft, ChevronRight, ClipboardList, LayoutDashboard,
  LogOut, Mail, Menu, Search, Settings, UserRound, X,
} from "lucide-react";
import { Logo, Wordmark } from "./Brand";
import { ThemeToggle } from "./Theme";
import { Tip } from "./UI";

const GROUPS = [
  {
    label: "Workspace",
    links: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "opportunities", label: "Opportunities", icon: BriefcaseBusiness },
      { id: "applications", label: "Applications", icon: ClipboardList },
      { id: "approvals", label: "Approvals", icon: CheckCheck },
      { id: "replies", label: "Replies", icon: Mail },
    ],
  },
  {
    label: "Account",
    links: [
      { id: "profile", label: "My Profile", icon: UserRound },
      { id: "activity", label: "Activity", icon: Activity },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar({ tab, onChange, pending, collapsed, onCollapse, mobileOpen, onMobileClose }) {
  const go = (id) => { onChange(id); onMobileClose(); };
  const slim = collapsed ? "lg:hidden" : "";
  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label="Close navigation" onClick={onMobileClose} className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" />
        )}
      </AnimatePresence>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col bg-[#101828] px-3 py-5 text-white transition-[transform,width] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[84px]" : "lg:w-[272px]"}`}
      >
        <div className={`mb-6 flex items-center gap-3 px-2 ${collapsed ? "lg:justify-center" : ""}`}>
          <Logo size={38} />
          <Wordmark className={`text-white ${slim}`} />
          <button aria-label="Close navigation" onClick={onMobileClose} className="ml-auto rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button>
        </div>

        <button
          onClick={() => go("opportunities")}
          className={`mb-6 flex h-11 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#7c6cf0] px-4 text-sm font-semibold text-white shadow-lg shadow-[#2563eb]/20 transition hover:brightness-110 active:scale-[0.98] ${collapsed ? "lg:mx-auto lg:w-11 lg:px-0" : ""}`}
        >
          <Search className="h-[18px] w-[18px] shrink-0" /><span className={slim}>Find opportunities</span>
        </button>

        <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Main">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className={`mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35 ${slim}`}>{group.label}</p>
              <div className="space-y-0.5">
                {group.links.map(({ id, label, icon: Icon }) => {
                  const active = tab === id;
                  const btn = (
                    <button
                      onClick={() => go(id)}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${active ? "text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"} ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
                    >
                      {active && (
                        <motion.span layoutId="nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-inset ring-white/10">
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#a78bfa]" />
                        </motion.span>
                      )}
                      <Icon className="relative h-[19px] w-[19px] shrink-0" />
                      <span className={`relative flex-1 ${slim}`}>{label}</span>
                      {id === "approvals" && pending > 0 && (
                        <span className={`relative min-w-5 rounded-full bg-[#a78bfa] px-1.5 text-center text-[11px] font-bold leading-5 text-[#101828] ${collapsed ? "lg:absolute lg:right-2 lg:top-1.5 lg:min-w-4 lg:px-1 lg:text-[10px] lg:leading-4" : ""}`}>{pending}</span>
                      )}
                    </button>
                  );
                  return collapsed ? <div key={id} className="hidden lg:block"><SideTip label={label}>{btn}</SideTip></div> : <div key={id}>{btn}</div>;
                })}
              </div>
            </div>
          ))}
        </nav>

        <button onClick={onCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="mt-4 hidden items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-white/50 transition hover:bg-white/[0.06] hover:text-white lg:flex">
          {collapsed ? <ChevronRight className="mx-auto h-[18px] w-[18px]" /> : <><ChevronLeft className="h-[18px] w-[18px]" />Collapse</>}
        </button>
      </aside>
    </>
  );
}

/* tooltip that opens to the right of the collapsed rail */
function SideTip({ label, children }) {
  return (
    <span className="group/side relative block">
      {children}
      <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#101828] opacity-0 shadow-pop transition-opacity group-hover/side:opacity-100 group-focus-within/side:opacity-100">{label}</span>
    </span>
  );
}

export function Header({ user, gmailConnected, pending, search, onSearch, onNavigate, onLogout, onMenu, title }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const initials = (user?.full_name || user?.email || "U").trim().slice(0, 1).toUpperCase();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      const typing = /input|textarea|select/i.test(document.activeElement?.tagName || "");
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
    };
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, []);

  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-2";
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/80 backdrop-blur-xl">
      <div className="flex h-[68px] items-center gap-3 px-4 sm:px-7">
        <button onClick={onMenu} aria-label="Open navigation" className="rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden"><Menu className="h-5 w-5" /></button>
        <h1 className="hidden shrink-0 font-display text-lg font-semibold text-ink md:block">{title}</h1>
        <label className="ml-0 flex h-10 min-w-0 max-w-[460px] flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 transition-all focus-within:border-brand focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand)_15%,transparent)] md:ml-6">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input ref={searchRef} value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search opportunities and applications" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint" />
          {search ? <button type="button" onClick={() => onSearch("")} aria-label="Clear search" className="text-faint hover:text-ink"><X className="h-4 w-4" /></button> : <kbd className="hidden rounded border border-line px-1.5 text-[11px] font-medium text-faint sm:block">/</kbd>}
        </label>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="mr-1 hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted xl:flex">
            <span className={`h-2 w-2 rounded-full ${gmailConnected ? "bg-ok" : "bg-warn"}`} />
            {gmailConnected ? user?.gmail_email || "Gmail connected" : "Gmail not connected"}
          </div>
          <ThemeToggle />
          <Tip label={pending ? `${pending} pending approval${pending > 1 ? "s" : ""}` : "No pending approvals"}>
            <button onClick={() => onNavigate("approvals")} aria-label={`${pending} pending approvals`} className="relative grid h-10 w-10 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink">
              <Bell className="h-5 w-5" />
              {pending > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{pending}</span>}
            </button>
          </Tip>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setOpen(!open)} aria-label="Open profile menu" aria-expanded={open} className="ml-1 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#2563eb] to-[#a78bfa] text-sm font-bold text-white transition hover:shadow-lift">{initials}</button>
            <AnimatePresence>
              {open && (
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.14 }} className="absolute right-0 top-12 z-30 w-64 origin-top-right rounded-2xl border border-line bg-surface p-2 shadow-pop">
                  <div className="border-b border-line px-3 pb-3 pt-2">
                    <p className="truncate font-semibold text-ink">{user?.full_name || "Your account"}</p>
                    <p className="mt-0.5 truncate text-sm text-muted">{user?.email}</p>
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <button onClick={() => { onNavigate("profile"); setOpen(false); }} className={item}><UserRound className="h-4 w-4 text-muted" />My Profile</button>
                    <button onClick={() => { onNavigate("settings"); setOpen(false); }} className={item}><Settings className="h-4 w-4 text-muted" />Settings</button>
                    <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-bad hover:bg-bad-bg"><LogOut className="h-4 w-4" />Log out</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}