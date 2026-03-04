import { useState } from "react";
import NoteContent from "@/components/NoteContent";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Send,
  Sparkles,
  FileText,
  MessageCircle,
  Lightbulb,
  Copy,
  Check,
  ImagePlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  fetchPptFull,
  fetchPptSlides,
  extractNotes,
  createQa,
  createQaWithImage,
  pptFileUrl,
} from "@/lib/api";
import { PdfViewer } from "@/components/PdfViewer";
import type { NoteBlock, QA } from "@/lib/mock-data";
import AppHeader from "@/components/AppHeader";
import { toast } from "sonner";

function normTerms(terms: string[] | string): string[] {
  if (Array.isArray(terms)) return terms;
  if (typeof terms === "string" && terms.trim()) return terms.split(/\s*,\s*/).filter(Boolean);
  return [];
}

export default function WorkspacePage() {
  const { pptId } = useParams();
  const [question, setQuestion] = useState("");
  const [qaImage, setQaImage] = useState<File | null>(null);
  const [notesCopied, setNotesCopied] = useState(false);
  const queryClient = useQueryClient();

  const { data: ppt, isLoading: pptLoading } = useQuery({
    queryKey: ["pptFull", pptId],
    queryFn: () => fetchPptFull(pptId!),
    enabled: !!pptId,
    refetchInterval: 4000,
  });

  const { data: slidesData, isError: slidesError } = useQuery({
    queryKey: ["pptSlides", pptId],
    queryFn: () => fetchPptSlides(pptId!),
    enabled: !!pptId,
  });

  const createQaMutation = useMutation({
    mutationFn: ({ q, image }: { q: string; image: File | null }) =>
      image
        ? createQaWithImage(pptId!, { question: q, image })
        : createQa(pptId!, { question: q }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pptFull", pptId] });
      setQuestion("");
      setQaImage(null);
      toast.success("问题已提交，后台生成中");
    },
    onError: (e: Error) => toast.error(e.message || "发送失败"),
  });

  const extractMutation = useMutation({
    mutationFn: () => extractNotes(pptId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pptFull", pptId] });
      toast.success("提炼任务已提交，后台处理中");
    },
    onError: (e: Error) => toast.error(e.message || "提炼失败"),
  });

  const noteBlocks: NoteBlock[] = Array.isArray(ppt?.noteBlocks) ? ppt!.noteBlocks : [];
  const qas: QA[] = Array.isArray(ppt?.qas) ? ppt!.qas : [];
  const slides = Array.isArray(slidesData?.slides) ? slidesData!.slides : [];
  const totalPages = Math.max(slides.length, 1);
  const slidesFailed = slidesError || (ppt && slides.length === 0 && !isPdf);
  const courseId = ppt?.courseId ?? ppt?.chapterId ?? "";
  const isPdf = ppt?.fileType === "pdf";
  const fileUrl = ppt?.sourceFile ? pptFileUrl(ppt.sourceFile) : null;

  const handleSend = () => {
    const q = question.trim();
    if (!q) return;
    createQaMutation.mutate({ q, image: qaImage });
  };

  const handlePasteImage = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    const blob = imageItem.getAsFile();
    if (!blob) return;
    const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
    const file = new File([blob], `pasted-image.${ext}`, { type: blob.type || "image/png" });
    setQaImage(file);
    toast.success("已粘贴图片，可直接提问");
    e.preventDefault();
  };

  const handleCopyNotes = async () => {
    if (noteBlocks.length === 0) {
      toast.error("暂无可复制的知识点");
      return;
    }
    const text = noteBlocks
      .map((n, i) => `[知识块 ${i + 1} | 页 ${n.pageRange ?? "—"}]\n${n.contentZh ?? ""}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotesCopied(true);
      toast.success("已复制知识点");
      window.setTimeout(() => setNotesCopied(false), 1500);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  if (!pptId) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">无效的文档</div>
      </div>
    );
  }

  if (pptLoading || !ppt) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader />

      <div className="flex items-center justify-between border-b px-4 py-2 bg-card">
        <div className="flex items-center gap-3">
          <Link
            to={`/course/${courseId}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-medium text-foreground">
            {ppt.pptTitle}
          </span>
        </div>
        <div />
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={65} minSize={35} className="min-w-0">
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={28} minSize={12} className="min-w-0">
              <div className="flex h-full flex-col">
                <div className="flex h-9 items-center justify-between border-b px-3 bg-surface-sunken">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="font-medium">文档浏览</span>
                  </div>
                  <span className="text-xs text-muted-foreground">共 {totalPages} 页</span>
                </div>
                {isPdf && fileUrl ? (
                  <div className="flex flex-col flex-1 min-h-0 w-full min-w-0 px-2">
                    <PdfViewer url={fileUrl} className="flex-1 min-h-0 w-full" />
                  </div>
                ) : (
                <ScrollArea className="flex-1 scrollbar-thin">
                  {slides.length > 0 ? (
                    <div className="space-y-4 p-4 w-full min-w-0">
                      {slides.map((s, i) => (
                        <div
                          key={i}
                          className="w-full min-w-0 rounded-lg border bg-card shadow-sm overflow-hidden"
                        >
                          <div className="flex flex-col p-4 min-w-0">
                            <p className="text-muted-foreground text-sm mb-2">第 {(s as { page_index?: number })?.page_index ?? i + 1} 页</p>
                            <pre className="text-left text-sm text-foreground/90 whitespace-pre-wrap break-words max-w-full overflow-auto min-w-0">
                              {(s as { text?: string })?.text ?? "(无文本)"}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 space-y-2 p-6">
                      <p className="text-sm text-muted-foreground">
                        {slidesFailed ? "解析失败或暂无内容" : "暂无解析内容"}
                      </p>
                      {ppt?.sourceFile && (
                        <a
                          href={pptFileUrl(ppt.sourceFile)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-accent hover:underline"
                        >
                          在新窗口打开文档
                        </a>
                      )}
                    </div>
                  )}
                </ScrollArea>
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={72} minSize={20}>
              <div className="flex h-full flex-col">
                <div className="flex h-9 items-center gap-1.5 border-b px-3 bg-surface-sunken">
                  <Lightbulb className="h-3.5 w-3.5 text-accent" />
                  <span className="text-xs font-medium text-foreground">知识点提炼</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      size="sm"
                      className="h-6 gap-1 px-2 text-[11px]"
                      onClick={() => extractMutation.mutate()}
                      disabled={extractMutation.isPending}
                    >
                      <Sparkles className="h-3 w-3" />
                      {extractMutation.isPending ? "提炼中..." : "提炼"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 px-2 text-[11px]"
                      onClick={handleCopyNotes}
                      disabled={noteBlocks.length === 0}
                    >
                      {notesCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {notesCopied ? "已复制" : "复制"}
                    </Button>
                  </div>
                </div>
                {extractMutation.isPending && (
                  <p className="px-4 pt-2 text-[10px] text-muted-foreground">文档较大时可能需要 1-3 分钟，请耐心等待</p>
                )}
                <ScrollArea className="flex-1 scrollbar-thin">
                  <div className="space-y-4 p-4">
                    {noteBlocks.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">暂无知识点，点击上方「提炼」由 AI 生成。</p>
                    ) : (
                      noteBlocks.map((note) => (
                        <div
                          key={note.noteBlockId}
                          className="rounded-lg border bg-card p-4 transition-all hover:shadow-sm"
                        >
                          <NoteContent content={note.contentZh ?? ""} />
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {normTerms(note.contentEnKeyTerms).map((term) => (
                              <span
                                key={term}
                                className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground"
                              >
                                {term}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={35} minSize={20}>
          <div className="flex h-full flex-col bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <MessageCircle className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">问答区</span>
              <span className="ml-auto text-xs text-muted-foreground">{qas.length} 条记录</span>
            </div>
            <ScrollArea className="flex-1 scrollbar-thin">
              <div className="space-y-4 p-4">
                {qas.map((qa) => (
                  <div key={qa.qaId} className="space-y-2 w-full min-w-0">
                    <div className="flex w-full justify-end">
                      <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                        {qa.question}
                        {qa.questionImage && (
                          <img
                            src={pptFileUrl(qa.questionImage)}
                            alt="question"
                            className="mt-2 max-h-40 rounded-md border border-primary-foreground/30 object-contain bg-background/10"
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex w-full justify-start min-w-0">
                      <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-foreground leading-relaxed">
                        {qa.status && qa.status !== "completed" ? (
                          <p className="text-muted-foreground text-xs">回答生成中，请稍候...</p>
                        ) : (
                          <NoteContent content={qa.answer} />
                        )}
                      </div>
                    </div>
                    {qa.noteBlockId && (
                      <div className="flex justify-start pl-1">
                        <span className="text-[10px] text-muted-foreground/60">
                          关联知识点：页 {noteBlocks.find((n) => n.noteBlockId === qa.noteBlockId)?.pageRange ?? "—"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="border-t p-3">
              {createQaMutation.isError && createQaMutation.error && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-destructive">
                  <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-destructive/15 text-destructive" aria-hidden>!</span>
                  {createQaMutation.error.message}
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  id="qa-image-input"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => setQaImage(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={() => document.getElementById("qa-image-input")?.click()}
                  disabled={createQaMutation.isPending}
                  title="上传图片提问"
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <Input
                  placeholder="输入你的问题..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="flex-1 text-sm"
                  onPaste={handlePasteImage}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSend())}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={handleSend}
                  disabled={!question.trim() || createQaMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {qaImage && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-md border bg-muted px-2 py-1 text-xs">
                  <span className="max-w-[220px] truncate">{qaImage.name}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setQaImage(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <p className="mt-1.5 text-[10px] text-muted-foreground/60 px-1">
                自动关联当前文档与知识点上下文
              </p>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
