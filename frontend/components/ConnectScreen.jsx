import { api } from "../api";

export default function ConnectScreen() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">ApplyPilot</h1>
        <p className="text-slate-600">Connect Gmail (read-only) to start.</p>
        <a
          href={`${api.base}/auth/google`}
          className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-white font-medium hover:bg-blue-700"
        >
          Connect Gmail
        </a>
      </div>
    </div>
  );
}