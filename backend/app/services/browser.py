import json
import subprocess
import sys
import tempfile
from pathlib import Path

from app.config import BACKEND_DIR


def run_worker(job: dict, timeout: int = 120) -> dict:
    with tempfile.TemporaryDirectory() as d:
        inp, outp = Path(d) / "in.json", Path(d) / "out.json"
        inp.write_text(json.dumps(job), encoding="utf-8")
        proc = subprocess.run(
            [sys.executable, "-m", "app.services.browser_worker", str(inp), str(outp)],
            cwd=BACKEND_DIR, capture_output=True, text=True, timeout=timeout,
        )
        if not outp.exists():
            raise RuntimeError((proc.stderr or "browser worker failed")[-400:])
        res = json.loads(outp.read_text(encoding="utf-8"))
    if res.get("error"):
        raise RuntimeError(res["error"])
    return res