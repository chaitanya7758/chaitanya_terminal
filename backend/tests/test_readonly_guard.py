"""Fails the build if order-execution capability is added to the application source."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FORBIDDEN = re.compile(r"place_order|modify_order|cancel_order|exit_order|/orders/(regular|amo|co|iceberg|auction)|place_gtt|/gtt/triggers|kiteconnect", re.I)
SKIP = {"node_modules", ".venv", ".next", ".git", "tests", "__tests__"}


def test_no_order_execution_in_source():
    hits = []
    for p in ROOT.rglob("*"):
        if p.is_dir() or any(part in SKIP for part in p.parts) or p.suffix not in {".py", ".ts", ".tsx", ".js"}:
            continue
        for i, line in enumerate(p.read_text(errors="ignore").splitlines(), 1):
            if FORBIDDEN.search(line):
                hits.append(f"{p.relative_to(ROOT)}:{i}: {line.strip()}")
    assert not hits, "Order execution code found:\n" + "\n".join(hits)
