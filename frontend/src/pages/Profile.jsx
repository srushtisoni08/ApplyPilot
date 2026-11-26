import { useEffect, useState } from "react";
import { api } from "../api";

const FIELDS = [
  ["name", "Name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["location", "Location"],
  ["cgpa", "CGPA"],
  ["grad_year", "Graduation year"],
  ["skillsText", "Skills (comma separated)"],
];

export default function Profile({ user, userId = user?.id, onUserUpdate, onLogout }) {
  const [prof, setProf] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const load = async () => {
    try {
      const p = await api.profile(userId);
      setProf(p);
      setForm({ ...p.data, skillsText: (p.data.skills || []).join(", ") });
    } catch {
      setProf(null);
      setForm(null);
    }
  };
  useEffect(() => {
    let active = true;
    api.profile(userId)
      .then((profile) => {
        if (!active) return;
        setProf(profile);
        setForm({ ...profile.data, skillsText: (profile.data.skills || []).join(", ") });
      })
      .catch(() => {
        if (!active) return;
        setProf(null);
        setForm(null);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const run = async (label, fn) => {
    setBusy(label);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg("Error: " + e.message);
    }
    setBusy("");
  };

  const onUpload = (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    run("Uploading...", async () => {
      for (const f of files) await api.upload(f);
      setMsg(`Uploaded ${files.length} file(s). Now click "Build profile".`);
    });
  };

  const build = () =>
    run("Building profile...", async () => {
      await api.buildProfile(userId);
      await load();
      setMsg("Profile built. Check the highlighted fields, then confirm.");
    });

  const save = () =>
    run("Saving...", async () => {
      const { skillsText, ...rest } = form;
      const num = (v) => (v === "" || v == null ? null : Number(v));
      await api.saveProfile(userId, {
        ...rest,
        cgpa: num(rest.cgpa),
        grad_year: num(rest.grad_year),
        skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
        low_confidence_fields: [],
      });
      await load();
      setMsg("Profile confirmed.");
    });

  const saveAccountName = () =>
    run("Saving account...", async () => {
      const updated = await api.updateAccount({ full_name: fullName });
      onUserUpdate?.(updated);
      setMsg("Account name updated.");
    });

  const savePassword = () =>
    run("Updating password...", async () => {
      await api.updatePassword({
        current_password: currentPassword || null,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setMsg("Password updated.");
    });

  const needs = prof?.needs_confirmation || [];
  const flagged = (key) => needs.includes(key === "skillsText" ? "skills" : key);
  const other = Object.fromEntries(
    Object.entries(form || {}).filter(([key]) => !FIELDS.some(([field]) => field === key))
  );

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h2 className="font-semibold">Account settings</h2>
            <p className="text-sm text-slate-600">ApplyPilot email: <span className="font-medium text-slate-800">{user?.email}</span></p>
            <label className="block text-sm text-slate-600">
              Full name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={255} className="mt-1 block w-full rounded-md border px-3 py-2 text-slate-900 sm:w-80" />
            </label>
            <button onClick={saveAccountName} disabled={!!busy} className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50">Save name</button>
            <div className="space-y-2 border-t pt-3">
              <h3 className="text-sm font-medium text-slate-700">Change password</h3>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password (leave blank for Gmail-only accounts)"
                className="block w-full rounded-md border px-3 py-2 text-sm sm:w-80"
              />
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (at least 8 characters)"
                className="block w-full rounded-md border px-3 py-2 text-sm sm:w-80"
              />
              <button onClick={savePassword} disabled={!!busy || newPassword.length < 8} className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50">Update password</button>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <p>
              Gmail:{" "}
              <span className={user?.gmail_connected ? "font-medium text-green-700" : "font-medium text-amber-700"}>
                {user?.gmail_connected ? `Connected${user.gmail_email ? ` (${user.gmail_email})` : ""}` : "Not connected"}
              </span>
            </p>
            {!user?.gmail_connected && (
              <a href={`${api.base}/auth/google`} className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Connect Gmail</a>
            )}
            <div><button onClick={onLogout} className="text-red-600 hover:underline">Log out</button></div>
          </div>
        </div>
      </section>
      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">1. Upload documents</h2>
        <p className="text-sm text-slate-500">Resume, certificates, marksheets (PDF, DOCX, image).</p>
        <input type="file" multiple onChange={onUpload} disabled={!!busy} className="text-sm" />
        <div>
          <button
            onClick={build}
            disabled={!!busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Build profile
          </button>
        </div>
      </section>

      {busy && <p className="text-sm text-blue-600">{busy}</p>}
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>{msg}</p>}

      {form && (
        <section className="rounded-xl border bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">2. Review and confirm</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                prof.confirmed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {prof.confirmed ? "Confirmed" : "Needs your confirmation"}
            </span>
          </div>
          {needs.length > 0 && (
            <p className="text-sm text-amber-700">
              We were not sure about: <b>{needs.join(", ")}</b>. Please check.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(([key, label]) => (
              <label key={key} className={`text-sm ${key === "skillsText" ? "sm:col-span-2" : ""}`}>
                <span className="block mb-1 text-slate-600">{label}</span>
                <input
                  value={form[key] ?? ""}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2 ${
                    flagged(key) ? "border-amber-400 bg-amber-50" : ""
                  }`}
                />
              </label>
            ))}
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600">
              Education, projects, experience, certificates (read-only)
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded bg-slate-50 p-3 text-xs">
              {JSON.stringify(other, null, 2)}
            </pre>
          </details>
          <button
            onClick={save}
            disabled={!!busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Save and confirm
          </button>
        </section>
      )}
    </div>
  );
}