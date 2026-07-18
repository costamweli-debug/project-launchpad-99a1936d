import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Cleans up common raw-LaTeX artifacts models emit outside math delimiters
 * and normalises math so KaTeX can render it. Falls back to readable plain
 * text when a fragment can't be rendered as math.
 */
function preprocess(input: string): string {
  if (!input) return "";
  let s = input;

  // Normalize \[ ... \] and \( ... \) to $$...$$ and $...$
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_m, body) => `\n$$${body}$$\n`);
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_m, body) => `$${body}$`);

  // If someone wrote e.g. \frac{a}{b} or \sqrt{x} in plain prose (no $),
  // wrap the LaTeX command in inline math so KaTeX renders it.
  // Only wrap when not already inside $...$.
  s = s.replace(
    /(^|[^$\\])(\\(?:frac|sqrt|sum|int|prod|lim|mu|alpha|beta|gamma|delta|theta|pi|sigma|omega|Delta|Sigma|Omega|cdot|times|approx|neq|leq|geq|infty|rightarrow|leftarrow|to)\b(?:\{[^{}]*\}){0,3}(?:\^[^\s$]+)?(?:_[^\s$]+)?)/g,
    (_m, pre, expr) => `${pre}$${expr}$`,
  );

  // Strip \text{...} outside math -> plain text
  // (react-markdown will already pass through inside $..$ so this only touches strays)
  s = s.replace(/\\text\{([^{}]*)\}/g, (_m, t) => t);

  // Collapse >2 blank lines
  s = s.replace(/\n{3,}/g, "\n\n");

  return s;
}

export function RichMarkdown({ children, className }: { children: string; className?: string }) {
  const source = useMemo(() => preprocess(children ?? ""), [children]);
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", output: "html" }]]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

export default RichMarkdown;
