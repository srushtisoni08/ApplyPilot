import { useEffect, useState } from "react";
import { api } from "./api";
import Login from "./components/Login";
import { Header, Sidebar } from "./components/AppShell";
import Register from "./components/Register";
import Applications from "./pages/Applications";
import Activity from "./pages/Activity";
import Approvals from "./pages/Approvals";
import Dashboard from "./pages/Dashboard";
import Opportunities from "./pages/Opportunities";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Replies from "./pages/Replies";

export default function App() {
  const [user, setUser] = useState(null);
  const [authPage, setAuthPage] = useState("login");
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [pending, setPending] = useState(0);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [approvalRefresh, setApprovalRefresh] = useState(0);

  useEffect(() => {
    api.me()
      .then((currentUser) => {
        setUser(currentUser);
        setGmailConnected(!!currentUser.gmail_connected);
        if (new URLSearchParams(window.location.search).has("gmail")) {
          window.history.replaceState({}, "", window.location.pathname);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    api.approvals(user.id).then((rows) => setPending(rows.length)).catch(() => {});
  }, [user, tab, approvalRefresh]);

  useEffect(() => {
    if (!user) return;
    api.gmailStatus().then((status) => setGmailConnected(status.connected)).catch(() => setGmailConnected(!!user.gmail_connected));
  }, [user]);

  const acceptSession = async (action, body) => {
    const currentUser = await action(body);
    setUser(currentUser);
    setGmailConnected(currentUser.gmail_connected);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setAuthPage("login");
    setPending(0);
  };

  if (!authReady) {
    return <div className="grid min-h-screen place-items-center bg-[#F6F8FC] text-[#5F6368]">Loading ApplyPilot...</div>;
  }
  if (!user) {
    return authPage === "register"
      ? <Register onRegister={(body) => acceptSession(api.register, body)} onLogin={() => setAuthPage("login")} />
      : <Login onLogin={(body) => acceptSession(api.login, body)} onRegister={() => setAuthPage("register")} />;
  }

  const titles = { dashboard: "Dashboard", opportunities: "Opportunities", approvals: "Approvals", applications: "Applications", profile: "My Profile", activity: "Activity", settings: "Settings" ,replies: "Replies",};
  return (
    <div className="min-h-screen bg-[#F6F8FC] text-[#202124] lg:flex">
      <Sidebar tab={tab} onChange={setTab} pending={pending} collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="min-w-0 flex-1">
        <Header user={{ ...user, gmail_connected: gmailConnected }} gmailConnected={gmailConnected} pending={pending} search={search} onSearch={setSearch} onNavigate={setTab} onLogout={logout} onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-7 sm:py-8">
          {!gmailConnected && (
            <section className="flex flex-col gap-4 rounded-2xl border border-[#D3E3FD] bg-[#E8F0FE] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-[#202124]">Connect your Gmail account</h2>
                <p className="mt-1 max-w-2xl text-sm text-[#5F6368]">Discover job opportunities from your emails and match them with your candidate profile. You stay in control of every application.</p>
              </div>
              <a href={`${api.base}/auth/google`} className="shrink-0 rounded-full bg-[#0B57D0] px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#0842A0]">Connect Gmail</a>
            </section>
          )}
          {tab === "dashboard" && <Dashboard user={{ ...user, gmail_connected: gmailConnected }} pending={pending} onNavigate={setTab} refreshKey={dashboardRefresh} />}
          {tab === "profile" && <Profile user={user} />}
          {tab === "settings" && <Settings user={user} gmailConnected={gmailConnected} onUserUpdate={setUser} />}
          {tab === "opportunities" && <Opportunities userId={user.id} onPrepared={() => { setTab("approvals"); setApprovalRefresh((value) => value + 1); }} search={search} onScanned={() => setDashboardRefresh((value) => value + 1)} />}
          {tab === "approvals" && <Approvals userId={user.id} onDecided={() => { setApprovalRefresh((value) => value + 1); setDashboardRefresh((value) => value + 1); }} />}
          {tab === "applications" && <Applications userId={user.id} onFilled={() => { setTab("approvals"); setApprovalRefresh((value) => value + 1); }} search={search} />}
          {tab === "replies" && <Replies userId={user.id} search={search} />}
          {tab === "activity" && <Activity />}
          <div className="sr-only" aria-live="polite">{titles[tab]}</div>
        </main>
      </div>
    </div>
  );
}
