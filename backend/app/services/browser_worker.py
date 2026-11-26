
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from app.config import settings

if settings.PLAYWRIGHT_BROWSERS_PATH:
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = (
        settings.PLAYWRIGHT_BROWSERS_PATH
    )

from playwright.sync_api import sync_playwright  # noqa: E402


COLLECT_JS = """() => {
  const out = [];
  let i = 0;

  document.querySelectorAll('input, select, textarea').forEach(el => {
    const type = (el.type || el.tagName).toLowerCase();

    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) {
      return;
    }

    let label = '';

    if (el.id) {
      const l = document.querySelector(
        'label[for="' + CSS.escape(el.id) + '"]'
      );
      if (l) label = l.innerText;
    }

    if (!label) {
      const p = el.closest('label');
      if (p) label = p.innerText;
    }

    label = (
      label ||
      el.getAttribute('aria-label') ||
      el.placeholder ||
      el.name ||
      ''
    ).trim();

    const key = 'f' + (i++);

    el.setAttribute('data-ap', key);

    out.push({
      key,
      label,
      type,
      tag: el.tagName.toLowerCase(),
      required: el.required,
      options: el.tagName === 'SELECT'
        ? [...el.options].map(o => o.text.trim()).filter(Boolean)
        : []
    });
  });

  return out;
}"""


BLOCK_JS = """() => {
  if (
    document.querySelector(
      'iframe[src*="recaptcha"], .g-recaptcha, ' +
      'iframe[src*="hcaptcha"], .h-captcha, [data-sitekey]'
    )
  ) {
    return 'captcha';
  }

  if (document.querySelector('input[type=password]')) {
    return 'login';
  }

  return '';
}"""


def validate_url(raw_url):
    """
    Accept only valid HTTP/HTTPS website URLs.
    Reject email addresses and other invalid values.
    """

    if not raw_url:
        return None, "Application URL is missing."

    raw_url = str(raw_url).strip()

    if not raw_url:
        return None, "Application URL is empty."

    # Reject email addresses.
    if "@" in raw_url and "://" not in raw_url:
        return None, (
            f"'{raw_url}' appears to be an email address, "
            "not a website URL. Use the application website URL "
            "or handle this application through email."
        )

    # Require an explicit HTTP or HTTPS scheme.
    parsed = urlparse(raw_url)

    if parsed.scheme.lower() not in ("http", "https"):
        return None, (
            "Invalid application URL. Only HTTP and HTTPS "
            "website URLs are supported."
        )

    if not parsed.netloc or "." not in parsed.netloc:
        return None, "Invalid website URL. Please provide a valid domain."

    if parsed.username or parsed.password:
        return None, "URLs containing embedded credentials are not allowed."

    try:
        # Accessing port also validates malformed port values.
        _ = parsed.port
    except ValueError:
        return None, "Invalid port in application URL."

    return raw_url, None


def main(inp: str, outp: str) -> None:

    res = {}

    try:
        job = json.loads(
            Path(inp).read_text(encoding="utf-8")
        )

        # Validate mode before starting the browser.
        mode = job.get("mode")

        if mode not in ("read", "fill", "submit"):
            raise ValueError(
                "Invalid mode. Supported modes: read, fill, submit."
            )

        # Validate URL before calling page.goto().
        url, url_error = validate_url(job.get("url"))

        if url_error:
            res = {
                "ok": False,
                "error": url_error,
                "application_method": (
                    "email" if "@" in str(job.get("url", "")) else "unknown"
                )
            }

            Path(outp).write_text(
                json.dumps(res),
                encoding="utf-8"
            )
            return

        with sync_playwright() as p:

            browser = None

            try:
                watch = bool(job.get("watch"))

                browser = p.chromium.launch(
                    headless=not watch,
                    slow_mo=400 if watch else 0
                )

                page = browser.new_page(
                    viewport={
                        "width": 1100,
                        "height": 900
                    }
                )

                # Navigate only after URL validation.
                page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=30000
                )

                page.wait_for_timeout(500)

                fields = page.evaluate(COLLECT_JS)

                blocked = page.evaluate(BLOCK_JS)

                if mode == "read":

                    res = {
                        "ok": True,
                        "fields": fields,
                        "blocked": blocked,
                        "url": page.url
                    }

                else:

                    # Stop automatic filling when CAPTCHA/login is detected.
                    if blocked:
                        res = {
                            "ok": False,
                            "error": (
                                f"Application page is blocked by {blocked}. "
                                "Manual intervention is required."
                            ),
                            "blocked": blocked,
                            "url": page.url
                        }

                    else:

                        plan = job.get("plan", [])

                        for item in plan:

                            key = item.get("key")
                            kind = item.get("kind")
                            value = item.get("value")

                            if not key:
                                raise ValueError(
                                    "A field in the fill plan is missing its key."
                                )

                            loc = page.locator(
                                f'[data-ap="{key}"]'
                            )

                            if loc.count() == 0:
                                raise ValueError(
                                    f"Form field '{key}' was not found."
                                )

                            if kind == "file":

                                loc.set_input_files(value)

                            elif kind == "select":

                                loc.select_option(label=value)

                            else:

                                loc.fill(str(value or ""))

                        if job.get("shot"):
                            page.screenshot(
                                path=job["shot"],
                                full_page=True
                            )

                        res = {
                            "ok": True,
                            "url": page.url,
                            "filled_fields": len(plan)
                        }

                        if mode == "submit":

                            # Do not submit without an explicit request.
                            submit_button = page.locator(
                                "button[type=submit], input[type=submit]"
                            ).first

                            if submit_button.count() == 0:
                                raise ValueError(
                                    "Submit button was not found."
                                )

                            submit_button.click()

                            page.wait_for_load_state(
                                "domcontentloaded",
                                timeout=15000
                            )

                            page.wait_for_timeout(800)

                            res["text"] = page.inner_text("body")[:2000]
                            res["url"] = page.url

                            if job.get("shot_after"):
                                page.screenshot(
                                    path=job["shot_after"],
                                    full_page=True
                                )

                            res["submitted"] = True

            finally:

                if browser:
                    browser.close()

    except Exception as exc:

        res = {
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}"[:400]
        }

    Path(outp).write_text(
        json.dumps(res),
        encoding="utf-8"
    )


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
