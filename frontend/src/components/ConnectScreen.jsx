import { api } from "../api";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Mail, ShieldCheck } from "lucide-react";

export default function ConnectScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F6F8FC] px-4 py-10">
      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#DADCE0] bg-white shadow-sm md:grid md:grid-cols-[1.05fr_0.95fr]">
        <section className="p-7 sm:p-10 lg:p-14">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0B57D0] text-white"><BriefcaseBusiness className="h-5 w-5" /></div>
            <span className="text-xl font-semibold tracking-tight text-[#202124]">ApplyPilot</span>
          </div>
          <p className="mt-12 text-sm font-semibold text-[#0B57D0]">A calmer way to manage your job search</p>
          <h1 className="mt-3 max-w-lg text-3xl font-semibold leading-tight tracking-tight text-[#202124] sm:text-4xl">Turn job emails into a clear application plan.</h1>
          <p className="mt-4 max-w-lg leading-7 text-[#5F6368]">ApplyPilot finds opportunities in your inbox, compares them with your profile, and helps prepare applications for your review.</p>
          <div className="mt-8 space-y-4">
            {["Discover opportunities from job emails", "Match roles to your candidate profile", "Review documents and approve every submission"].map((item) => <p key={item} className="flex items-center gap-3 text-sm text-[#444746]"><CheckCircle2 className="h-5 w-5 shrink-0 text-[#188038]" />{item}</p>)}
          </div>
          <a href={`${api.base}/auth/google`} className="mt-9 inline-flex items-center gap-3 rounded-full bg-[#0B57D0] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0842A0] focus:outline-none focus:ring-4 focus:ring-[#D3E3FD]">
            <Mail className="h-4 w-4" />Connect Gmail<ArrowRight className="h-4 w-4" />
          </a>
          <p className="mt-4 text-xs text-[#5F6368]">You can disconnect your account at any time through Google account settings.</p>
        </section>
        <aside className="flex flex-col justify-center bg-[#E8F0FE] p-7 sm:p-10 lg:p-14">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-white text-[#0B57D0] shadow-sm"><Mail className="h-9 w-9" /></div>
          <div className="mt-8 rounded-2xl border border-[#D3E3FD] bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0B57D0]" /><div><h2 className="font-semibold text-[#202124]">Your account stays in control</h2><p className="mt-2 text-sm leading-6 text-[#5F6368]">Gmail access lets ApplyPilot read job-related messages and send application email only after you explicitly approve it. You review generated documents and each submission before it is sent.</p></div></div>
          </div>
          <p className="mt-5 text-center text-xs leading-5 text-[#5F6368]">Google will show the requested permissions before you continue. ApplyPilot does not submit applications without your confirmation.</p>
        </aside>
      </div>
    </main>
  );
}