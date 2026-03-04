/**
 * 对接本地后端：/api 由 Vite 代理到 localhost:8000
 */
import type { Course, Chapter, PPT, NoteBlock, QA } from "./mock-data";

const BASE = import.meta.env.VITE_API_URL ?? "/api";
const FETCH_TIMEOUT_MS = 10000; // 10 秒
const AI_REQUEST_TIMEOUT_MS = 30000; // QA 接口（豆包）30 秒

async function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    if ((e as Error).name === "AbortError") throw new Error("请求超时，请检查后端是否已启动");
    throw e;
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function post<T>(path: string, body?: unknown, timeoutMs = FETCH_TIMEOUT_MS): Promise<T> {
  const res = await fetchWithTimeout(
    `${BASE}${path}`,
    {
      method: "POST",
      headers: body != null ? { "Content-Type": "application/json" } : {},
      body: body != null ? JSON.stringify(body) : undefined,
    },
    timeoutMs
  );
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetchWithTimeout(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

// 后端直接返回数组，无 { data: [] } 包装
export async function fetchCourses(q?: string): Promise<Course[]> {
  const path = q?.trim() ? `/courses?q=${encodeURIComponent(q.trim())}` : "/courses";
  return get<Course[]>(path);
}

export async function fetchCourse(courseId: string): Promise<Course & { chapters: Chapter[] }> {
  const course = await get<Course>(`/courses/${courseId}`);
  const chapters = await get<Chapter[]>(`/courses/${courseId}/chapters`);
  return { ...course, chapters };
}

export async function createCourse(courseName: string): Promise<Course> {
  return post<Course>("/courses", { courseName });
}

export async function updateCourse(courseId: string, body: { courseName?: string; emoji?: string }): Promise<Course> {
  return patch<Course>(`/courses/${courseId}`, body);
}

export async function deleteCourse(courseId: string): Promise<void> {
  return del(`/courses/${courseId}`);
}

export async function fetchChapters(courseId: string): Promise<Chapter[]> {
  return get<Chapter[]>(`/courses/${courseId}/chapters`);
}

export async function fetchChapterPpts(chapterId: string): Promise<PPT[]> {
  return get<PPT[]>(`/chapters/${chapterId}/ppts`);
}

export async function createChapter(courseId: string, body: { chapterName: string; orderIndex?: number }): Promise<Chapter> {
  return post<Chapter>(`/courses/${courseId}/chapters`, body);
}

export async function updateChapter(chapterId: string, body: { chapterName?: string; orderIndex?: number }): Promise<Chapter> {
  return patch<Chapter>(`/chapters/${chapterId}`, body);
}

export async function deleteChapter(chapterId: string): Promise<void> {
  return del(`/chapters/${chapterId}`);
}

export async function fetchPpts(chapterId: string): Promise<PPT[]> {
  return get<PPT[]>(`/chapters/${chapterId}/ppts`);
}

// 上传 PDF/PPT 文件
export async function uploadPpt(chapterId: string, file: File): Promise<PPT> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/chapters/${chapterId}/ppts`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchPpt(pptId: string): Promise<PPT> {
  return get<PPT>(`/ppts/${pptId}`);
}

export async function fetchPptFull(pptId: string): Promise<PPT & { noteBlocks: NoteBlock[]; qas: QA[] }> {
  const [ppt, noteBlocks, qas] = await Promise.all([
    get<PPT>(`/ppts/${pptId}`),
    get<NoteBlock[]>(`/ppts/${pptId}/note-blocks`),
    get<QA[]>(`/ppts/${pptId}/qa`),
  ]);
  return { ...ppt, noteBlocks, qas };
}

export async function fetchPptSlides(pptId: string): Promise<{ slides: { page_index: number; page_range: string; text: string }[] }> {
  return get(`/ppts/${pptId}/slides`);
}

export async function updatePpt(pptId: string, body: { pptTitle?: string; lastPage?: number; lastOpenAt?: string }): Promise<PPT> {
  return patch<PPT>(`/ppts/${pptId}`, body);
}

export async function deletePpt(pptId: string): Promise<void> {
  return del(`/ppts/${pptId}`);
}

export async function fetchNotes(pptId: string): Promise<NoteBlock[]> {
  return get<NoteBlock[]>(`/ppts/${pptId}/note-blocks`);
}

// 后端按页解析后调用 AI 提炼，无需传 rawText（豆包较慢，用长超时）
export async function extractNotes(pptId: string): Promise<{ taskId: string; status: "queued" }> {
  return post<{ taskId: string; status: "queued" }>(`/ppts/${pptId}/actions/extract-notes`);
}

export async function fetchQas(pptId: string): Promise<QA[]> {
  return get<QA[]>(`/ppts/${pptId}/qa`);
}

// 问答走豆包，用长超时
export async function createQa(
  pptId: string,
  body: { question: string; noteBlockId?: string | null }
): Promise<{ taskId: string; qaId: string; status: "queued" }> {
  return post<{ taskId: string; qaId: string; status: "queued" }>(`/ppts/${pptId}/qa`, body, AI_REQUEST_TIMEOUT_MS);
}

export async function createQaWithImage(
  pptId: string,
  body: { question: string; image: File; noteBlockId?: string | null }
): Promise<{ taskId: string; qaId: string; status: "queued" }> {
  const form = new FormData();
  form.append("question", body.question);
  if (body.noteBlockId) form.append("noteBlockId", body.noteBlockId);
  form.append("image", body.image);
  const res = await fetchWithTimeout(`${BASE}/ppts/${pptId}/qa-with-image`, { method: "POST", body: form }, AI_REQUEST_TIMEOUT_MS);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function pptFileUrl(filename: string): string {
  return `${BASE}/files/${filename}`;
}
