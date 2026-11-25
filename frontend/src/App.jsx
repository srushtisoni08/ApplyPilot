import { useEffect, useState } from "react";
import { api } from "./api";
import Profile from "./Profile";
import Opportunities from "./Opportunities";

const TABS = [
  ["opportunities", "Opportunities"],
  ["profile", "Profile"],
];

export default function App() {
  const [userId, setUserId] = useState(() => localStorage.getItem("user_id"));
  const [tab, setTab] = useState("opportunities");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("user_id");
    if (q) {
      localStorage.setItem("user_id", q);
      setUserId(q);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  if (!userId) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">ApplyPilot</h1>
          <p className="text-slate-600">Connect Gmail (read-only) to start.</p>
          <a
            href={`${api.base}/auth/google`}
            className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-white font-medium hover:bg-blue-700"
          >
            Connect Gmail
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">ApplyPilot</h1>
          <nav className="flex gap-1">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {tab === "profile" ? <Profile userId={userId} /> : <Opportunities userId={userId} />}
      </main>
    </div>
  );
}