import { useEffect, useState } from "react";
import { api } from "./api";
import ConnectScreen from "./components/ConnectScreen";
import Nav from "./components/Nav";
import Applications from "./pages/Applications";
import Approvals from "./pages/Approvals";
import Opportunities from "./pages/Opportunities";
import Profile from "./pages/Profile";

export default function App() {
  const [userId, setUserId] = useState(() => localStorage.getItem("user_id"));
  const [tab, setTab] = useState("opportunities");
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("user_id");
    if (q) {
      localStorage.setItem("user_id", q);
      setUserId(q);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    if (userId) api.approvals(userId).then((r) => setPending(r.length)).catch(() => {});
  }, [userId, tab]);

  if (!userId) return <ConnectScreen />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">ApplyPilot</h1>
          <Nav tab={tab} onChange={setTab} pending={pending} />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {tab === "profile" && <Profile userId={userId} />}
        {tab === "opportunities" && (
          <Opportunities userId={userId} onPrepared={() => setTab("approvals")} />
        )}
        {tab === "approvals" && <Approvals userId={userId} />}
        {tab === "applications" && (
          <Applications userId={userId} onFilled={() => setTab("approvals")} />
        )}
      </main>
    </div>
  );
}