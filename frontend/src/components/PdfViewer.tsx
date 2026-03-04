/**
 * 使用 PDF.js 渲染 PDF，所有页垂直堆叠，上下滑动翻页。
 * 支持缩放（80%/100%/120%），每页按文档区宽度自适应，并尊重 PDF 页面旋转（解决倒页）。
 */
import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
if (workerUrl) pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOM_OPTIONS = [80, 100, 120] as const;

type PdfViewerProps = {
  url: string;
  className?: string;
};

export function PdfViewer({ url, className = "" }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentMeasureRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{
    status: "idle" | "loading" | "ready" | "error";
    numPages: number;
    zoomPercent: number;
    contentWidth: number;
    error?: string;
  }>({
    status: "idle",
    numPages: 0,
    zoomPercent: 100,
    contentWidth: 0,
  });
  const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    const el = contentMeasureRef.current || containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = contentMeasureRef.current?.clientWidth ?? containerRef.current?.clientWidth ?? 0;
      setState((s) => ({ ...s, contentWidth: Math.max(100, w) }));
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state.status]);

  useEffect(() => {
    if (!url) return;
    setState((s) => ({ ...s, status: "loading", error: undefined }));
    const loadingTask = pdfjsLib.getDocument({ url });
    loadingTask.promise
      .then((pdf) => {
        docRef.current = pdf;
        setState((s) => ({ ...s, status: "ready", numPages: pdf.numPages }));
      })
      .catch((e: Error) => {
        setState((s) => ({ ...s, status: "error", error: e.message || "加载 PDF 失败" }));
      });
    return () => {
      loadingTask.destroy?.();
      docRef.current = null;
    };
  }, [url]);

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className={`flex min-h-[360px] items-center justify-center rounded-lg border bg-muted ${className}`}>
        <p className="text-sm text-muted-foreground">加载 PDF 中…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={`flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 ${className}`}>
        <p className="text-sm text-destructive">{state.error}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
          在新窗口打开 PDF
        </a>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full min-w-0 ${className}`}>
      <div className="flex h-7 flex-wrap items-center justify-between gap-1 sticky top-0 z-10 bg-card px-2 border-b rounded-t-lg shrink-0">
        <span className="text-[11px] text-muted-foreground">共 {state.numPages} 页 · 上下滑动查看</span>
        <div className="flex items-center gap-1">
          {ZOOM_OPTIONS.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => setState((s) => ({ ...s, zoomPercent: pct }))}
              className={`h-5 rounded border px-1.5 text-[10px] leading-none ${state.zoomPercent === pct ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
            >
              {pct}%
            </button>
          ))}
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline">
          在新窗口打开 PDF
        </a>
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 w-full overflow-auto rounded-b-lg border border-t-0 bg-muted"
      >
        <div className="w-full min-w-0 flex flex-col items-center gap-4 py-4">
          <div ref={contentMeasureRef} className="w-full min-w-0" style={{ height: 0, overflow: "hidden" }} aria-hidden />
          {Array.from({ length: state.numPages }, (_, i) => i + 1).map((pageNum) => (
            <PdfPageCanvas
              key={pageNum}
              docRef={docRef}
              pageNum={pageNum}
              contentWidth={state.contentWidth}
              zoomPercent={state.zoomPercent}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PdfPageCanvas({
  docRef,
  pageNum,
  contentWidth,
  zoomPercent,
}: {
  docRef: React.RefObject<pdfjsLib.PDFDocumentProxy | null>;
  pageNum: number;
  contentWidth: number;
  zoomPercent: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!docRef.current || contentWidth <= 0) return;
    const pdf = docRef.current;
    pdf.getPage(pageNum).then((page) => {
      const rotation = page.rotate ?? 0;
      const baseViewport = page.getViewport({ scale: 1, rotation });
      const fitScale = contentWidth / baseViewport.width;
      const scale = fitScale * (zoomPercent / 100);
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale, rotation });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const displayW = Math.floor(viewport.width);
      const displayH = Math.floor(viewport.height);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;
      canvas.style.minWidth = `${displayW}px`;
      canvas.style.maxWidth = `${displayW}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;
      page.render({
        canvasContext: ctx,
        viewport,
        transform,
        intent: "display",
      });
    });
  }, [docRef, pageNum, contentWidth, zoomPercent]);

  if (contentWidth <= 0) return <div className="w-full h-48 bg-muted/50 rounded animate-pulse" />;

  return (
    <div className="w-full min-w-0 flex justify-center" style={{ maxWidth: contentWidth }}>
      <canvas ref={canvasRef} className="shadow-sm rounded border bg-white block shrink-0" />
    </div>
  );
}
