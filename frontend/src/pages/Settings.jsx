import { useState } from "react";
import {
  Activity, AtSign, Clock3, KeyRound, Mail, RefreshCw, ShieldCheck,
  Sparkles, UserRound, Workflow,
} from "lucide-react";
import { api } from "../api";
import { StatusMessage } from "../components/UI";

const AUTOMATION_ITEMS = [
  { label: "Automatic email scanning", description: "Scheduled scanning is managed by the external n8n workflow.", icon: Mail },
  { label: "Email scanning frequency", description: "The interval is configured in the n8n scheduler, not in this app.", icon: Clock3, frequency: true },
  { label: "Automatic opportunity extraction", description: "Extraction runs as part of the external automation pipeline.", icon: Sparkles },
  { label: "Automatic resume generation", description: "Resume generation currently starts when you prepare an application.", icon: RefreshCw },
];

function UnavailableControl({ label, frequency }) {
  if (frequency) {
    return <select disabled aria-label={`${label} managed by n8n`} className="rounded-lg border border-[#DADCE0] bg-[#F8F9FA] px-2.5 py-1.5 text-xs text-[#5F6368] opacity-80"><option>Managed in n8n</option></select>;
  }
  return (
    <span aria-label={`${label} managed by n8n`} className="shrink-0 rounded-full bg-[#F1F3F4] px-2.5 py-1 text-[11px] font-semibold text-[#5F6368]">n8n-managed</span>
  );
}

export default function Settings({ user, gmailConnected, onUserUpdate }) {
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
              <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password (optional for Gmail-only accounts)" className="rounded-xl border border-[#DADCE0] px-3.5 py-2.5 text-sm outline-none focus:border-[#0B57D0]" />
              <input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (at least 8 characters)" className="rounded-xl border border-[#DADCE0] px-3.5 py-2.5 text-sm outline-none focus:border-[#0B57D0]" />
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
          <div><h2 className="font-semibold text-[#202124]">Automation settings</h2><p className="mt-1 text-sm text-[#5F6368]">Automation is currently managed by the external n8n workflow.</p></div>
        </div>
        <div className="mt-5 divide-y divide-[#E8EAED] rounded-xl border border-[#E8EAED] px-4 sm:px-5">
          {AUTOMATION_ITEMS.map(({ label, description, icon: Icon, frequency }) => (
            <div key={label} className="flex items-center gap-3 py-4">
              <Icon className="h-5 w-5 shrink-0 text-[#5F6368]" />
              <div className="min-w-0 flex-1"><p className="text-sm font-medium text-[#202124]">{label}</p><p className="mt-1 text-xs leading-5 text-[#5F6368]">{description}</p></div>
              <UnavailableControl label={label} frequency={frequency} />
            </div>
          ))}
          <div className="flex items-center gap-3 py-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-[#188038]" />
            <div className="min-w-0 flex-1"><p className="text-sm font-medium text-[#202124]">Approval before submission</p><p className="mt-1 text-xs leading-5 text-[#5F6368]">ApplyPilot always requires your approval before submitting or sending an application.</p></div>
            <span className="rounded-full bg-[#E6F4EA] px-2.5 py-1 text-xs font-semibold text-[#137333]">Always on</span>
          </div>
        </div>
        <div className="mt-5 rounded-xl bg-[#F6F8FC] p-4">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-[#5F6368]" /><h3 className="text-sm font-semibold text-[#202124]">Automation execution history</h3></div>
          <p className="mt-2 text-sm text-[#5F6368]">Execution history is not currently exposed to ApplyPilot, so there are no run details to display here.</p>
        </div>
      </section>
    </div>
  );
}
