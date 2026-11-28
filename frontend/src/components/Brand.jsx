export function Logo({ size = 40, className = "" }) {
  return (
    <span
      className={`grid shrink-0 place-items-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "28%",
        background: "linear-gradient(135deg,#2563eb,#4f46e5 55%,#a78bfa)",
        boxShadow: "0 6px 16px -4px rgba(37,99,235,.55)",
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.52} height={size * 0.52} fill="none" aria-hidden="true">
        <path d="M3.2 11.4 20.6 4 16.9 20l-4.8-5.2-8.9-3.4Z" fill="#fff" />
        <path d="m12.1 14.8 8.5-10.8" stroke="#2563eb" strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Wordmark({ className = "" }) {
  return (
    <span className={`font-display text-[1.35rem] font-semibold tracking-tight ${className}`}>
      Apply<span className="text-accent">Pilot</span>
    </span>
  );
}