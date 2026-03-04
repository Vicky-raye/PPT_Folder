import { useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, FileText, Clock, ChevronRight, Upload, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  fetchCourse,
  createChapter,
  fetchChapterPpts,
  uploadPpt,
  updateCourse,
  deleteCourse,
  updateChapter,
  deleteChapter,
  updatePpt,
  deletePpt,
} from "@/lib/api";
import type { Chapter, PPT } from "@/lib/mock-data";
import AppHeader from "@/components/AppHeader";
import { toast } from "sonner";

export default function CoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [chapterName, setChapterName] = useState("");
  const [uploadingChapterId, setUploadingChapterId] = useState<string | null>(null);
  const [draggingChapterId, setDraggingChapterId] = useState<string | null>(null);
  const [editingCourseName, setEditingCourseName] = useState(false);
  const [courseNameDraft, setCourseNameDraft] = useState("");
  const [deletingCourse, setDeletingCourse] = useState(false);
  const fileInputRef = useRef<Record<string, HTMLInputElement | null>>({});
  const queryClient = useQueryClient();

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => fetchCourse(courseId!),
    enabled: !!courseId,
  });

  const createMutation = useMutation({
    mutationFn: () => createChapter(courseId!, { chapterName: chapterName.trim(), orderIndex: course?.chapters?.length ?? 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      setChapterName("");
      setOpen(false);
      toast.success("章节已添加");
    },
    onError: (e: Error) => toast.error(e.message || "添加失败"),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ chapterId, file }: { chapterId: string; file: File }) => uploadPpt(chapterId, file),
    onSuccess: (ppt) => {
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      setUploadingChapterId(null);
      toast.success("上传成功");
      navigate(`/workspace/${ppt.pptId}`);
    },
    onError: (e: Error) => {
      setUploadingChapterId(null);
      toast.error(e.message || "上传失败");
    },
  });

  const updateCourseMutation = useMutation({
    mutationFn: (name: string) => updateCourse(courseId!, { courseName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setEditingCourseName(false);
      setCourseNameDraft("");
      toast.success("已保存");
    },
    onError: (e: Error) => toast.error(e.message || "保存失败"),
  });

  const deleteCourseMutation = useMutation({
    mutationFn: () => deleteCourse(courseId!),
    onSuccess: () => {
      setDeletingCourse(false);
      toast.success("课程已删除");
      navigate("/");
    },
    onError: (e: Error) => toast.error(e.message || "删除失败"),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ fromId, toId }: { fromId: string; toId: string }) => {
      const list = [...(course?.chapters ?? [])];
      const fromIdx = list.findIndex((c) => c.chapterId === fromId);
      const toIdx = list.findIndex((c) => c.chapterId === toId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      await Promise.all(
        list.map((c, idx) => updateChapter(c.chapterId, { orderIndex: idx }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      toast.success("章节顺序已更新");
    },
    onError: (e: Error) => toast.error(e.message || "排序保存失败"),
  });

  const handleAddChapter = () => {
    if (!chapterName.trim()) {
      toast.error("请输入章节名称");
      return;
    }
    createMutation.mutate();
  };

  const handleFileChange = (chapterId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "ppt", "pptx"].includes(ext || "")) {
      toast.error("仅支持 PDF、PPT、PPTX");
      return;
    }
    setUploadingChapterId(chapterId);
    uploadMutation.mutate({ chapterId, file });
    e.target.value = "";
  };

  if (!courseId) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex items-center justify-center py-40 text-muted-foreground">
          无效的课程
        </div>
      </div>
    );
  }

  if (isLoading || !course) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex items-center justify-center py-40 text-muted-foreground">
          {isLoading ? "加载中..." : "课程不存在"}
        </div>
      </div>
    );
  }

  const chapters = course.chapters ?? [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            返回课程列表
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-4xl">{course.emoji ?? "📁"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {editingCourseName ? (
                  <>
                    <Input
                      className="text-2xl font-bold h-10 max-w-xs"
                      value={courseNameDraft}
                      onChange={(e) => setCourseNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateCourseMutation.mutate(courseNameDraft.trim());
                        if (e.key === "Escape") setEditingCourseName(false);
                      }}
                      autoFocus
                    />
                    <Button size="sm" onClick={() => updateCourseMutation.mutate(courseNameDraft.trim())} disabled={!courseNameDraft.trim() || updateCourseMutation.isPending}>
                      {updateCourseMutation.isPending ? "保存中..." : "保存"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingCourseName(false)}>取消</Button>
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      {course.courseName}
                    </h1>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => { setCourseNameDraft(course.courseName); setEditingCourseName(true); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> 修改课程
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingCourse(true)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> 删除课程
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {chapters.length} 个章节 · 创建于 {course.createdAt}
              </p>
            </div>
          </div>
        </div>

        <AlertDialog open={deletingCourse} onOpenChange={setDeletingCourse}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除课程</AlertDialogTitle>
              <AlertDialogDescription>
                确定删除「{course.courseName}」？其下所有章节与文档将一并删除，且无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteCourseMutation.mutate()}>
                {deleteCourseMutation.isPending ? "删除中..." : "删除"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">章节列表</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                添加章节
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加章节</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="章节名称（如 CH1 计算机网络概述）"
                  value={chapterName}
                  onChange={(e) => setChapterName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddChapter()}
                />
                <Button
                  onClick={handleAddChapter}
                  disabled={createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending ? "添加中..." : "添加"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {chapters.length > 0 ? (
          <div className="space-y-3">
            {chapters.map((ch, idx) => (
              <ChapterRow
                key={ch.chapterId}
                chapter={ch}
                index={idx}
                courseId={courseId}
                onUploadClick={() => fileInputRef.current[ch.chapterId]?.click()}
                onFileChange={(e) => handleFileChange(ch.chapterId, e)}
                setFileInputRef={(el) => { fileInputRef.current[ch.chapterId] = el; }}
                uploading={uploadingChapterId === ch.chapterId}
                onInvalidate={() => queryClient.invalidateQueries({ queryKey: ["course", courseId] })}
                draggable
                isDragging={draggingChapterId === ch.chapterId}
                onDragStart={() => setDraggingChapterId(ch.chapterId)}
                onDragEnd={() => setDraggingChapterId(null)}
                onDropChapter={(targetId) => {
                  if (draggingChapterId && draggingChapterId !== targetId) {
                    reorderMutation.mutate({ fromId: draggingChapterId, toId: targetId });
                  }
                  setDraggingChapterId(null);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-surface-sunken py-16">
            <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground font-medium">暂无章节</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              点击"添加章节"上传你的第一份 PDF/PPT
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function ChapterRow({
  chapter,
  index,
  courseId,
  onUploadClick,
  onFileChange,
  setFileInputRef,
  uploading,
  onInvalidate,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropChapter,
}: {
  chapter: Chapter;
  index: number;
  courseId: string;
  onUploadClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setFileInputRef: (el: HTMLInputElement | null) => void;
  uploading: boolean;
  onInvalidate: () => void;
  draggable: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropChapter: (targetId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [editingChapter, setEditingChapter] = useState(false);
  const [chapterNameDraft, setChapterNameDraft] = useState("");
  const [deletingChapter, setDeletingChapter] = useState(false);
  const [editingPpt, setEditingPpt] = useState<PPT | null>(null);
  const [pptTitleDraft, setPptTitleDraft] = useState("");
  const [deletingPpt, setDeletingPpt] = useState<PPT | null>(null);

  const { data: ppts = [] } = useQuery({
    queryKey: ["chapterPpts", chapter.chapterId],
    queryFn: () => fetchChapterPpts(chapter.chapterId),
    enabled: !!chapter.chapterId,
  });

  const updateChapterMutation = useMutation({
    mutationFn: (name: string) => updateChapter(chapter.chapterId, { chapterName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      queryClient.invalidateQueries({ queryKey: ["chapterPpts", chapter.chapterId] });
      setEditingChapter(false);
      setChapterNameDraft("");
      onInvalidate();
      toast.success("已保存");
    },
    onError: (e: Error) => toast.error(e.message || "保存失败"),
  });

  const deleteChapterMutation = useMutation({
    mutationFn: () => deleteChapter(chapter.chapterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      setDeletingChapter(false);
      onInvalidate();
      toast.success("章节已删除");
    },
    onError: (e: Error) => toast.error(e.message || "删除失败"),
  });

  const updatePptMutation = useMutation({
    mutationFn: ({ pptId, pptTitle }: { pptId: string; pptTitle: string }) => updatePpt(pptId, { pptTitle }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapterPpts", chapter.chapterId] });
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      setEditingPpt(null);
      setPptTitleDraft("");
      onInvalidate();
      toast.success("已保存");
    },
    onError: (e: Error) => toast.error(e.message || "保存失败"),
  });

  const deletePptMutation = useMutation({
    mutationFn: (pptId: string) => deletePpt(pptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapterPpts", chapter.chapterId] });
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      setDeletingPpt(null);
      onInvalidate();
      toast.success("文档已删除");
    },
    onError: (e: Error) => toast.error(e.message || "删除失败"),
  });

  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden ${isDragging ? "opacity-60" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropChapter(chapter.chapterId);
      }}
    >
      <div className="flex items-center gap-4 p-4 hover:border-accent/30 transition-colors">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-subtle font-semibold text-accent text-sm">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          {editingChapter ? (
            <div className="flex items-center gap-2">
              <Input
                className="font-medium max-w-xs"
                value={chapterNameDraft}
                onChange={(e) => setChapterNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") updateChapterMutation.mutate(chapterNameDraft.trim()); if (e.key === "Escape") setEditingChapter(false); }}
                autoFocus
              />
              <Button size="sm" onClick={() => updateChapterMutation.mutate(chapterNameDraft.trim())} disabled={!chapterNameDraft.trim() || updateChapterMutation.isPending}>保存</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingChapter(false)}>取消</Button>
            </div>
          ) : (
            <h3 className="font-medium text-card-foreground">
              {chapter.chapterName}
            </h3>
          )}
          <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {ppts.length} 份文档
            </span>
          </div>
        </div>
        {!editingChapter && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setChapterNameDraft(chapter.chapterName); setEditingChapter(true); }}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> 修改章节
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingChapter(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> 删除章节
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <input
          ref={setFileInputRef}
          type="file"
          accept=".pdf,.ppt,.pptx"
          className="hidden"
          onChange={onFileChange}
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={onUploadClick}
          disabled={uploading}
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "上传中..." : "上传 PDF/PPT"}
        </Button>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
      </div>
      {ppts.length > 0 && (
        <div className="border-t px-4 py-2 bg-surface-sunken/50 flex flex-wrap items-center gap-2">
          {ppts.map((p) => (
            <span key={p.pptId} className="inline-flex items-center gap-1">
              <Link to={`/workspace/${p.pptId}`} className="text-sm text-accent hover:underline">
                {p.pptTitle}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={(e) => { e.preventDefault(); setEditingPpt(p); setPptTitleDraft(p.pptTitle); }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2" /> 修改标题
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => { e.preventDefault(); setDeletingPpt(p); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> 删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          ))}
        </div>
      )}

      <Dialog open={!!editingPpt} onOpenChange={(open) => !open && setEditingPpt(null)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>修改文档标题</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="文档标题"
              value={pptTitleDraft}
              onChange={(e) => setPptTitleDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && editingPpt && pptTitleDraft.trim() && updatePptMutation.mutate({ pptId: editingPpt.pptId, pptTitle: pptTitleDraft.trim() })}
            />
            <Button
              onClick={() => editingPpt && pptTitleDraft.trim() && updatePptMutation.mutate({ pptId: editingPpt.pptId, pptTitle: pptTitleDraft.trim() })}
              disabled={!pptTitleDraft.trim() || updatePptMutation.isPending}
              className="w-full"
            >
              {updatePptMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingChapter} onOpenChange={(open) => !open && setDeletingChapter(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除章节</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{chapter.chapterName}」？其下所有文档将一并删除，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteChapterMutation.mutate()}>
              {deleteChapterMutation.isPending ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingPpt} onOpenChange={(open) => !open && setDeletingPpt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除文档</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{deletingPpt?.pptTitle}」？其知识点与问答记录将一并删除，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deletingPpt && deletePptMutation.mutate(deletingPpt.pptId)}>
              {deletePptMutation.isPending ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
