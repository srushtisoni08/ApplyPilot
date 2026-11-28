import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "../api";
import AuthLayout from "./AuthLayout";
import { PasswordField, StrengthMeter } from "./Fields";
import { Button, StatusMessage } from "./UI";

export default function ResetPassword({ token, onDone, onBack }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Pick something you have not used elsewhere. This link works once."
      footer={
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
          <ArrowLeft className="h-4 w-4" />Back to sign in
        </button>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <PasswordField label="New password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <StrengthMeter value={password} />
        </div>
        <PasswordField label="Confirm new password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <StatusMessage message={error} error />
        <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">{busy ? "Saving..." : "Update password"}</Button>
      </form>
    </AuthLayout>
  );
}