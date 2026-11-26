export default function AuthLayout({ children, subtitle }) {
  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-10 text-slate-800 sm:grid sm:place-items-center">
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-sm">
            A
          </div>
          <span className="text-2xl font-semibold tracking-tight text-slate-800">ApplyPilot</span>
        </div>
        <section className="rounded-3xl border border-slate-200/80 bg-white px-6 py-8 shadow-[0_8px_32px_rgba(60,64,67,0.10)] sm:px-10">
          {subtitle && <p className="mb-7 text-center text-sm text-slate-500">{subtitle}</p>}
          {children}
        </section>
        <p className="mt-6 text-center text-xs text-slate-500">
          Your account is private. Gmail is optional and can be connected later.
        </p>
      </div>
    </main>
  );
}
