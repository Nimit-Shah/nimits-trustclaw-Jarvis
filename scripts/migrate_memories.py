"""
One-off migration script: reads existing pgvector memories from Postgres
and feeds them into the Mnemosyne sidecar via HTTP. Run once after setup.

Usage:
    python3 scripts/migrate_memories.py
"""

import os
import sys
import json
import urllib.request
import urllib.error

try:
    import psycopg2
except ImportError:
    print("psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL env var not set.")
    sys.exit(1)

MNEMOSYNE_URL = os.environ.get("MNEMOSYNE_URL", "http://127.0.0.1:3999")


def remember(text: str) -> None:
    payload = json.dumps(
        {"text": text, "importance": 0.7, "source": "migrated_from_pgvector"}
    ).encode()
    req = urllib.request.Request(
        f"{MNEMOSYNE_URL}/remember",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=10)


conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute(
    'SELECT content, "createdAt" FROM composio_claw_memory ORDER BY "createdAt" ASC'
)
rows = cur.fetchall()
print(f"Migrating {len(rows)} memories from pgvector → Mnemosyne...")
ok, fail = 0, 0
for content, _ in rows:
    try:
        remember(content)
        ok += 1
    except Exception as e:
        print(f"  FAILED: {e}")
        fail += 1

print(f"Done. OK={ok}, FAILED={fail}")
conn.close()
