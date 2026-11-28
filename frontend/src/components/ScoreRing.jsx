import { useReducedMotion } from "framer-motion";

const TONE = { suitable: "var(--ok)", uncertain: "var(--warn)", unsuitable: "var(--bad)" };

/** Circular match score. Colour follows the category (never colour alone: the number is always shown). */
export default function ScoreRing({ score = 0, category, size = 56, stroke = 5 }) {
  const reduce = useReducedMotion();
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = TONE[category] || "var(--brand)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${value} percent match`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: reduce ? "none" : "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <span className="num absolute inset-0 grid place-items-center font-display text-[13px] font-semibold text-ink" style={{ fontSize: size * 0.27 }}>
        {value}
      </span>
    </div>
  );
}
