import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Logo, Wordmark } from "./Brand";
import { ThemeToggle } from "./Theme";

const STOPS = [
  { x: 12, y: 92, label: "Found", tx: 12, ty: 114, anchor: "start" },
  { x: 168, y: 28, label: "Matched", tx: 168, ty: 12, anchor: "middle" },
  { x: 318, y: 60, label: "Drafted", tx: 318, ty: 86, anchor: "middle" },
  { x: 408, y: 20, label: "You approve", tx: 424, ty: 46, anchor: "end" },
];

function FlightPath() {
  return (
    <svg viewBox="0 0 430 124" className="w-full max-w-[460px]" role="img" aria-label="Found, matched, drafted, then you approve">
      <path d="M12 92 C90 92 96 28 168 28 S246 92 318 60 S380 20 408 20" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1.5" />
      <path className="route-flow" d="M12 92 C90 92 96 28 168 28 S246 92 318 60 S380 20 408 20" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
      {STOPS.map((s, i) => (
        <g key={s.label}>
          {i === STOPS.length - 1 && <circle className="pulse-ring" cx={s.x} cy={s.y} r="7" fill="#a78bfa" />}
          <circle cx={s.x} cy={s.y} r={i === STOPS.length - 1 ? 7 : 5} fill={i === STOPS.length - 1 ? "#a78bfa" : "#101828"} stroke={i === STOPS.length - 1 ? "#fff" : "#7aa2f7"} strokeWidth="2" />
          <text x={s.tx} y={s.ty} textAnchor={s.anchor} fontSize="11.5" fontWeight={i === STOPS.length - 1 ? 700 : 500} fill={i === STOPS.length - 1 ? "#fff" : "rgba(255,255,255,.7)"}>
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

const PROMISES = ["Gmail access is read-only until you choose to send", "Resumes are fact-checked against your profile", "Nothing leaves without your approval"];

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#101828] p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden="true" className="pointer-events-none absolute -left-28 -top-28 h-[440px] w-[440px] rounded-full bg-[#2563eb]/25 blur-[120px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-20 h-[400px] w-[400px] rounded-full bg-[#a78bfa]/20 blur-[120px]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(75% 65% at 25% 30%, #000, transparent)",
            WebkitMaskImage: "radial-gradient(75% 65% at 25% 30%, #000, transparent)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <Logo size={40} />
          <Wordmark className="text-white" />
        </div>
        <div className="relative my-auto max-w-[520px] py-12">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#a78bfa]">Your job search, co-piloted</p>
          <h2 className="mt-4 font-display text-[3.1rem] font-semibold leading-[1.04] tracking-tight">
            Every application, reviewed by you before it leaves.
          </h2>
          <p className="mt-5 max-w-[440px] text-[15px] leading-7 text-white/65">
            ApplyPilot finds roles in your inbox, drafts a tailored resume and cover letter, and then waits. You stay the one who presses send.
          </p>
          <div className="mt-12"><FlightPath /></div>
        </div>
        <ul className="relative space-y-2.5 text-sm text-white/70">
          {PROMISES.map((p) => (
            <li key={p} className="flex items-center gap-2.5">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-[#a78bfa]"><Check className="h-3 w-3" strokeWidth={3} /></span>
              {p}
            </li>
          ))}
        </ul>
      </aside>

      <div className="relative flex min-h-screen flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible"><Logo size={34} /><Wordmark className="text-ink" /></div>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-[15px] leading-6 text-muted">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
          </motion.div>
        </div>
        <p className="text-center text-xs text-faint">Your account is private. Gmail is optional and can be connected later.</p>
      </div>
    </main>
  );
}