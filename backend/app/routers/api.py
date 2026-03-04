import uuid
import threading
import time
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import UPLOADS_DIR, UPLOAD_MAX_MB, DB_PATH
from app import database as db
from app.services.parse import extract_pages
from app.services.ark import extract_notes as ark_extract_notes, qa_answer

router = APIRouter(prefix="/api", tags=["api"])

_extract_tasks = {}
_extract_tasks_lock = threading.Lock()
_qa_tasks = {}
_qa_tasks_lock = threading.Lock()


def _set_extract_task(task_id: str, **updates):
    with _extract_tasks_lock:
        if task_id not in _extract_tasks:
            return
        _extract_tasks[task_id].update(updates)


def _set_qa_task(task_id: str, **updates):
    with _qa_tasks_lock:
        if task_id not in _qa_tasks:
            return
        _qa_tasks[task_id].update(updates)


def _run_extract_notes_task(task_id: str, ppt_id: str):
    _set_extract_task(task_id, status="running", startedAt=time.time())
    try:
        ppt = db.fetchone("SELECT ppt_id, source_file, file_type FROM ppt WHERE ppt_id=?", ppt_id)
        if not ppt:
            raise RuntimeError("PPT not found")
        path = Path(ppt["source_file"])
        if not path.is_absolute():
            path = UPLOADS_DIR / path.name
        if not path.exists():
            path = UPLOADS_DIR / Path(ppt["source_file"]).name
        if not path.exists():
            raise RuntimeError("Source file not found")
        try:
            pages = extract_pages(path, ppt["file_type"])
        except Exception as e:
            raise RuntimeError(f"Parse failed: {e}") from e

        if not pages:
            _set_extract_task(task_id, status="completed", noteBlocks=[], finishedAt=time.time())
            return

        try:
            raw = ark_extract_notes(pages)
        except Exception as e:
            raise RuntimeError(f"AI call failed: {e}") from e

        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)

        db.execute("DELETE FROM note_block WHERE ppt_id=?", ppt_id)
        created = []
        if text:
            nb_id = db.insert("note_block", "note_block_id", {
                "ppt_id": ppt_id,
                "page_range": "all",
                "content_zh": text,
                "content_en_key_terms": "",
            })
            created = [{"noteBlockId": nb_id, "pptId": ppt_id, "pageRange": "all", "contentZh": text, "contentEnKeyTerms": ""}]

        _set_extract_task(task_id, status="completed", noteBlocks=created, finishedAt=time.time())
    except Exception as e:
        _set_extract_task(task_id, status="failed", error=str(e), finishedAt=time.time())


def _run_qa_task(task_id: str, qa_id: str, ppt_id: str, question: str, note_block_id: Optional[str], question_image: Optional[str]):
    _set_qa_task(task_id, status="running", startedAt=time.time())
    try:
        ppt = db.fetchone("SELECT ppt_title FROM ppt WHERE ppt_id=?", ppt_id)
        if not ppt:
            raise RuntimeError("PPT not found")
        note_blocks = db.fetchall(
            "SELECT page_range, content_zh, content_en_key_terms FROM note_block WHERE ppt_id=?",
            ppt_id
        )
        note_blocks_text = "\n".join(
            f"[{b['page_range']}] {b['content_zh'] or ''} ({b['content_en_key_terms'] or ''})" for b in note_blocks
        ) if note_blocks else "(暂无知识点)"
        qa_history = db.fetchall(
            "SELECT question, answer FROM qa WHERE ppt_id=? AND qa_id<>? AND status='completed' ORDER BY created_at LIMIT 10",
            ppt_id, qa_id
        )
        note_block_context = None
        if note_block_id:
            nb = db.fetchone("SELECT content_zh, content_en_key_terms FROM note_block WHERE note_block_id=?", note_block_id)
            if nb:
                note_block_context = f"{nb.get('content_zh') or ''} | {nb.get('content_en_key_terms') or ''}"
        image_path = None
        if question_image:
            image_path = str(UPLOADS_DIR / question_image)
        answer = qa_answer(
            ppt["ppt_title"],
            note_blocks_text,
            qa_history,
            question,
            note_block_context,
            image_path=image_path,
        )
        db.update("qa", "qa_id", qa_id, {"answer": answer or "", "status": "completed"})
        _set_qa_task(task_id, status="completed", qaId=qa_id, finishedAt=time.time())
    except Exception as e:
        db.update("qa", "qa_id", qa_id, {"answer": f"生成失败：{e}", "status": "failed"})
        _set_qa_task(task_id, status="failed", qaId=qa_id, error=str(e), finishedAt=time.time())

# ---------- courses ----------
class CourseCreate(BaseModel):
    courseName: str

@router.get("/courses")
def list_courses(q: Optional[str] = None):
    if q:
        rows = db.fetchall(
            """SELECT c.course_id as courseId, c.course_name as courseName, c.created_at as createdAt,
               (SELECT COUNT(*) FROM chapter WHERE course_id = c.course_id) as chapterCount
               FROM course c WHERE c.course_name LIKE ? ORDER BY c.created_at DESC""",
            f"%{q}%"
        )
    else:
        rows = db.fetchall(
            """SELECT c.course_id as courseId, c.course_name as courseName, c.created_at as createdAt,
               (SELECT COUNT(*) FROM chapter WHERE course_id = c.course_id) as chapterCount
               FROM course c ORDER BY c.created_at DESC"""
        )
    return rows

@router.post("/courses")
def create_course(body: CourseCreate):
    pk = db.insert("course", "course_id", {
        "course_name": body.courseName,
    })
    return {"courseId": pk, "courseName": body.courseName}

@router.get("/courses/{course_id}")
def get_course(course_id: str):
    row = db.fetchone(
        "SELECT course_id as courseId, course_name as courseName, created_at as createdAt FROM course WHERE course_id=?",
        course_id
    )
    if not row:
        raise HTTPException(404, "Course not found")
    return row


class CoursePatch(BaseModel):
    courseName: Optional[str] = None


@router.patch("/courses/{course_id}")
def patch_course(course_id: str, body: CoursePatch):
    row = db.fetchone("SELECT course_id FROM course WHERE course_id=?", course_id)
    if not row:
        raise HTTPException(404, "Course not found")
    if body.courseName is None:
        return db.fetchone(
            "SELECT course_id as courseId, course_name as courseName, created_at as createdAt FROM course WHERE course_id=?",
            course_id
        )
    db.update("course", "course_id", course_id, {"course_name": body.courseName})
    return db.fetchone(
        "SELECT course_id as courseId, course_name as courseName, created_at as createdAt FROM course WHERE course_id=?",
        course_id
    )


@router.delete("/courses/{course_id}")
def delete_course(course_id: str):
    row = db.fetchone("SELECT course_id FROM course WHERE course_id=?", course_id)
    if not row:
        raise HTTPException(404, "Course not found")
    db.execute("DELETE FROM course WHERE course_id=?", course_id)
    return {"message": "ok"}

# ---------- chapters ----------
class ChapterCreate(BaseModel):
    chapterName: str
    orderIndex: int = 0

@router.get("/courses/{course_id}/chapters")
def list_chapters(course_id: str):
    rows = db.fetchall(
        "SELECT chapter_id as chapterId, course_id as courseId, chapter_name as chapterName, order_index as orderIndex, created_at as createdAt FROM chapter WHERE course_id=? ORDER BY order_index, created_at",
        course_id
    )
    return rows

@router.get("/chapters/{chapter_id}/ppts")
def list_chapter_ppts(chapter_id: str):
    rows = db.fetchall(
        "SELECT ppt_id as pptId, chapter_id as chapterId, ppt_title as pptTitle, source_file as sourceFile, file_type as fileType, last_open_at as lastOpenAt, last_page as lastPage, created_at as createdAt FROM ppt WHERE chapter_id=? ORDER BY created_at DESC",
        chapter_id
    )
    for r in rows:
        r["sourceFile"] = Path(r["sourceFile"]).name
    return rows

@router.post("/courses/{course_id}/chapters")
def create_chapter(course_id: str, body: ChapterCreate):
    pk = db.insert("chapter", "chapter_id", {
        "course_id": course_id,
        "chapter_name": body.chapterName,
        "order_index": body.orderIndex,
    })
    return {"chapterId": pk, "courseId": course_id, "chapterName": body.chapterName, "orderIndex": body.orderIndex}


class ChapterPatch(BaseModel):
    chapterName: Optional[str] = None
    orderIndex: Optional[int] = None


@router.patch("/chapters/{chapter_id}")
def patch_chapter(chapter_id: str, body: ChapterPatch):
    row = db.fetchone("SELECT chapter_id FROM chapter WHERE chapter_id=?", chapter_id)
    if not row:
        raise HTTPException(404, "Chapter not found")
    data = {}
    if body.chapterName is not None:
        data["chapter_name"] = body.chapterName
    if body.orderIndex is not None:
        data["order_index"] = body.orderIndex
    if not data:
        return db.fetchone(
            "SELECT chapter_id as chapterId, course_id as courseId, chapter_name as chapterName, order_index as orderIndex, created_at as createdAt FROM chapter WHERE chapter_id=?",
            chapter_id
        )
    db.update("chapter", "chapter_id", chapter_id, data)
    return db.fetchone(
        "SELECT chapter_id as chapterId, course_id as courseId, chapter_name as chapterName, order_index as orderIndex, created_at as createdAt FROM chapter WHERE chapter_id=?",
        chapter_id
    )


@router.delete("/chapters/{chapter_id}")
def delete_chapter(chapter_id: str):
    row = db.fetchone("SELECT chapter_id FROM chapter WHERE chapter_id=?", chapter_id)
    if not row:
        raise HTTPException(404, "Chapter not found")
    db.execute("DELETE FROM chapter WHERE chapter_id=?", chapter_id)
    return {"message": "ok"}

# ---------- ppts (upload, get, patch) ----------
ALLOWED_EXT = {".pdf", ".ppt", ".pptx"}
MAX_BYTES = UPLOAD_MAX_MB * 1024 * 1024

@router.post("/chapters/{chapter_id}/ppts")
async def upload_ppt(chapter_id: str, file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Unsupported format. Allowed: {list(ALLOWED_EXT)}")
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(400, f"File too large (max {UPLOAD_MAX_MB}MB)")
    file_id = str(uuid.uuid4())[:12]
    save_name = f"{file_id}{ext}"
    save_path = UPLOADS_DIR / save_name
    save_path.write_bytes(content)
    title = (file.filename or save_name).rsplit(".", 1)[0]
    file_type = ext.lstrip(".")
    ppt_id = db.insert("ppt", "ppt_id", {
        "chapter_id": chapter_id,
        "ppt_title": title,
        "source_file": str(save_path),
        "file_type": file_type,
        "last_page": 1,
    })
    return {
        "pptId": ppt_id,
        "chapterId": chapter_id,
        "pptTitle": title,
        "sourceFile": save_name,
        "fileType": file_type,
    }

@router.get("/ppts/{ppt_id}")
def get_ppt(ppt_id: str):
    row = db.fetchone(
        "SELECT p.ppt_id as pptId, p.chapter_id as chapterId, p.ppt_title as pptTitle, p.source_file as sourceFile, p.file_type as fileType, p.last_open_at as lastOpenAt, p.last_page as lastPage, p.created_at as createdAt, c.course_id as courseId FROM ppt p JOIN chapter c ON p.chapter_id = c.chapter_id WHERE p.ppt_id=?",
        ppt_id
    )
    if not row:
        raise HTTPException(404, "PPT not found")
    row["sourceFile"] = Path(row["sourceFile"]).name
    return row

class PptPatch(BaseModel):
    pptTitle: Optional[str] = None
    lastOpenAt: Optional[str] = None
    lastPage: Optional[int] = None


@router.patch("/ppts/{ppt_id}")
def patch_ppt(ppt_id: str, body: PptPatch):
    data = {}
    if body.pptTitle is not None:
        data["ppt_title"] = body.pptTitle
    if body.lastOpenAt is not None:
        data["last_open_at"] = body.lastOpenAt
    if body.lastPage is not None:
        data["last_page"] = body.lastPage
    if not data:
        row = db.fetchone("SELECT ppt_id as pptId, ppt_title as pptTitle, last_open_at as lastOpenAt, last_page as lastPage FROM ppt WHERE ppt_id=?", ppt_id)
        if not row:
            raise HTTPException(404, "PPT not found")
        return row
    row = db.fetchone("SELECT ppt_id FROM ppt WHERE ppt_id=?", ppt_id)
    if not row:
        raise HTTPException(404, "PPT not found")
    db.update("ppt", "ppt_id", ppt_id, data)
    out = db.fetchone(
        "SELECT ppt_id as pptId, chapter_id as chapterId, ppt_title as pptTitle, source_file as sourceFile, file_type as fileType, last_open_at as lastOpenAt, last_page as lastPage, created_at as createdAt FROM ppt WHERE ppt_id=?",
        ppt_id
    )
    if out:
        out["sourceFile"] = Path(out["sourceFile"]).name
    return out


@router.delete("/ppts/{ppt_id}")
def delete_ppt(ppt_id: str):
    row = db.fetchone("SELECT ppt_id FROM ppt WHERE ppt_id=?", ppt_id)
    if not row:
        raise HTTPException(404, "PPT not found")
    db.execute("DELETE FROM ppt WHERE ppt_id=?", ppt_id)
    return {"message": "ok"}

@router.get("/files/{filename}")
def serve_file(filename: str):
    path = UPLOADS_DIR / filename
    if not path.is_file():
        raise HTTPException(404, "File not found")
    return FileResponse(path, filename=filename)

# ---------- slides (parsed pages for display) ----------
@router.get("/ppts/{ppt_id}/slides")
def get_ppt_slides(ppt_id: str):
    row = db.fetchone("SELECT source_file as sourceFile, file_type as fileType FROM ppt WHERE ppt_id=?", ppt_id)
    if not row:
        raise HTTPException(404, "PPT not found")
    raw = row["sourceFile"]
    path = Path(raw)
    if path.is_absolute() and path.exists():
        pass
    else:
        # 使用文件名在 UPLOADS_DIR 中查找
        path = UPLOADS_DIR / path.name
    if not path.exists():
        path = UPLOADS_DIR / raw
    if not path.exists():
        raise HTTPException(404, "Source file not found")
    try:
        pages = extract_pages(path, row["fileType"])
    except Exception as e:
        raise HTTPException(500, str(e))
    return {"slides": pages}

# ---------- note-blocks ----------
@router.get("/ppts/{ppt_id}/note-blocks")
def list_note_blocks(ppt_id: str):
    rows = db.fetchall(
        "SELECT note_block_id as noteBlockId, ppt_id as pptId, page_range as pageRange, content_zh as contentZh, content_en_key_terms as contentEnKeyTerms, created_at as createdAt FROM note_block WHERE ppt_id=? ORDER BY created_at",
        ppt_id
    )
    return rows

@router.post("/ppts/{ppt_id}/actions/extract-notes")
def action_extract_notes(ppt_id: str, background_tasks: BackgroundTasks):
    """提交异步提炼任务，立即返回 taskId。"""
    row = db.fetchone("SELECT ppt_id FROM ppt WHERE ppt_id=?", ppt_id)
    if not row:
        raise HTTPException(404, "PPT not found")
    task_id = str(uuid.uuid4())[:12]
    with _extract_tasks_lock:
        _extract_tasks[task_id] = {
            "taskId": task_id,
            "pptId": ppt_id,
            "status": "queued",
            "noteBlocks": [],
            "error": None,
            "createdAt": time.time(),
        }
    background_tasks.add_task(_run_extract_notes_task, task_id, ppt_id)
    return {"taskId": task_id, "status": "queued"}


@router.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    with _extract_tasks_lock:
        task = _extract_tasks.get(task_id)
        if task:
            return task
    with _qa_tasks_lock:
        task = _qa_tasks.get(task_id)
        if task:
            return task
    raise HTTPException(404, "Task not found")

# ---------- qa ----------
@router.get("/ppts/{ppt_id}/qa")
def list_qa(ppt_id: str, note_block_id: Optional[str] = None):
    if note_block_id:
        rows = db.fetchall(
            "SELECT qa_id as qaId, ppt_id as pptId, note_block_id as noteBlockId, question, question_image as questionImage, answer, status, created_at as createdAt FROM qa WHERE ppt_id=? AND note_block_id=? ORDER BY created_at",
            ppt_id, note_block_id
        )
    else:
        rows = db.fetchall(
            "SELECT qa_id as qaId, ppt_id as pptId, note_block_id as noteBlockId, question, question_image as questionImage, answer, status, created_at as createdAt FROM qa WHERE ppt_id=? ORDER BY created_at",
            ppt_id
        )
    return rows

class QaCreate(BaseModel):
    question: str
    noteBlockId: Optional[str] = None

@router.post("/ppts/{ppt_id}/qa")
def create_qa(ppt_id: str, body: QaCreate, background_tasks: BackgroundTasks):
    row = db.fetchone("SELECT ppt_id FROM ppt WHERE ppt_id=?", ppt_id)
    if not row:
        raise HTTPException(404, "PPT not found")
    qa_id = db.insert("qa", "qa_id", {
        "ppt_id": ppt_id,
        "note_block_id": body.noteBlockId,
        "question": body.question,
        "question_image": None,
        "answer": "（生成中...）",
        "status": "queued",
    })
    task_id = str(uuid.uuid4())[:12]
    with _qa_tasks_lock:
        _qa_tasks[task_id] = {
            "taskId": task_id,
            "type": "qa",
            "qaId": qa_id,
            "pptId": ppt_id,
            "status": "queued",
            "error": None,
            "createdAt": time.time(),
        }
    background_tasks.add_task(_run_qa_task, task_id, qa_id, ppt_id, body.question, body.noteBlockId, None)
    return {"taskId": task_id, "qaId": qa_id, "status": "queued"}


@router.post("/ppts/{ppt_id}/qa-with-image")
async def create_qa_with_image(
    ppt_id: str,
    background_tasks: BackgroundTasks,
    question: str = Form(...),
    noteBlockId: Optional[str] = Form(None),
    image: UploadFile = File(...),
):
    row = db.fetchone("SELECT ppt_id FROM ppt WHERE ppt_id=?", ppt_id)
    if not row:
        raise HTTPException(404, "PPT not found")
    ext = Path(image.filename or "").suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(400, "仅支持 png/jpg/jpeg/webp")
    content = await image.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(400, f"图片过大（max {UPLOAD_MAX_MB}MB）")
    img_name = f"qa_{str(uuid.uuid4())[:12]}{ext}"
    (UPLOADS_DIR / img_name).write_bytes(content)

    qa_id = db.insert("qa", "qa_id", {
        "ppt_id": ppt_id,
        "note_block_id": noteBlockId,
        "question": question,
        "question_image": img_name,
        "answer": "（生成中...）",
        "status": "queued",
    })
    task_id = str(uuid.uuid4())[:12]
    with _qa_tasks_lock:
        _qa_tasks[task_id] = {
            "taskId": task_id,
            "type": "qa",
            "qaId": qa_id,
            "pptId": ppt_id,
            "status": "queued",
            "error": None,
            "createdAt": time.time(),
        }
    background_tasks.add_task(_run_qa_task, task_id, qa_id, ppt_id, question, noteBlockId, img_name)
    return {"taskId": task_id, "qaId": qa_id, "status": "queued"}
