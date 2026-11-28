import { useState } from "react";
import { api } from "../api";
import AuthLayout from "./AuthLayout";
import { PasswordField, TextField } from "./Fields";
import { Button, StatusMessage } from "./UI";

export default function Login({ onLogin, onRegister, onForgot, notice }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin({ email, password });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where your search left off."
      footer={
        <>
          New to ApplyPilot?{" "}
          <button type="button" onClick={onRegister} className="font-semibold text-brand hover:underline">Create an account</button>
        </>
      }
    >
      <form className="space-y-5" onSubmit={submit}>
        <StatusMessage message={notice} />
        <TextField label="Email" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <PasswordField
          label="Password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          labelRight={<button type="button" onClick={onForgot} className="text-[13px] font-semibold text-brand hover:underline">Forgot password?</button>}
        />
        <StatusMessage message={error} error />
        <Button type="submit" size="lg" loading={busy} className="w-full">{busy ? "Signing in..." : "Sign in"}</Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <Button href={`${api.base}/auth/google`} variant="secondary" size="lg" className="w-full">Continue with Google</Button>
    </AuthLayout>
  );
}