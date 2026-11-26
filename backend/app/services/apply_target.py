"""Works out HOW to apply, from the apply_link text the LLM extracted from a job email.

method "web"   -> open the form with the browser (Playwright)
method "email" -> prepare an email with the resume attached and send it after approval
method "none"  -> nothing usable: tell the user to apply manually
"""
import re
from urllib.parse import unquote, urlparse

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}")
URL_RE = re.compile(r"https?://[^\s<>\"']+", re.I)
BARE_DOMAIN_RE = re.compile(r"^(?:www\.)?[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+(?:[/?#]\S*)?$")


def _web_ok(url: str) -> bool:
    p = urlparse(url)
    host = (p.hostname or "").lower()
    if p.scheme.lower() not in ("http", "https") or not host:
        return False
    if p.username or p.password:  # no credentials hidden inside links
        return False
    try:
        p.port  # malformed ports raise ValueError
    except ValueError:
        return False
    return "." in host or host == "localhost"  # localhost = the dummy demo form


def _result(method: str, target: str | None = None, reason: str | None = None) -> dict:
    return {"method": method, "target": target, "reason": reason}


def _email(addr: str) -> dict:
    addr = addr.strip()
    if EMAIL_RE.fullmatch(addr):
        return _result("email", addr)
    return _result("none", None, f"'{addr[:60]}' is not a valid email address.")


def classify_apply_target(raw) -> dict:
    text = str(raw).strip() if raw else ""
    if not text:
        return _result("none", None, "This opportunity has no apply link or email address.")

    if text.lower().startswith("mailto:"):
        return _email(unquote(text[7:].split("?")[0]))

    m = URL_RE.search(text)  # a website link wins if the text has both a link and an address
    if m:
        url = m.group(0).rstrip(".,;:)")
        if _web_ok(url):
            return _result("web", url)
        return _result("none", None, "The apply link is not a valid public website address.")

    m = EMAIL_RE.search(text)
    if m:
        return _email(m.group(0))

    if "@" not in text and BARE_DOMAIN_RE.match(text) and _web_ok("https://" + text):
        return _result("web", "https://" + text)

    return _result("none", None, "Could not find a website link or an email address in the apply link.")