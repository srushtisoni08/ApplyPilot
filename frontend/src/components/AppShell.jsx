import { useState } from "react";
import {
  BriefcaseBusiness, CheckCheck, ChevronLeft, ChevronRight, ClipboardList, LayoutDashboard,
  LogOut, Menu, Search, Settings, UserRound, X, Bell, Activity, Mail
} from "lucide-react";

const LINKS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "opportunities", label: "Opportunities", icon: BriefcaseBusiness },
  { id: "approvals", label: "Approvals", icon: CheckCheck },
  { id: "applications", label: "Applications", icon: ClipboardList },
  { id: "replies", label: "Replies", icon: Mail },
  { id: "profile", label: "My Profile", icon: UserRound },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ tab, onChange, pending, collapsed, onCollapse, mobileOpen, onMobileClose }) {
  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" onClick={onMobileClose} className="fixed inset-0 z-30 bg-black/30 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-[#F6F8FC] px-3 py-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[88px]" : "lg:w-[264px]"}`}>
        <div className={`mb-7 flex items-center gap-3 px-3 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#0B57D0] text-white">
            <BriefcaseBusiness className="h-5 w-5" />
          </div>
          <span className={`text-xl font-semibold tracking-tight text-[#202124] ${collapsed ? "lg:hidden" : ""}`}>ApplyPilot</span>
          <button aria-label="Close navigation" onClick={onMobileClose} className="ml-auto rounded-full p-2 text-[#5F6368] hover:bg-[#E8EAED] lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <button onClick={() => { onChange("opportunities"); onMobileClose(); }} className={`mb-5 flex h-12 items-center justify-center gap-3 rounded-2xl bg-[#C2E7FF] px-5 font-medium text-[#001D35] transition hover:shadow-sm ${collapsed ? "lg:mx-auto lg:w-12 lg:px-0" : ""}`}>
          <Search className="h-5 w-5 shrink-0" /><span className={collapsed ? "lg:hidden" : ""}>Find opportunities</span>
        </button>
        <nav className="space-y-1">
          {LINKS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { onChange(id); onMobileClose(); }} title={collapsed ? label : undefined} aria-current={tab === id ? "page" : undefined} className={`flex w-full items-center gap-4 rounded-r-full px-4 py-3 text-left text-sm font-medium transition ${tab === id ? "bg-[#D3E3FD] text-[#001D35]" : "text-[#444746] hover:bg-[#E8EAED]"} ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
              <Icon className="h-5 w-5 shrink-0" />
              <span className={`flex-1 ${collapsed ? "lg:hidden" : ""}`}>{label}</span>
              {id === "approvals" && pending > 0 && <span className="min-w-6 rounded-full bg-[#B3261E] px-1.5 py-0.5 text-center text-xs text-white">{pending}</span>}
            </button>
          ))}
        </nav>
        <button onClick={onCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="mt-auto hidden items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#5F6368] hover:bg-[#E8EAED] lg:flex">
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <><ChevronLeft className="h-5 w-5" />Collapse menu</>}
        </button>
      </aside>
    </>
  );
}

export function Header({ user, gmailConnected, pending, search, onSearch, onNavigate, onLogout, onMenu }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const initials = (user?.full_name || user?.email || "U").slice(0, 1).toUpperCase();
  return (
    <header className="sticky top-0 z-20 border-b border-[#DADCE0] bg-[#F6F8FC]/95 backdrop-blur">
      <div className="flex h-[76px] items-center gap-3 px-4 sm:px-7">
        <button onClick={onMenu} aria-label="Open navigation" className="rounded-full p-2 text-[#5F6368] hover:bg-[#E8EAED] lg:hidden"><Menu className="h-5 w-5" /></button>
        <label className="flex h-12 min-w-0 max-w-[680px] flex-1 items-center gap-3 rounded-full bg-[#EAF1FB] px-4 transition focus-within:bg-white focus-within:shadow-md">
          <Search className="h-5 w-5 shrink-0 text-[#5F6368]" />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search opportunities and applications" className="min-w-0 flex-1 bg-transparent text-sm text-[#202124] outline-none placeholder:text-[#5F6368]" />
          {search && <button onClick={() => onSearch("")} aria-label="Clear search" className="text-[#5F6368]"><X className="h-4 w-4" /></button>}
        </label>
        <div className="ml-auto hidden items-center gap-2 rounded-full bg-white px-3 py-2 text-xs text-[#5F6368] xl:flex">
          <span className={`h-2 w-2 rounded-full ${gmailConnected ? "bg-[#188038]" : "bg-[#F9AB00]"}`} />
          <span>{gmailConnected ? user?.gmail_email || "Gmail connected" : "Gmail not connected"}</span>
        </div>
        <button onClick={() => onNavigate("approvals")} aria-label={`${pending} pending approvals`} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#444746] hover:bg-[#E8EAED]">
          <Bell className="h-5 w-5" />{pending > 0 && <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#B3261E] px-1 text-[10px] font-semibold text-white">{pending}</span>}
        </button>
        <div className="relative">
          <button onClick={() => setProfileOpen(!profileOpen)} aria-label="Open profile menu" aria-expanded={profileOpen} className="grid h-10 w-10 place-items-center rounded-full bg-[#0B57D0] text-sm font-semibold text-white hover:shadow-md">{initials}</button>
          {profileOpen && (
            <>
              <button aria-hidden="true" className="fixed inset-0 z-20" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-[#DADCE0] bg-white p-3 shadow-lg">
              <div className="border-b border-[#E8EAED] px-3 pb-3">
                <p className="font-medium text-[#202124]">{user?.full_name || "Your account"}</p>
                <p className="mt-1 truncate text-sm text-[#5F6368]">{user?.email}</p>
              </div>
              <button onClick={() => { onNavigate("profile"); setProfileOpen(false); }} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#444746] hover:bg-[#F1F3F4]"><UserRound className="h-4 w-4" />My Profile</button>
              <button onClick={() => { onNavigate("settings"); setProfileOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#444746] hover:bg-[#F1F3F4]"><Settings className="h-4 w-4" />Settings</button>
              <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#B3261E] hover:bg-[#FCE8E6]"><LogOut className="h-4 w-4" />Log out</button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
