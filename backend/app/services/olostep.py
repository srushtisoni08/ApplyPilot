import re
from urllib.parse import urlparse

import requests
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.config import settings

URL_RE = re.compile(r"https?://[^\s<>\"')\]]+", re.I)
SKIP = re.compile(
    r"unsubscribe|opt-?out|privacy|facebook\.com|twitter\.com|//x\.com|instagram\.com|"
    r"linkedin\.com/company|play\.google|apps\.apple",
    re.I,
)


def find_job_link(text: str) -> str | None:
    """First usable public link in the email text (skips unsubscribe, social, localhost)."""
    for m in URL_RE.finditer(text):
        url = m.group(0).rstrip(".,;:")
        host = (urlparse(url).hostname or "").lower()
        if SKIP.search(url) or host in ("localhost", "127.0.0.1") or "." not in host:
            continue
        return url
    return None


def _transient(exc: BaseException) -> bool:
    if isinstance(exc, requests.HTTPError):
        code = exc.response.status_code if exc.response is not None else 0
        return code == 429 or code >= 500
    return isinstance(exc, (requests.ConnectionError, requests.Timeout))


@retry(retry=retry_if_exception(_transient), stop=stop_after_attempt(3),
       wait=wait_exponential(multiplier=2, min=2, max=10), reraise=True)
def scrape_page(url: str, max_chars: int = 8000) -> str:
    """Clean page text (markdown) via Olostep. Returns '' if no key is configured."""
    if not settings.OLOSTEP_API_KEY:
        return ""
    r = requests.post(
        "https://api.olostep.com/v1/scrapes",
        headers={"Authorization": f"Bearer {settings.OLOSTEP_API_KEY}"},
        json={"url_to_scrape": url, "formats": ["markdown"], "country": "US"},
        timeout=60,
    )
    r.raise_for_status()
    return ((r.json().get("result") or {}).get("markdown_content") or "")[:max_chars]