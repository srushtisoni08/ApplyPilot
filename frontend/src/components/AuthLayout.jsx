import { BriefcaseBusiness } from "lucide-react";

export default function AuthLayout({ children, subtitle }) {
  return (
    <main className="min-h-screen bg-[#F6F8FC] px-4 py-10 text-[#202124] sm:grid sm:place-items-center">
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0B57D0] text-white shadow-sm"><BriefcaseBusiness className="h-5 w-5" /></div>
          <span className="text-2xl font-semibold tracking-tight text-[#202124]">ApplyPilot</span>
        </div>
        <section className="rounded-3xl border border-[#DADCE0] bg-white px-6 py-8 shadow-[0_8px_32px_rgba(60,64,67,0.10)] sm:px-10">
          {subtitle && <p className="mb-7 text-center text-sm text-[#5F6368]">{subtitle}</p>}
          {children}
        </section>
        <p className="mt-6 text-center text-xs text-[#5F6368]">
          Your account is private. Gmail is optional and can be connected later.
        </p>
      </div>
    </main>
  );
}
