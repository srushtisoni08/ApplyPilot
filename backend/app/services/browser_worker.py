import json
import os
import sys
from pathlib import Path

from app.config import settings

if settings.PLAYWRIGHT_BROWSERS_PATH:
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = settings.PLAYWRIGHT_BROWSERS_PATH

from playwright.sync_api import sync_playwright  # noqa: E402

COLLECT_JS = """() => {
  const out = []; let i = 0;
  document.querySelectorAll('input, select, textarea').forEach(el => {
    const type = (el.type || el.tagName).toLowerCase();
    if (['hidden','submit','button','reset','image'].includes(type)) return;
    let label = '';
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) label = l.innerText; }
    if (!label) { const p = el.closest('label'); if (p) label = p.innerText; }
    label = (label || el.getAttribute('aria-label') || el.placeholder || el.name || '').trim();
    const key = 'f' + (i++);
    el.setAttribute('data-ap', key);
    out.push({ key, label, type, tag: el.tagName.toLowerCase(), required: el.required,
      options: el.tagName === 'SELECT' ? [...el.options].map(o => o.text.trim()).filter(Boolean) : [] });
  });
  return out;
}"""

BLOCK_JS = """() => {
  if (document.querySelector('iframe[src*="recaptcha"], .g-recaptcha, iframe[src*="hcaptcha"], .h-captcha, [data-sitekey]')) return 'captcha';
  if (document.querySelector('input[type=password]')) return 'login';
  return '';
}"""


def main(inp: str, outp: str) -> None:
    job = json.loads(Path(inp).read_text(encoding="utf-8"))
    res: dict = {}
    try:
        with sync_playwright() as p:
            watch = bool(job.get("watch"))
            browser = p.chromium.launch(headless=not watch, slow_mo=400 if watch else 0)
            page = browser.new_page(viewport={"width": 1100, "height": 900})
            page.goto(job["url"], wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(500)
            fields = page.evaluate(COLLECT_JS)  # tags elements with data-ap keys

            if job["mode"] == "read":
                res = {"fields": fields, "blocked": page.evaluate(BLOCK_JS)}
            else:
                for item in job["plan"]:
                    loc = page.locator(f'[data-ap="{item["key"]}"]')
                    if item["kind"] == "file":
                        loc.set_input_files(item["value"])
                    elif item["kind"] == "select":
                        loc.select_option(label=item["value"])
                    else:
                        loc.fill(item["value"])
                if job.get("shot"):
                    page.screenshot(path=job["shot"], full_page=True)
                if job["mode"] == "submit":
                    page.locator("button[type=submit], input[type=submit]").first.click()
                    page.wait_for_load_state("domcontentloaded")
                    page.wait_for_timeout(800)
                    res["text"] = page.inner_text("body")[:2000]
                    res["url"] = page.url
                    if job.get("shot_after"):
                        page.screenshot(path=job["shot_after"], full_page=True)
                res["ok"] = True
            browser.close()
    except Exception as exc:
        res = {"error": f"{type(exc).__name__}: {exc}"[:400]}
    Path(outp).write_text(json.dumps(res), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])