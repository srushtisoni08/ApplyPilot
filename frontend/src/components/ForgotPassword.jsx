import { useState } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { api } from "../api";
import AuthLayout from "./AuthLayout";
import { TextField } from "./Fields";
import { Button, StatusMessage } from "./UI";

export default function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
      <ArrowLeft className="h-4 w-4" />Back to sign in
    </button>
  );

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`If an account exists for ${email}, we have sent a link to reset your password. It expires in 30 minutes.`} footer={back}>
        <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-4 text-sm leading-6 text-muted">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <p>Nothing arrived? Check your spam folder, or try again in a minute. For security we show this message whether or not the address is registered.</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter the email you signed up with and we will send you a reset link." footer={back}>
      <form className="space-y-5" onSubmit={submit}>
        <TextField label="Email" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <StatusMessage message={error} error />
        <Button type="submit" size="lg" loading={busy} className="w-full">{busy ? "Sending..." : "Send reset link"}</Button>
      </form>
    </AuthLayout>
  );
}