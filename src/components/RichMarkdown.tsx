import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Cleans up common raw-LaTeX artifacts models emit while treating valid math
 * blocks as immutable. If a `$...$` / `$$...$$` segment is well-formed, it is
 * passed to KaTeX exactly as generated; repair only happens outside those
 * trusted math blocks.
 */
type MathPart = { math: boolean; text: string };

function isEscaped(source: string, index: number): boolean {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && source[i] === "\\"; i--) slashes++;
  return slashes % 2 === 1;
}

function stripDelimiters(math: string): string {
  if (math.startsWith("$$") && math.endsWith("$$")) return math.slice(2, -2);
  if (math.startsWith("$") && math.endsWith("$")) return math.slice(1, -1);
  return math;
}

function hasBalancedBraces(source: string): boolean {
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    if (isEscaped(source, i)) continue;
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function hasUnescapedDollar(source: string): boolean {
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "$" && !isEscaped(source, i)) return true;
  }
  return false;
}

function readBalancedGroup(source: string, openIndex: number): { group: string; end: number } | null {
  if (source[openIndex] !== "{") return null;
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === "{" && source[i - 1] !== "\\") depth++;
    if (source[i] === "}" && source[i - 1] !== "\\") depth--;
    if (depth === 0) return { group: source.slice(openIndex, i + 1), end: i + 1 };
  }
  return null;
}

function fractionCommandsAreComplete(source: string): boolean {
  const fractionCommand = /\\(?:frac|tfrac|dfrac)\b/g;

  while (true) {
    const match = fractionCommand.exec(source);
    if (!match) return true;

    let next = match.index + match[0].length;
    while (/\s/.test(source[next] ?? "")) next++;

    const numerator = readBalancedGroup(source, next);
    if (!numerator) return false;

    next = numerator.end;
    while (/\s/.test(source[next] ?? "")) next++;

    const denominator = readBalancedGroup(source, next);
    if (!denominator) return false;

    fractionCommand.lastIndex = denominator.end;
  }
}

function isWellFormedMathBody(body: string): boolean {
  return body.trim().length > 0 && hasBalancedBraces(body) && !hasUnescapedDollar(body) && fractionCommandsAreComplete(body);
}

function findFirstClosingDelimiter(source: string, delimiter: "$" | "$$", from: number): number {
  let cursor = from;
  while (cursor < source.length) {
    const next = source.indexOf(delimiter, cursor);
    if (next === -1) return -1;
    if (isEscaped(source, next)) {
      cursor = next + delimiter.length;
      continue;
    }
    if (delimiter === "$" && (source.startsWith("$$", next) || source[next - 1] === "$")) {
      cursor = next + 1;
      continue;
    }
    return next;
  }
  return -1;
}

function splitWellFormedMathParts(source: string): MathPart[] {
  const parts: MathPart[] = [];
  let textStart = 0;
  let cursor = 0;

  while (cursor < source.length) {
    if (source[cursor] !== "$" || isEscaped(source, cursor)) {
      cursor++;
      continue;
    }

    const delimiter: "$" | "$$" = source.startsWith("$$", cursor) ? "$$" : "$";
    const close = findFirstClosingDelimiter(source, delimiter, cursor + delimiter.length);

    if (close === -1) {
      cursor += delimiter.length;
      continue;
    }

    const body = source.slice(cursor + delimiter.length, close);
    const end = close + delimiter.length;

    if (!isWellFormedMathBody(body)) {
      // Keep the whole malformed span in the surrounding text so it can be
      // repaired as one expression instead of preserving a broken fragment.
      cursor = end;
      continue;
    }

    if (cursor > textStart) parts.push({ math: false, text: source.slice(textStart, cursor) });
    parts.push({ math: true, text: source.slice(cursor, end) });
    cursor = end;
    textStart = cursor;
  }

  if (textStart < source.length) parts.push({ math: false, text: source.slice(textStart) });
  return parts;
}

function stripMalformedDollars(source: string): string {
  let out = "";
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "$" && !isEscaped(source, i)) continue;
    out += source[i];
  }
  return out;
}

function normalizeFractionGroup(group: string): string {
  const inner = group.slice(1, -1).trim();
  if (!inner || /\\[a-zA-Z]+/.test(inner) || !/\s/.test(inner)) return group;
  if (!/^[A-Za-z0-9.,%()\-/\s]+$/.test(inner)) return group;
  return `{\\text{${inner}}}`;
}

function normalizeFractionSyntax(source: string): string {
  let out = "";
  let cursor = 0;
  const fractionCommand = /\\(?:frac|tfrac|dfrac)/g;

  while (true) {
    fractionCommand.lastIndex = cursor;
    const match = fractionCommand.exec(source);
    if (!match) {
      out += source.slice(cursor);
      break;
    }

    const commandStart = match.index;
    const command = match[0];
    let next = commandStart + command.length;
    while (/\s/.test(source[next] ?? "")) next++;

    const numerator = readBalancedGroup(source, next);
    if (!numerator) {
      out += source.slice(cursor, next);
      cursor = next;
      continue;
    }

    next = numerator.end;
    while (/\s/.test(source[next] ?? "")) next++;

    const denominator = readBalancedGroup(source, next);
    if (!denominator) {
      out += source.slice(cursor, next);
      cursor = next;
      continue;
    }

    out += source.slice(cursor, commandStart);
    out += `${command}${normalizeFractionGroup(numerator.group)}${normalizeFractionGroup(denominator.group)}`;
    cursor = denominator.end;
  }

  return out;
}

function wrapLooseFractions(source: string): string {
  let out = "";
  let cursor = 0;
  const fractionCommand = /\\(?:frac|tfrac|dfrac)/g;

  while (true) {
    fractionCommand.lastIndex = cursor;
    const match = fractionCommand.exec(source);
    if (!match) {
      out += source.slice(cursor);
      break;
    }

    const commandStart = match.index;
    const command = match[0];
    let next = commandStart + command.length;
    while (/\s/.test(source[next] ?? "")) next++;

    const numerator = readBalancedGroup(source, next);
    if (!numerator) {
      out += source.slice(cursor, next);
      cursor = next;
      continue;
    }

    next = numerator.end;
    while (/\s/.test(source[next] ?? "")) next++;

    const denominator = readBalancedGroup(source, next);
    if (!denominator) {
      out += source.slice(cursor, next);
      cursor = next;
      continue;
    }

    out += source.slice(cursor, commandStart);
    out += `$${command}${normalizeFractionGroup(numerator.group)}${normalizeFractionGroup(denominator.group)}$`;
    cursor = denominator.end;
  }

  return out;
}

const LOOSE_SYMBOL_COMMANDS =
  "alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|rho|sigma|tau|phi|omega|Delta|Theta|Lambda|Pi|Sigma|Phi|Omega";
const LATEX_COMMAND = /\\[a-zA-Z]+/;

function normalizeFormulaBody(source: string): string {
  let formula = normalizeFractionSyntax(source)
    .replace(/\\(times|cdot|div|pm|mp|Delta|delta|lambda|mu)(?=[A-Za-z])/g, "\\$1 ")
    .replace(/\s+/g, " ")
    .trim();

  const equalsIndex = formula.indexOf("=");
  if (equalsIndex > 0) {
    const lhs = formula.slice(0, equalsIndex).trim();
    const rhs = formula.slice(equalsIndex + 1).trim();
    if (/^[A-Za-z][A-Za-z\s]+$/.test(lhs) && /\s/.test(lhs)) {
      formula = `\\text{${lhs}} = ${rhs}`;
    }
  }

  return formula;
}

function splitTrailingPunctuation(source: string): { body: string; trailing: string } {
  const match = source.match(/([,;.!?])$/);
  if (!match) return { body: source, trailing: "" };
  return { body: source.slice(0, -1), trailing: match[1] };
}

function processMathLineWithoutTable(line: string): string {
  const cleaned = stripMalformedDollars(line).replace(/\\text\s*\{([^{}]*)\}/g, (_m, text) => text);
  const equalsIndex = cleaned.indexOf("=");

  if (equalsIndex !== -1 && (LATEX_COMMAND.test(cleaned) || /[_^]/.test(cleaned))) {
    const bullet = cleaned.match(/^(\s*(?:[-*+]|\d+\.)\s+)/);
    const leading = bullet?.[0] ?? "";
    const bodyStart = leading.length;
    const colonBeforeEquals = cleaned.lastIndexOf(":", equalsIndex);
    const formulaStart = colonBeforeEquals >= bodyStart ? colonBeforeEquals + 1 : bodyStart;
    const prefix = cleaned.slice(0, formulaStart) + (cleaned[formulaStart] === " " ? " " : "");
    const formulaCandidate = cleaned.slice(formulaStart).trim();
    const { body, trailing } = splitTrailingPunctuation(formulaCandidate);

    if (body) return `${prefix}$${normalizeFormulaBody(body)}$${trailing}`;
  }

  return wrapLooseFractions(cleaned).replace(
    new RegExp(`\\\\(${LOOSE_SYMBOL_COMMANDS})\\b`, "g"),
    (_match, command: string) => `$\\${command}$`,
  );
}

function processMathLine(line: string): string {
  if (!line.includes("|")) return processMathLineWithoutTable(line);
  return line
    .split(/(\|)/)
    .map((cell) => (cell === "|" ? cell : processMathLineWithoutTable(cell)))
    .join("");
}

function processNonMathText(source: string): string {
  return source
    .split(/(\n+)/)
    .map((part) => (/^\n+$/.test(part) ? part : processMathLine(part)))
    .join("");
}

function lineLooksLikeSplitFormula(parts: MathPart[]): boolean {
  const plain = parts.map((part) => (part.math ? stripDelimiters(part.text) : part.text)).join("");
  if (!plain.includes("=") || !LATEX_COMMAND.test(plain)) return false;
  return !parts.some((part) => part.math && stripDelimiters(part.text).includes("="));
}

function renderLineParts(parts: MathPart[]): string {
  if (!parts.length) return "";
  if (lineLooksLikeSplitFormula(parts)) {
    return processNonMathText(parts.map((part) => (part.math ? stripDelimiters(part.text) : part.text)).join(""));
  }
  return parts.map((part) => (part.math ? part.text : processNonMathText(part.text))).join("");
}

function renderMathParts(parts: MathPart[]): string {
  let out = "";
  let lineParts: MathPart[] = [];

  const flush = () => {
    out += renderLineParts(lineParts);
    lineParts = [];
  };

  for (const part of parts) {
    if (part.math) {
      lineParts.push(part);
      continue;
    }

    for (const piece of part.text.split(/(\n+)/)) {
      if (!piece) continue;
      if (/^\n+$/.test(piece)) {
        flush();
        out += piece;
      } else {
        lineParts.push({ math: false, text: piece });
      }
    }
  }

  flush();
  return out;
}

export function preprocessRichMarkdown(input: string): string {
  if (!input) return "";
  let s = input;

  // 1. Normalise LaTeX bracket delimiters to $...$ / $$...$$
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_m, body) => `\n$$${body}$$\n`);
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_m, body) => `$${body}$`);

  // 2. Preserve valid math exactly; repair only the text around invalid or
  //    split fragments such as "$\frac${...}", "F $\times$ d", or extra "$$".
  const separated = renderMathParts(splitWellFormedMathParts(s));

  // 3. Collapse excess blank lines
  let out = separated;
  out = out.replace(/\n{3,}/g, "\n\n");

  return out;
}

export function RichMarkdown({ children, className }: { children: string; className?: string }) {
  const source = useMemo(() => preprocessRichMarkdown(children ?? ""), [children]);
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
