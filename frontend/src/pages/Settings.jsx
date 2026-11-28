import { useEffect, useState } from "react";
import {
  Activity, AtSign, Clock3, KeyRound, Mail, RefreshCw, ShieldCheck,
  Sparkles, UserRound, Workflow,
} from "lucide-react";
import { api } from "../api";
import { StatusMessage } from "../components/UI";
import { PasswordField } from "../components/Fields";

const every = (min) => (min % 60 === 0 ? `every ${min / 60} h` : `every ${min} min`);

function Row({ icon: Icon, label, description, value, on }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <Icon className="h-5 w-5 shrink-0 text-[#5F6368]" />
      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-[#202124]">{label}</p><p className="mt-1 text-xs leading-5 text-[#5F6368]">{description}</p></div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${on === false ? "bg-[#F1F3F4] text-[#5F6368]" : "bg-[#E6F4EA] text-[#137333]"}`}>{value}</span>
    </div>
  );
}

export default function Settings({ user, gmailConnected, onUserUpdate }) {
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [auto, setAuto] = useState(null);

  useEffect(() => {
    api.agentStatus().then(setAuto).catch(() => setAuto(false));
  }, []);

  const runNow = () => run("Running the agent...", async () => {
    const r = await api.runAgent(false);
    setMessage(`Agent run finished: ${r.steps?.length ?? 0} step(s) completed.`);
  });

  const run = async (label, action) => {
    setBusy(label);
    setMessage("");
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const saveAccount = () => run("Saving account...", async () => {
    const updated = await api.updateAccount({ full_name: fullName });
    onUserUpdate?.(updated);
    setMessage("Account name updated.");
  });

  const changePassword = () => run("Updating password...", async () => {
    await api.updatePassword({
      current_password: currentPassword || null,
      new_password: newPassword,
    });
    setCurrentPassword("");
    setNewPassword("");
    setMessage("Password updated.");
  });

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-medium text-[#5F6368]">Manage your account and workflows</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202124] sm:text-3xl">Settings</h1>
        <p className="mt-2 text-sm text-[#5F6368]">Account details, connected services, and automation availability.</p>
      </div>
      <StatusMessage message={error || message} error={!!error} />

      <section className="rounded-2xl border border-[#DADCE0] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F0FE] text-[#0B57D0]"><UserRound className="h-5 w-5" /></div>
          <div><h2 className="font-semibold text-[#202124]">Account</h2><p className="mt-1 text-sm text-[#5F6368]">Update the details you use to sign in to ApplyPilot.</p></div>
        </div>
        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-[#444746]">
              Full name
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={255} className="mt-1.5 w-full rounded-xl border border-[#DADCE0] px-3.5 py-2.5 text-[#202124] outline-none focus:border-[#0B57D0]" />
            </label>
            <p className="flex items-center gap-2 text-sm text-[#5F6368]"><AtSign className="h-4 w-4" />{user?.email}</p>
            <button onClick={saveAccount} disabled={!!busy} className="rounded-full border border-[#DADCE0] px-4 py-2 text-sm font-semibold text-[#444746] hover:bg-[#F1F3F4] disabled:opacity-50">Save name</button>
          </div>
          <div className="border-t border-[#E8EAED] pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#202124]"><KeyRound className="h-4 w-4" />Change password</h3>
            <div className="mt-3 grid gap-3">
              <PasswordField label="Current password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} hint="Leave blank for Gmail-only accounts" />
              <PasswordField label="New password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} hint="At least 8 characters" />
              <button onClick={changePassword} disabled={!!busy || newPassword.length < 8} className="w-fit rounded-full border border-[#DADCE0] px-4 py-2 text-sm font-semibold text-[#444746] hover:bg-[#F1F3F4] disabled:opacity-50">Update password</button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#DADCE0] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F0FE] text-[#0B57D0]"><Mail className="h-5 w-5" /></div>
          <div><h2 className="font-semibold text-[#202124]">Connected accounts</h2><p className="mt-1 text-sm text-[#5F6368]">Manage ApplyPilot’s Gmail connection and Google permissions.</p></div>
        </div>
        <div className="mt-5 rounded-xl border border-[#E8EAED] p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className={`mt-1 h-2.5 w-2.5 rounded-full ${gmailConnected ? "bg-[#188038]" : "bg-[#F9AB00]"}`} />
              <div>
                <p className="font-semibold text-[#202124]">Gmail</p>
                <p className="mt-1 text-sm text-[#5F6368]">{gmailConnected ? user?.gmail_email || "Connected account" : "Not connected"}</p>
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${gmailConnected ? "bg-[#E6F4EA] text-[#137333]" : "bg-[#FEF7E0] text-[#8D5B00]"}`}>{gmailConnected ? "Connected" : "Disconnected"}</span>
              </div>
            </div>
            {!gmailConnected && <a href={`${api.base}/auth/google`} className="inline-flex w-fit rounded-full bg-[#0B57D0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0842A0]">Connect Gmail</a>}
          </div>
          <div className="mt-5 border-t border-[#E8EAED] pt-4">
            <p className="text-sm leading-6 text-[#5F6368]">ApplyPilot requests permission to read job-related emails and send application email only after you approve it. You review each application before it is sent.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="rounded-full border border-[#DADCE0] px-4 py-2 text-sm font-semibold text-[#0B57D0] hover:bg-[#E8F0FE]">Manage Google permissions</a>
              {gmailConnected && <button type="button" disabled title="In-app disconnect is not supported by the current API" className="cursor-not-allowed rounded-full border border-[#DADCE0] px-4 py-2 text-sm font-semibold text-[#80868B] opacity-70">Disconnect unavailable</button>}
            </div>
            {gmailConnected && <p className="mt-2 text-xs text-[#5F6368]">To revoke Google access, use Google permissions above. ApplyPilot does not currently have an in-app disconnect endpoint.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#DADCE0] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F0FE] text-[#0B57D0]"><Workflow className="h-5 w-5" /></div>
          <div><h2 className="font-semibold text-[#202124]">Automation</h2><p className="mt-1 text-sm text-[#5F6368]">What ApplyPilot does in the background. Schedules are set by the server administrator.</p></div>
        </div>
        {auto === false && <p className="mt-5 text-sm text-[#B3261E]">Could not load automation status.</p>}
        {auto && (
          <div className="mt-5 divide-y divide-[#E8EAED] rounded-xl border border-[#E8EAED] px-4 sm:px-5">
            <Row icon={Mail} label="Inbox scanning and scoring" description="Finds new job emails, extracts details and scores them against your profile." value={auto.scheduler_enabled ? every(auto.agent_interval_min) : "Off"} on={auto.scheduler_enabled} />
            <Row icon={RefreshCw} label="Reply tracking" description="Detects interview, offer and rejection emails for submitted applications." value={auto.scheduler_enabled ? every(auto.replies_interval_min) : "Off"} on={auto.scheduler_enabled} />
            <Row icon={Clock3} label="Deadline reminders" description={`Daily alert for deadlines in the next ${auto.deadline_days} days.`} value={auto.scheduler_enabled ? `daily ${auto.deadline_hour}:00` : "Off"} on={auto.scheduler_enabled} />
            <Row icon={Sparkles} label="Job discovery" description="Searches for new roles that fit your profile." value={auto.scheduler_enabled && auto.discovery_enabled ? every(auto.discovery_interval_hours * 60) : "Off"} on={auto.scheduler_enabled && auto.discovery_enabled} />
            <Row icon={AtSign} label="Telegram alerts" description="Sends a message when there is something new for you." value={auto.telegram_configured ? "Connected" : "Not set up"} on={auto.telegram_configured} />
            <Row icon={ShieldCheck} label="Approval before submission" description="Nothing is submitted or emailed without your approval." value="Always on" />
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={runNow} disabled={!!busy || !gmailConnected} className="rounded-full bg-[#0B57D0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0842A0] disabled:opacity-50">{busy === "Running the agent..." ? busy : "Run agent now"}</button>
          <p className="flex items-center gap-2 text-xs text-[#5F6368]"><Activity className="h-4 w-4" />Every action is recorded on the Activity page.</p>
        </div>
      </section>
    </div>
  );
}