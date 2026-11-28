import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail } from "lucide-react";
import { api } from "./api";
import Login from "./components/Login";
import Register from "./components/Register";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import { Header, Sidebar } from "./components/AppShell";
import { Logo } from "./components/Brand";
import { Button } from "./components/UI";
import { useToast } from "./components/Toast";
import Applications from "./pages/Applications";
import Activity from "./pages/Activity";
import Approvals from "./pages/Approvals";
import Dashboard from "./pages/Dashboard";
import Opportunities from "./pages/Opportunities";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Replies from "./pages/Replies";

const TITLES = { dashboard: "Dashboard", opportunities: "Opportunities", approvals: "Approvals", applications: "Applications", profile: "My Profile", activity: "Activity", settings: "Settings", replies: "Replies" };

function readResetToken() {
  return new URLSearchParams(window.location.search).get("reset") || "";
}

export default function App() {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [resetToken, setResetToken] = useState(readResetToken);
  const [authPage, setAuthPage] = useState(() => (readResetToken() ? "reset" : "login"));
  const [notice, setNotice] = useState("");
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
    toast.info("You have been signed out.");
  };

  const leaveReset = () => {
    window.history.replaceState({}, "", window.location.pathname);
    setResetToken("");
    setAuthPage("login");
  };

  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <div className="flex flex-col items-center gap-4 text-sm text-muted">
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}><Logo size={48} /></motion.div>
          Loading ApplyPilot...
        </div>
      </div>
    );
  }

  if (!user) {
    let page;
    if (authPage === "reset" && resetToken) {
      page = <ResetPassword token={resetToken} onBack={leaveReset} onDone={() => { setNotice("Password updated. Sign in with your new password."); leaveReset(); }} />;
    } else if (authPage === "forgot") {
      page = <ForgotPassword onBack={() => setAuthPage("login")} />;
    } else if (authPage === "register") {
      page = <Register onRegister={(body) => acceptSession(api.register, body)} onLogin={() => setAuthPage("login")} />;
    } else {
      page = <Login notice={notice} onLogin={(body) => acceptSession(api.login, body)} onRegister={() => { setNotice(""); setAuthPage("register"); }} onForgot={() => { setNotice(""); setAuthPage("forgot"); }} />;
    }
    return page;
  }

  const fullUser = { ...user, gmail_connected: gmailConnected };
  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <Sidebar tab={tab} onChange={setTab} pending={pending} collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="min-w-0 flex-1">
        <Header user={fullUser} gmailConnected={gmailConnected} pending={pending} search={search} onSearch={setSearch} onNavigate={setTab} onLogout={logout} onMenu={() => setMobileOpen(true)} title={TITLES[tab]} />
        <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-7 sm:py-8">
          {!gmailConnected && (
            <section className="relative overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-r from-brand-bg to-accent-bg p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-brand shadow-card"><Mail className="h-5 w-5" /></div>
                <div>
                  <h2 className="font-display font-semibold text-ink">Connect your Gmail account</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Discover job opportunities from your emails and match them with your candidate profile. You stay in control of every application.</p>
                </div>
              </div>
              <Button href={`${api.base}/auth/google`} className="mt-4 shrink-0 sm:mt-0">Connect Gmail</Button>
            </section>
          )}
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: "easeOut" }} className="space-y-6">
              {tab === "dashboard" && <Dashboard user={fullUser} pending={pending} onNavigate={setTab} refreshKey={dashboardRefresh} />}
              {tab === "profile" && <Profile user={user} />}
              {tab === "settings" && <Settings user={user} gmailConnected={gmailConnected} onUserUpdate={setUser} />}
              {tab === "opportunities" && <Opportunities userId={user.id} onPrepared={() => { setTab("approvals"); setApprovalRefresh((v) => v + 1); }} search={search} onScanned={() => setDashboardRefresh((v) => v + 1)} />}
              {tab === "approvals" && <Approvals userId={user.id} onDecided={() => { setApprovalRefresh((v) => v + 1); setDashboardRefresh((v) => v + 1); }} />}
              {tab === "applications" && <Applications userId={user.id} onFilled={() => { setTab("approvals"); setApprovalRefresh((v) => v + 1); }} search={search} />}
              {tab === "replies" && <Replies userId={user.id} search={search} />}
              {tab === "activity" && <Activity />}
            </motion.div>
          </AnimatePresence>
          <div className="sr-only" aria-live="polite">{TITLES[tab]}</div>
        </main>
      </div>
    </div>
  );
}