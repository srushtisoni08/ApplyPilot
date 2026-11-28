import { useState } from "react";
import { api } from "../api";
import AuthLayout from "./AuthLayout";

export default function Login({ onLogin, onRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthLayout subtitle="Sign in to continue to ApplyPilot">
      <h1 className="mb-2 text-center text-2xl font-medium">Welcome back</h1>
      <p className="mb-7 text-center text-sm text-slate-500">Use your ApplyPilot account</p>
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-medium">
          Email
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-3 font-normal outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <span className="relative mt-2 block">
            <input
              required
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-3 pr-20 font-normal outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 text-xs font-semibold text-blue-700">
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-full bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
          {busy ? "Signing in..." : "Login"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        New to ApplyPilot?{" "}
        <button onClick={onRegister} className="font-semibold text-blue-700 hover:underline">Create an account</button>
      </p>
      <div className="mt-6 border-t pt-5 text-center">
        <a href={`${api.base}/auth/google`} className="text-sm font-medium text-slate-600 hover:text-blue-700">
          Sign in with Google
        </a>
      </div>
    </AuthLayout>
  );
}
