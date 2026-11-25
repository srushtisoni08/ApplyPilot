const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, opts);
  if (!r.ok) {
    let m = r.statusText;
    try {
      const j = await r.json();
      m = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(m);
  }
  return r.json();
}

const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  base: BASE,
  profile: (id) => req(`/profile/${id}`),
  buildProfile: (id) => req(`/profile/build/${id}`, { method: "POST" }),
  saveProfile: (id, body) => req(`/profile/${id}`, json("PUT", body)),
  upload: (id, file) => {
    const f = new FormData();
    f.append("user_id", id);
    f.append("file", file);
    return req("/documents/upload", { method: "POST", body: f });
  },
  scanEmails: (id) => req(`/emails/process/${id}`, { method: "POST" }),
  runMatching: (id, force = false) =>
    req(`/matches/run/${id}?force=${force}`, { method: "POST" }),
  matches: (id) => req(`/matches/${id}`),
};