import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none transition placeholder:text-faint hover:border-faint focus:border-brand focus:ring-4 focus:ring-brand/15";

function Label({ id, children, right }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {children}
      </label>
      {right}
    </div>
  );
}

export function TextField({ label, hint, labelRight, className = "", ...props }) {
  const id = useId();
  return (
    <div>
      <Label id={id} right={labelRight}>{label}</Label>
      <input id={id} className={`${inputCls} ${className}`} {...props} />
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Password input with a working show/hide toggle. */
export function PasswordField({ label, hint, labelRight, className = "", ...props }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label id={id} right={labelRight}>{label}</Label>
      <div className="relative">
        <input id={id} type={show ? "text" : "password"} className={`${inputCls} pr-11 ${className}`} {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          title={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-1.5 my-auto grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function score(value) {
  if (!value) return 0;
  let s = 0;
  if (value.length >= 8) s += 1;
  if (value.length >= 12) s += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) s += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) s += 1;
  return s;
}

const LEVELS = [
  ["Too short", "bg-bad"],
  ["Weak", "bg-bad"],
  ["Okay", "bg-warn"],
  ["Good", "bg-ok"],
  ["Strong", "bg-ok"],
];

export function StrengthMeter({ value }) {
  const s = score(value);
  const [label, color] = LEVELS[s];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= s ? color : "bg-line"}`} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">{value ? label : "Use 8+ characters, mixing letters, numbers and symbols."}</p>
    </div>
  );
}