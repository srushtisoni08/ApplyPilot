import { useEffect, useState } from "react";
import { api } from "../api";
import { Button, StatusMessage } from "../components/UI";
import { PasswordField, TextField } from "../components/Fields";

const every = (min) => (min % 60 === 0 ? `every ${min / 60} h` : `every ${min} min`);

function Section({ title, description, children }) {
  return (
    <section className="grid gap-x-10 gap-y-4 border-t border-line py-8 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div>
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Row({ label, description, value, on }) {
  return (
    <div className="flex items-start gap-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-[13px] leading-5 text-muted">{description}</p>
      </div>
      <span className={`flex shrink-0 items-center gap-2 text-sm ${on === false ? "text-faint" : "text-ink"}`}>
        <i aria-hidden="true" className={`h-2 w-2 rounded-full ${on === false ? "bg-line" : "bg-ok"}`} />{value}
      </span>
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

  const runNow = () => run("Running the agent...", async () => {
    const r = await api.runAgent(false);
    setMessage(`Agent run finished: ${r.steps?.length ?? 0} step(s) completed.`);
  });

  const saveAccount = () => run("Saving account...", async () => {
    const updated = await api.updateAccount({ full_name: fullName });
    onUserUpdate?.(updated);
    setMessage("Account name updated.");
  });

  const changePassword = () => run("Updating password...", async () => {
    await api.updatePassword({ current_password: currentPassword || null, new_password: newPassword });
    setCurrentPassword("");
    setNewPassword("");
    setMessage("Password updated.");
  });

  return (
    <div>
      <div className="pb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Settings</h1>
        <p className="mt-2 text-sm text-muted">Your account, Gmail connection and what runs in the background.</p>
      </div>
      <StatusMessage message={error || message} error={!!error} />

      <Section title="Account" description="How you appear in ApplyPilot and how you sign in.">
        <div className="max-w-md space-y-4">
          <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={255} />
          <p className="text-sm text-muted">Signed in as <span className="text-ink">{user?.email}</span></p>
          <Button variant="secondary" onClick={saveAccount} loading={busy === "Saving account..."} disabled={!!busy}>Save name</Button>
        </div>
        <div className="mt-8 max-w-md space-y-4 border-t border-line pt-6">
          <h3 className="text-sm font-semibold text-ink">Change password</h3>
          <PasswordField label="Current password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} hint="Leave blank if you only ever signed in with Google." />
          <PasswordField label="New password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} hint="At least 8 characters." />
          <Button variant="secondary" onClick={changePassword} loading={busy === "Updating password..."} disabled={!!busy || newPassword.length < 8}>Update password</Button>
        </div>
      </Section>

      <Section title="Gmail" description="ApplyPilot reads job-related email and sends applications only after you approve each one.">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <i aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${gmailConnected ? "bg-ok" : "bg-warn"}`} />
            <div>
              <p className="text-sm font-semibold text-ink">{gmailConnected ? user?.gmail_email || "Connected" : "Not connected"}</p>
              <p className="text-[13px] text-muted">{gmailConnected ? "Gmail is connected." : "Connect Gmail to scan your inbox."}</p>
            </div>
          </div>
          {!gmailConnected && <Button href={`${api.base}/auth/google`}>Connect Gmail</Button>}
        </div>
        <p className="mt-5 text-sm text-muted">
          To revoke access, remove ApplyPilot in your{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">Google account permissions</a>.
          There's no in-app disconnect yet.
        </p>
      </Section>

      <Section title="Automation" description="What runs on its own. The schedule is set by whoever runs the server.">
        {auto === false && <p className="text-sm text-bad">Could not load automation status.</p>}
        {auto === null && <p className="text-sm text-muted">Loading...</p>}
        {auto && (
          <div className="divide-y divide-line">
            <Row label="Inbox scanning and scoring" description="Finds new job emails and scores them against your profile." value={auto.scheduler_enabled ? every(auto.agent_interval_min) : "Off"} on={auto.scheduler_enabled} />
            <Row label="Reply tracking" description="Spots interview, offer and rejection emails." value={auto.scheduler_enabled ? every(auto.replies_interval_min) : "Off"} on={auto.scheduler_enabled} />
            <Row label="Deadline reminders" description={`A daily alert for deadlines in the next ${auto.deadline_days} days.`} value={auto.scheduler_enabled ? `daily at ${auto.deadline_hour}:00` : "Off"} on={auto.scheduler_enabled} />
            <Row label="Job discovery" description="Searches for new roles that fit your profile." value={auto.scheduler_enabled && auto.discovery_enabled ? every(auto.discovery_interval_hours * 60) : "Off"} on={auto.scheduler_enabled && auto.discovery_enabled} />
            <Row label="Telegram alerts" description="A message when there's something new." value={auto.telegram_configured ? "Connected" : "Not set up"} on={auto.telegram_configured} />
            <Row label="Approval before sending" description="Nothing is submitted or emailed without your approval." value="Always on" />
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button variant="secondary" onClick={runNow} loading={busy === "Running the agent..."} disabled={!!busy || !gmailConnected}>Run agent now</Button>
          <p className="text-[13px] text-muted">Every run is logged on the Activity page.</p>
        </div>
      </Section>
    </div>
  );
}
