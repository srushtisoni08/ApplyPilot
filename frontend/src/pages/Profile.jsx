import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileUp } from "lucide-react";
import { api } from "../api";
import { LoadingState, StatusMessage } from "../components/UI";

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
    if (!value.length) return <span className="text-sm text-[#80868B]">None listed</span>;
    if (value.every((item) => typeof item !== "object" || item === null)) {
      return <div className="flex flex-wrap gap-1.5">{value.map((item, index) => <span key={`${item}-${index}`} className="rounded-full bg-[#E8F0FE] px-2.5 py-1 text-xs font-medium text-[#174EA6]">{String(item)}</span>)}</div>;
    }
    return <div className="space-y-2">{value.map((item, index) => <RecordCard key={index} value={item} index={index} compact />)}</div>;
  }
  if (typeof value === "object" && value !== null) {
    return <div className="space-y-1.5">{Object.entries(value).filter(([, item]) => isPresent(item)).map(([key, item]) => <div key={key} className="text-sm leading-6"><span className="font-medium text-[#5F6368]">{readableLabel(key)}: </span><span className="break-words text-[#202124]">{typeof item === "object" ? JSON.stringify(item) : String(item)}</span></div>)}</div>;
  }
  return <span className="whitespace-pre-wrap break-words text-sm leading-6 text-[#202124]">{String(value)}</span>;
}

function RecordCard({ value, index, compact = false }) {
  if (typeof value !== "object" || value === null) {
    return <div className="rounded-xl border border-[#E8EAED] bg-white px-4 py-3"><ValueSummary value={value} /></div>;
  }
  const entries = Object.entries(value).filter(([, item]) => isPresent(item));
  const titleEntry = entries.find(([key]) => TITLE_KEYS.includes(key));
  const subtitleEntry = entries.find(([key]) => key !== titleEntry?.[0] && SUBTITLE_KEYS.includes(key));
  const details = entries.filter(([key]) => key !== titleEntry?.[0] && key !== subtitleEntry?.[0]);
  return (
    <article className={`rounded-xl border border-[#DADCE0] bg-white ${compact ? "p-3" : "p-4 sm:p-5"}`}>
      {(titleEntry || subtitleEntry) && <div className="mb-3 border-b border-[#E8EAED] pb-3">
        <h4 className="font-semibold text-[#202124]">{titleEntry ? String(titleEntry[1]) : `Entry ${index + 1}`}</h4>
        {subtitleEntry && <p className="mt-1 text-sm text-[#5F6368]">{String(subtitleEntry[1])}</p>}
      </div>}
      {details.length > 0 ? <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {details.map(([key, item]) => <div key={key} className="min-w-0">
          <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#5F6368]">{readableLabel(key)}</dt>
          <dd><ValueSummary value={item} /></dd>
        </div>)}
      </dl> : !titleEntry && !subtitleEntry ? <p className="text-sm text-[#5F6368]">No details available.</p> : null}
    </article>
  );
}

function StructuredPreview({ value }) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return <p className="rounded-lg bg-[#FEF7E0] px-3 py-2 text-sm text-[#8D5B00]">The JSON has an edit in progress. Fix its format to preview these details.</p>;
    }
  }
  if (Array.isArray(value)) {
    if (!value.length) return <p className="text-sm text-[#5F6368]">No details added yet.</p>;
    if (value.every((item) => typeof item !== "object" || item === null)) return <ValueSummary value={value} />;
    return <div className="space-y-3">{value.map((item, index) => <RecordCard key={index} value={item} index={index} />)}</div>;
  }
  if (typeof value === "object" && value !== null) return <RecordCard value={value} index={0} />;
  return <p className="whitespace-pre-wrap text-sm leading-6 text-[#202124]">{String(value ?? "No details added yet.")}</p>;
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
    <div className="space-y-6">
      <div><p className="text-sm font-medium text-[#5F6368]">Your details, your control</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202124] sm:text-3xl">My Profile</h1><p className="mt-2 text-sm text-[#5F6368]">Manage the candidate information used to match and prepare applications.</p></div>
      <StatusMessage message={error || msg} error={!!error} />

      <section className="rounded-2xl border border-[#DADCE0] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F0FE] text-[#0B57D0]"><FileUp className="h-5 w-5" /></div><div><h2 className="font-semibold text-[#202124]">Resume and documents</h2><p className="mt-1 text-sm text-[#5F6368]">Upload your resume, certificates, or marksheets (PDF, DOCX, or images).</p></div></div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-[#DADCE0] px-4 py-2.5 text-sm font-semibold text-[#0B57D0] hover:bg-[#E8F0FE]">
            <FileUp className="h-4 w-4" />Choose documents<input type="file" multiple onChange={onUpload} disabled={!!busy} className="sr-only" />
          </label>
          <button onClick={build} disabled={!!busy} className="w-fit rounded-full bg-[#0B57D0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0842A0] disabled:opacity-50">Build candidate profile</button>
          {busy && <span className="text-sm text-[#0B57D0]">{busy}</span>}
        </div>
      </section>

      {form && <section className="space-y-5 rounded-2xl border border-[#DADCE0] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><h2 className="font-semibold text-[#202124]">Review candidate profile</h2><p className="mt-1 text-sm text-[#5F6368]">Confirm extracted details before ApplyPilot uses them in applications.</p></div>
          <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${prof?.confirmed ? "bg-[#E6F4EA] text-[#137333]" : "bg-[#FEF7E0] text-[#8D5B00]"}`}><CheckCircle2 className="h-4 w-4" />{prof?.confirmed ? "Profile confirmed" : "Confirmation needed"}</span>
        </div>
        {needs.length > 0 && <p className="rounded-xl bg-[#FEF7E0] px-4 py-3 text-sm text-[#8D5B00]">Please review fields that could not be confidently extracted: <b>{needs.join(", ")}</b>.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([key, label]) => <label key={key} className={`text-sm font-medium text-[#444746] ${key === "skillsText" ? "sm:col-span-2" : ""}`}><span className="mb-1.5 block">{label}</span><input value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={`w-full rounded-xl border px-3.5 py-2.5 text-[#202124] outline-none focus:border-[#0B57D0] ${flagged(key) ? "border-[#F9AB00] bg-[#FEF7E0]" : "border-[#DADCE0]"}`} /></label>)}
        </div>
        {otherEntries.length > 0 && <section className="space-y-4 border-t border-[#E8EAED] pt-5">
          <div><h3 className="font-semibold text-[#202124]">Education, projects, and additional details</h3><p className="mt-1 text-sm text-[#5F6368]">Review each section below. Education and projects are shown as readable entries instead of raw JSON.</p></div>
          <div className="space-y-4">
            {otherEntries.map(([key, value]) => {
              const originalValue = prof?.data?.[key];
              const structured = typeof originalValue === "object" && originalValue !== null;
              const text = structured && typeof value !== "string" ? JSON.stringify(value, null, 2) : value ?? "";
              const isEditing = !!editingDetails[key];
              return <article key={key} className="rounded-2xl border border-[#DADCE0] bg-[#F8F9FA] p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div><h4 className="font-semibold capitalize text-[#202124]">{readableLabel(key)}</h4><p className="mt-0.5 text-xs text-[#5F6368]">{Array.isArray(value) ? `${value.length} ${value.length === 1 ? "entry" : "entries"}` : "Profile details"}</p></div>
                  {structured && <button type="button" onClick={() => setEditingDetails({ ...editingDetails, [key]: !isEditing })} className="rounded-full border border-[#DADCE0] bg-white px-3.5 py-2 text-xs font-semibold text-[#0B57D0] hover:bg-[#E8F0FE]">{isEditing ? "Preview details" : "Edit details"}</button>}
                </div>
                {structured && !isEditing ? <StructuredPreview value={value} /> : structured ? <div>
                  <textarea aria-label={`Edit ${readableLabel(key)} as JSON`} rows={Math.min(12, Math.max(5, String(text).split("\n").length))} value={text} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="w-full rounded-xl border border-[#DADCE0] bg-white px-3.5 py-3 font-mono text-xs leading-5 text-[#202124] outline-none focus:border-[#0B57D0]" />
                  <p className="mt-2 text-xs text-[#5F6368]">Edit the structured data as JSON. Your changes are included when you save the profile.</p>
                </div> : <input aria-label={`Edit ${readableLabel(key)}`} value={text} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="w-full rounded-xl border border-[#DADCE0] bg-white px-3.5 py-2.5 text-sm text-[#202124] outline-none focus:border-[#0B57D0]" />}
              </article>;
            })}
          </div>
        </section>}
        <button onClick={save} disabled={!!busy} className="rounded-full bg-[#0B57D0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0842A0] disabled:opacity-50">Save and confirm profile</button>
      </section>}
    </div>
  );
}
