import { useEffect, useState } from "react";
import { api } from "./api";
import Login from "./components/Login";
import Nav from "./components/Nav";
import Register from "./components/Register";
import Applications from "./pages/Applications";
import Approvals from "./pages/Approvals";
import Opportunities from "./pages/Opportunities";
import Profile from "./pages/Profile";

export default function App() {
  const [user, setUser] = useState(null);
  const [authPage, setAuthPage] = useState("login");
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState("opportunities");
  const [pending, setPending] = useState(0);
  const [gmailConnected, setGmailConnected] = useState(false);

  useEffect(() => {
    api.me()
      .then((currentUser) => {
        setUser(currentUser);
        setGmailConnected(currentUser.gmail_connected);
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
  }, [user, tab]);

  useEffect(() => {
    if (!user) return;
    api.gmailStatus().then((status) => setGmailConnected(status.connected));
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
    return <div className="grid min-h-screen place-items-center bg-[#f6f8fc] text-slate-500">Loading ApplyPilot...</div>;
  }
  if (!user) {
    return authPage === "register"
      ? <Register onRegister={(body) => acceptSession(api.register, body)} onLogin={() => setAuthPage("login")} />
      : <Login onLogin={(body) => acceptSession(api.login, body)} onRegister={() => setAuthPage("register")} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-xl font-bold">ApplyPilot</h1>
          <Nav tab={tab} onChange={setTab} pending={pending} />
          <button onClick={logout} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Log out</button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {!gmailConnected && (
          <section className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Connect your Gmail account</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Allow ApplyPilot to discover job opportunities from your emails and match them with your candidate profile.
              </p>
            </div>
            <a href={`${api.base}/auth/google`} className="shrink-0 rounded-full bg-blue-600 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700">
              Connect Gmail
            </a>
          </section>
        )}
        {tab === "profile" && <Profile user={user} onUserUpdate={setUser} onLogout={logout} />}
        {tab === "opportunities" && <Opportunities userId={user.id} onPrepared={() => setTab("approvals")} />}
        {tab === "approvals" && <Approvals userId={user.id} />}
        {tab === "applications" && <Applications userId={user.id} onFilled={() => setTab("approvals")} />}
      </main>
    </div>
  );
}
