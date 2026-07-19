import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Cleans up common raw-LaTeX artifacts models emit and normalises math so
 * KaTeX can render it. Handles malformed fragments the model sometimes emits
 * (stray `$` inside commands, unbalanced `$$`, commands fused to identifiers,
 * loose `\frac` / `\times` in prose).
 */
function preprocess(input: string): string {
  if (!input) return "";
  let s = input;

  // 1. Normalise LaTeX bracket delimiters to $...$ / $$...$$
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_m, body) => `\n$$${body}$$\n`);
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_m, body) => `$${body}$`);

  // 2. Fix stray "$" wedged into a command name, e.g. "$\frac${a}{b}" -> "$\frac{a}{b}$"
  //    Pattern: $\cmd$ immediately followed by "{" -> drop the middle "$".
  s = s.replace(/\$(\\[a-zA-Z]+)\$(?=\s*\{)/g, "$1");
  //    Or "$\cmd$" with no following brace -> just "\cmd" (we'll re-wrap later).
  s = s.replace(/\$(\\[a-zA-Z]+)\$/g, "$1");

  // 3. Balance $$ pairs — drop a lone trailing $$
  const ddCount = (s.match(/\$\$/g) || []).length;
  if (ddCount % 2 === 1) {
    const idx = s.lastIndexOf("$$");
    if (idx >= 0) s = s.slice(0, idx) + s.slice(idx + 2);
  }

  // 4. Split into math / non-math segments so we only auto-wrap prose LaTeX
  type Part = { math: boolean; text: string };
  const parts: Part[] = [];
  let i = 0;
  while (i < s.length) {
    const dd = s.indexOf("$$", i);
    let d = s.indexOf("$", i);
    // skip $$ when looking for single $
    while (d !== -1 && d === dd) d = s.indexOf("$", d + 2);

    let mathStart = -1;
    let opener = "";
    if (dd !== -1 && (d === -1 || dd <= d)) {
      mathStart = dd;
      opener = "$$";
    } else if (d !== -1) {
      mathStart = d;
      opener = "$";
    }

    if (mathStart === -1) {
      parts.push({ math: false, text: s.slice(i) });
      break;
    }
    if (mathStart > i) parts.push({ math: false, text: s.slice(i, mathStart) });
    const end = s.indexOf(opener, mathStart + opener.length);
    if (end === -1) {
      // Unclosed math opener — treat as plain text so we don't blow up KaTeX
      parts.push({ math: false, text: s.slice(mathStart).replace(/\$+/g, "") });
      break;
    }
    parts.push({ math: true, text: s.slice(mathStart, end + opener.length) });
    i = end + opener.length;
  }

  // Insert a space when a known LaTeX command is fused to a following identifier
  // (e.g. "\Delta T" from "\DeltaT", "\times d" from "\timesd"). Uses an explicit
  // command list so greedy matching can't split "\frac{" into "\fra c{".
  const KNOWN_CMDS =
    "frac|tfrac|dfrac|sqrt|sum|int|prod|lim|log|ln|sin|cos|tan|cdot|times|div|pm|mp|approx|neq|leq|geq|infty|rightarrow|leftarrow|to|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega";
  const spaceFuse = new RegExp(`\\\\(${KNOWN_CMDS})(?=[a-zA-Z])`, "g");

  const wrappable =
    /([A-Za-z0-9_]*\\[a-zA-Z]+(?:\{[^{}]*\})*(?:[A-Za-z0-9_^=+\-*/.]|\\[a-zA-Z]+(?:\{[^{}]*\})*)*)/g;

  const separated = parts
    .map((p) => {
      if (p.math) return p.text.replace(spaceFuse, "\\$1 ");
      return p.text.replace(wrappable, (m) => {
        if (!/\\[a-zA-Z]+/.test(m)) return m;
        return `$${m.replace(spaceFuse, "\\$1 ")}$`;
      });
    })
    .join("");

  // 6. Strip any \text{} that survives outside math delimiters
  let out = separated.replace(/\\text\s*\{([^{}]*)\}/g, (_m, t) => t);

  // 7. Collapse excess blank lines
  out = out.replace(/\n{3,}/g, "\n\n");

  return out;
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
