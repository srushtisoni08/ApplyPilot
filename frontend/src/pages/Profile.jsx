import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, FileUp } from "lucide-react";
import { api } from "../api";
import { Button, LoadingState, StatusMessage } from "../components/UI";
import { TextField, inputCls } from "../components/Fields";

const TITLE_KEYS = ["name", "degree", "role", "title", "institution", "company"];
const SUBTITLE_KEYS = ["institution", "company", "field", "duration"];

const FIELDS = [
  ["name", "Full name"],
  ["email", "Email address"],
  ["phone", "Phone number"],
  ["location", "Location"],
  ["cgpa", "CGPA"],
  ["grad_year", "Graduation year"],
  ["skillsText", "Skills (comma separated)"],
];

function readableLabel(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isPresent(value) {
  return value !== null && value !== undefined && value !== "";
}

function ValueSummary({ value }) {
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-sm text-faint">None listed</span>;
    if (value.every((item) => typeof item !== "object" || item === null)) {
      return <div className="flex flex-wrap gap-1.5">{value.map((item, index) => <span key={`${item}-${index}`} className="rounded-md bg-surface-2 px-2 py-1 text-xs font-medium text-ink">{String(item)}</span>)}</div>;
    }
    return <div className="space-y-2">{value.map((item, index) => <RecordCard key={index} value={item} index={index} compact />)}</div>;
  }
  if (typeof value === "object" && value !== null) {
    return <div className="space-y-1.5">{Object.entries(value).filter(([, item]) => isPresent(item)).map(([key, item]) => <div key={key} className="text-sm leading-6"><span className="font-medium text-muted">{readableLabel(key)}: </span><span className="break-words text-ink">{typeof item === "object" ? JSON.stringify(item) : String(item)}</span></div>)}</div>;
  }
  return <span className="whitespace-pre-wrap break-words text-sm leading-6 text-ink">{String(value)}</span>;
}

function RecordCard({ value, index, compact = false }) {
  if (typeof value !== "object" || value === null) {
    return <div className="rounded-lg border border-line px-4 py-3"><ValueSummary value={value} /></div>;
  }
  const entries = Object.entries(value).filter(([, item]) => isPresent(item));
  const titleEntry = entries.find(([key]) => TITLE_KEYS.includes(key));
  const subtitleEntry = entries.find(([key]) => key !== titleEntry?.[0] && SUBTITLE_KEYS.includes(key));
  const details = entries.filter(([key]) => key !== titleEntry?.[0] && key !== subtitleEntry?.[0]);
  return (
    <article className={`rounded-xl border border-line bg-surface ${compact ? "p-3" : "p-4 sm:p-5"}`}>
      {(titleEntry || subtitleEntry) && <div className="mb-3 border-b border-line pb-3">
        <h4 className="font-semibold text-ink">{titleEntry ? String(titleEntry[1]) : `Entry ${index + 1}`}</h4>
        {subtitleEntry && <p className="mt-1 text-sm text-muted">{String(subtitleEntry[1])}</p>}
      </div>}
      {details.length > 0 ? <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {details.map(([key, item]) => <div key={key} className="min-w-0">
          <dt className="mb-1 text-xs font-medium text-muted">{readableLabel(key)}</dt>
          <dd><ValueSummary value={item} /></dd>
        </div>)}
      </dl> : !titleEntry && !subtitleEntry ? <p className="text-sm text-muted">No details available.</p> : null}
    </article>
  );
}

function StructuredPreview({ value }) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">The JSON has an edit in progress. Fix its format to preview these details.</p>;
    }
  }
  if (Array.isArray(value)) {
    if (!value.length) return <p className="text-sm text-muted">No details added yet.</p>;
    if (value.every((item) => typeof item !== "object" || item === null)) return <ValueSummary value={value} />;
    return <div className="space-y-3">{value.map((item, index) => <RecordCard key={index} value={item} index={index} />)}</div>;
  }
  if (typeof value === "object" && value !== null) return <RecordCard value={value} index={0} />;
  return <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{String(value ?? "No details added yet.")}</p>;
}

function Section({ title, description, children }) {
  return (
    <section className="grid gap-x-10 gap-y-4 border-t border-line py-8 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div>
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function Profile({ user, userId = user?.id }) {
  const [prof, setProf] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingDetails, setEditingDetails] = useState({});

  const load = async () => {
    try {
      const profile = await api.profile(userId);
      setProf(profile);
      setForm({ ...profile.data, skillsText: (profile.data.skills || []).join(", ") });
      setError("");
    } catch (e) {
      setError(`Could not load your candidate profile: ${e.message}`);
      throw e;
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    api.profile(userId)
      .then((profile) => {
        if (!active) return;
        setProf(profile);
        setForm({ ...profile.data, skillsText: (profile.data.skills || []).join(", ") });
      })
      .catch((e) => { if (active) setError(`Could not load your candidate profile: ${e.message}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const run = async (label, fn) => {
    setBusy(label);
    setMsg("");
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const onUpload = (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    if (!files.length) return;
    run("Uploading documents...", async () => {
      for (const file of files) await api.upload(file);
      setMsg(`Uploaded ${files.length} document${files.length === 1 ? "" : "s"}. Build your profile to extract details.`);
    });
  };

  const build = () => run("Extracting profile details...", async () => {
    await api.buildProfile(userId);
    await load();
    setMsg("Profile extracted. Review the details below and confirm when ready.");
  });

  const save = () => run("Saving profile...", async () => {
    const { skillsText, ...rest } = form;
    const num = (value) => (value === "" || value == null ? null : Number(value));
    const original = prof?.data || {};
    for (const [key, value] of Object.entries(rest)) {
      if (typeof original[key] === "object" && original[key] !== null && typeof value === "string") {
        try {
          rest[key] = JSON.parse(value);
        } catch {
          throw new Error(`${key} must contain valid JSON. Review the field and try again.`);
        }
      }
    }
    await api.saveProfile(userId, {
      ...rest,
      cgpa: num(rest.cgpa),
      grad_year: num(rest.grad_year),
      skills: skillsText.split(",").map((skill) => skill.trim()).filter(Boolean),
      low_confidence_fields: [],
    });
    await load();
    setMsg("Candidate profile saved and confirmed.");
  });

  const needs = prof?.needs_confirmation || [];
  const otherEntries = useMemo(() => Object.entries(form || {})
    .filter(([key]) => !FIELDS.some(([field]) => field === key))
    .sort(([a], [b]) => {
      const priority = { education: 0, projects: 1 };
      return (priority[a] ?? 2) - (priority[b] ?? 2);
    }), [form]);
  const flagged = (key) => needs.includes(key === "skillsText" ? "skills" : key);

  if (loading) return <LoadingState label="Loading your profile..." />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">My profile</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">This is what ApplyPilot uses to score jobs and write your resume. Anything wrong here ends up in your applications, so check it.</p>
        </div>
        {form && (
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${prof?.confirmed ? "text-ok" : "text-warn"}`}>
            {prof?.confirmed ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
            {prof?.confirmed ? "Confirmed" : "Not confirmed yet"}
          </span>
        )}
      </div>

      <StatusMessage message={error || msg} error={!!error} />

      <Section title="Documents" description="Resume, certificates or marksheets. PDF, Word or images.">
        <div className="flex flex-wrap items-center gap-3">
          <label className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 ${busy ? "pointer-events-none opacity-50" : ""}`}>
            <FileUp className="h-4 w-4" />Add documents
            <input type="file" multiple onChange={onUpload} disabled={!!busy} className="sr-only" />
          </label>
          <Button onClick={build} disabled={!!busy}>Build profile from documents</Button>
          {busy && <span role="status" className="text-sm text-muted">{busy}</span>}
        </div>
      </Section>

      {form && (
        <>
          <Section title="Basics" description={needs.length ? `Highlighted fields couldn't be read confidently: ${needs.join(", ")}.` : "Contact details and skills."}>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map(([key, label]) => (
                <div key={key} className={key === "skillsText" ? "sm:col-span-2" : ""}>
                  <TextField label={label} value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={flagged(key) ? "!border-warn !bg-warn-bg" : ""} />
                </div>
              ))}
            </div>
          </Section>

          {otherEntries.map(([key, value]) => {
            const originalValue = prof?.data?.[key];
            const structured = typeof originalValue === "object" && originalValue !== null;
            const text = structured && typeof value !== "string" ? JSON.stringify(value, null, 2) : value ?? "";
            const isEditing = !!editingDetails[key];
            return (
              <Section
                key={key}
                title={readableLabel(key)}
                description={Array.isArray(value) ? `${value.length} ${value.length === 1 ? "entry" : "entries"}` : undefined}
              >
                {structured && (
                  <div className="mb-3 flex justify-end">
                    <button type="button" onClick={() => setEditingDetails({ ...editingDetails, [key]: !isEditing })} className="text-sm font-semibold text-brand hover:underline">{isEditing ? "Back to preview" : "Edit as JSON"}</button>
                  </div>
                )}
                {structured && !isEditing ? <StructuredPreview value={value} /> : structured ? (
                  <div>
                    <textarea aria-label={`Edit ${readableLabel(key)} as JSON`} rows={Math.min(12, Math.max(5, String(text).split("\n").length))} value={text} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 font-mono text-xs leading-5 text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/15" />
                    <p className="mt-2 text-xs text-muted">Included when you save.</p>
                  </div>
                ) : (
                  <input aria-label={`Edit ${readableLabel(key)}`} value={text} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={inputCls} />
                )}
              </Section>
            );
          })}

          <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-canvas/90 px-4 py-4 backdrop-blur sm:-mx-7 sm:px-7">
            <p className="text-sm text-muted">{prof?.confirmed ? "Saving again keeps it confirmed." : "Saving marks this profile as confirmed."}</p>
            <Button onClick={save} loading={busy === "Saving profile..."} disabled={!!busy}>Save and confirm</Button>
          </div>
        </>
      )}
    </div>
  );
}
