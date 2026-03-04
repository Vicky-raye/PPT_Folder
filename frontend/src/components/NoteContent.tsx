import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface NoteContentProps {
  content?: string | null;
}

function renderInlineKatex(text: string): string {
  // Replace inline $...$ (but not $$...$$)
  return text.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { throwOnError: false, displayMode: false });
    } catch {
      return `<code>${expr}</code>`;
    }
  });
}

export default function NoteContent({ content }: NoteContentProps) {
  const html = useMemo(() => {
    const text = content ?? "";
    const lines = text.split("\n");
    const parts: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Block formula $$...$$
      if (line.trim().startsWith("$$")) {
        let formula = "";
        if (line.trim().endsWith("$$") && line.trim().length > 2) {
          formula = line.trim().slice(2, -2);
        } else {
          i++;
          const formulaLines: string[] = [];
          while (i < lines.length && !lines[i].trim().startsWith("$$")) {
            formulaLines.push(lines[i]);
            i++;
          }
          formula = formulaLines.join("\n");
        }
        try {
          parts.push(`<div class="my-3 overflow-x-auto text-center">${katex.renderToString(formula.trim(), { throwOnError: false, displayMode: true })}</div>`);
        } catch {
          parts.push(`<pre class="my-2 text-sm">${formula}</pre>`);
        }
        i++;
        continue;
      }

      // Heading
      if (line.startsWith("## ")) {
        parts.push(`<h3 class="text-base font-semibold text-[hsl(var(--foreground))] mt-3 mb-2">${renderInlineKatex(line.slice(3))}</h3>`);
      } else if (line.startsWith("**") && line.endsWith("**")) {
        parts.push(`<p class="font-semibold mt-2">${line.replace(/\*\*/g, "")}</p>`);
      } else if (line.match(/^\s*- /)) {
        const indent = line.startsWith("  ") ? "pl-6" : "pl-3";
        parts.push(`<p class="${indent} text-[hsl(var(--muted-foreground))]">• ${renderInlineKatex(line.replace(/^\s*- /, ""))}</p>`);
      } else if (line.match(/^\d+\. /)) {
        parts.push(`<p class="pl-3 text-[hsl(var(--muted-foreground))]">${renderInlineKatex(line)}</p>`);
      } else if (line.trim() === "") {
        parts.push("<br />");
      } else {
        parts.push(`<p>${renderInlineKatex(line)}</p>`);
      }
      i++;
    }

    return parts.join("");
  }, [content]);

  return (
    <div
      className="prose prose-sm max-w-none break-words text-sm text-card-foreground leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
