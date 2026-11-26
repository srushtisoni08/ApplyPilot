import { useState } from "react";
import AuthLayout from "./AuthLayout";

export default function Register({ onRegister, onLogin }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
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
    <AuthLayout subtitle="Create your ApplyPilot account">
      <h1 className="mb-2 text-center text-2xl font-medium">Create your account</h1>
      <p className="mb-7 text-center text-sm text-slate-500">Get started with your job search</p>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium">
          Full name
          <input required autoComplete="name" maxLength={255} value={form.full_name} onChange={update("full_name")} className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input required type="email" autoComplete="email" value={form.email} onChange={update("email")} className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
        </label>
        {["password", "confirm"].map((key) => (
          <label key={key} className="block text-sm font-medium">
            {key === "password" ? "Password" : "Confirm password"}
            <span className="relative mt-2 block">
              <input required type={showPassword ? "text" : "password"} autoComplete={key === "password" ? "new-password" : "new-password"} value={form[key]} onChange={update(key)} className="w-full rounded-lg border border-slate-300 px-3.5 py-3 pr-20 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
              {key === "password" && (
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 text-xs font-semibold text-blue-700">
                  {showPassword ? "Hide" : "Show"}
                </button>
              )}
            </span>
          </label>
        ))}
        <p className="text-xs text-slate-500">Password must be at least 8 characters.</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-full bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
          {busy ? "Creating account..." : "Create Account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <button onClick={onLogin} className="font-semibold text-blue-700 hover:underline">Login</button>
      </p>
    </AuthLayout>
  );
}
