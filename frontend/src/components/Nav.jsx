const TABS = [
  ["opportunities", "Opportunities"],
  ["approvals", "Approvals"],
  ["applications", "Applications"],
  ["profile", "Profile"],
];

export default function Nav({ tab, onChange, pending }) {
  return (
    <nav className="flex gap-1">
      {TABS.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {label}
          {k === "approvals" && pending > 0 && (
            <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-xs text-white">{pending}</span>
          )}
        </button>
      ))}
    </nav>
  );
}