import { useState } from "react";
import AuthLayout from "./AuthLayout";
import { PasswordField, StrengthMeter, TextField } from "./Fields";
import { Button, StatusMessage } from "./UI";

export default function Register({ onRegister, onLogin }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (form.password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    try {
      await onRegister({ full_name: form.full_name, email: form.email, password: form.password });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your workspace in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <button type="button" onClick={onLogin} className="font-semibold text-brand hover:underline">Sign in</button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <TextField label="Full name" required autoComplete="name" maxLength={255} value={form.full_name} onChange={update("full_name")} />
        <TextField label="Email" required type="email" autoComplete="email" value={form.email} onChange={update("email")} placeholder="you@example.com" />
        <div>
          <PasswordField label="Password" required autoComplete="new-password" value={form.password} onChange={update("password")} />
          <StrengthMeter value={form.password} />
        </div>
        <PasswordField label="Confirm password" required autoComplete="new-password" value={form.confirm} onChange={update("confirm")} />
        <StatusMessage message={error} error />
        <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">{busy ? "Creating account..." : "Create account"}</Button>
      </form>
    </AuthLayout>
  );
}