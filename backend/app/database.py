import sqlite3
from contextlib import contextmanager
from pathlib import Path

from app.config import DB_PATH

def init_db():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with _conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS course (
            course_id TEXT PRIMARY KEY,
            course_name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS chapter (
            chapter_id TEXT PRIMARY KEY,
            course_id TEXT NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
            chapter_name TEXT NOT NULL,
            order_index INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS ppt (
            ppt_id TEXT PRIMARY KEY,
            chapter_id TEXT NOT NULL REFERENCES chapter(chapter_id) ON DELETE CASCADE,
            ppt_title TEXT NOT NULL,
            source_file TEXT NOT NULL,
            file_type TEXT NOT NULL,
            last_open_at TEXT,
            last_page INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS note_block (
            note_block_id TEXT PRIMARY KEY,
            ppt_id TEXT NOT NULL REFERENCES ppt(ppt_id) ON DELETE CASCADE,
            page_range TEXT NOT NULL,
            content_zh TEXT,
            content_en_key_terms TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS qa (
            qa_id TEXT PRIMARY KEY,
            ppt_id TEXT NOT NULL REFERENCES ppt(ppt_id) ON DELETE CASCADE,
            note_block_id TEXT REFERENCES note_block(note_block_id) ON DELETE SET NULL,
            question TEXT NOT NULL,
            answer TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_chapter_course ON chapter(course_id);
        CREATE INDEX IF NOT EXISTS idx_ppt_chapter ON ppt(chapter_id);
        CREATE INDEX IF NOT EXISTS idx_note_block_ppt ON note_block(ppt_id);
        CREATE INDEX IF NOT EXISTS idx_qa_ppt ON qa(ppt_id);
        CREATE INDEX IF NOT EXISTS idx_course_created ON course(created_at);
        """)
        # Backward-compatible migration for qa async/image fields.
        qa_cols = [r["name"] for r in c.execute("PRAGMA table_info(qa)").fetchall()]
        if "status" not in qa_cols:
            c.execute("ALTER TABLE qa ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'")
        if "question_image" not in qa_cols:
            c.execute("ALTER TABLE qa ADD COLUMN question_image TEXT")


@contextmanager
def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def execute(query: str, *args):
    with _conn() as c:
        c.execute(query, args)

def fetchone(query: str, *args):
    with _conn() as c:
        r = c.execute(query, args).fetchone()
        return dict(r) if r else None

def fetchall(query: str, *args):
    with _conn() as c:
        return [dict(r) for r in c.execute(query, args).fetchall()]

def lastrowid(cursor_key: str = "course_id"):
    with _conn() as c:
        cur = c.execute("SELECT last_insert_rowid()")
        return cur.fetchone()[0]

def insert(table: str, pk_field: str, data: dict) -> str:
    import uuid
    pk = str(uuid.uuid4())[:8]
    data[pk_field] = pk
    cols = ", ".join(data.keys())
    placeholders = ", ".join("?" for _ in data)
    with _conn() as c:
        c.execute(
            f"INSERT INTO {table} ({cols}) VALUES ({placeholders})",
            list(data.values())
        )
    return pk

def update(table: str, pk_field: str, pk_value: str, data: dict):
    set_clause = ", ".join(f"{k}=?" for k in data.keys())
    with _conn() as c:
        c.execute(
            f"UPDATE {table} SET {set_clause} WHERE {pk_field}=?",
            list(data.values()) + [pk_value]
        )
