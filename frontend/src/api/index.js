const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, { ...opts, credentials: "include" });
  if (!r.ok) {
    let m = r.statusText;
    try {
      const j = await r.json();
      m = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
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
  me: () => req("/auth/me"),
  register: (body) => req("/auth/register", json("POST", body)),
  login: (body) => req("/auth/login", json("POST", body)),
  logout: () => req("/auth/logout", { method: "POST" }),
  gmailStatus: () => req("/auth/gmail-status"),
  updateAccount: (body) => req("/auth/me", json("PATCH", body)),
  updatePassword: (body) => req("/auth/password", json("POST", body)),
  profile: (id) => req(`/profile/${id}`),
  buildProfile: (id) => req(`/profile/build/${id}`, { method: "POST" }),
  saveProfile: (id, body) => req(`/profile/${id}`, json("PUT", body)),
  upload: (file) => {
    const f = new FormData();
    f.append("file", file);
    return req("/documents/upload", { method: "POST", body: f });
  },
  scanEmails: (id) => req(`/emails/process/${id}`, { method: "POST" }),
  runMatching: (id, force = false) =>
    req(`/matches/run/${id}?force=${force}`, { method: "POST" }),
  matches: (id) => req(`/matches/${id}`),
  startApplication: (oppId) => req(`/applications/start/${oppId}`, { method: "POST" }),
  approvals: (id) => req(`/approvals/${id}`),
  decide: (approvalId, decision) =>
    req(`/approvals/${approvalId}/decide`, json("POST", { decision })),
  fileUrl: (appId, ext) => `${BASE}/applications/${appId}/file/${ext}`,
  applications: (id) => req(`/applications/list/${id}`),
  deleteApplication: (appId) => req(`/applications/${appId}`, { method: "DELETE" }),
  fill: (appId, watch) => req(`/applications/${appId}/fill?watch=${watch}`, { method: "POST" }),
  screenshotUrl: (appId, kind = "filled") => `${BASE}/applications/${appId}/screenshot?kind=${kind}`,
  markApplied: (appId) => req(`/applications/${appId}/mark-applied`, { method: "POST" }),
};