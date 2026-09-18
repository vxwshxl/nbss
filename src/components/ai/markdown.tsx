import type { ReactNode } from "react";

/**
 * A deliberately small markdown renderer for assistant replies.
 *
 * The model is asked for short markdown, and this covers exactly that subset:
 * headings, paragraphs, bullet and numbered lists, quotes, tables, fenced code,
 * and inline bold / italic / code / links. Anything else stays as the literal
 * text the model wrote.
 *
 * It builds React nodes rather than an HTML string, which is the whole safety
 * argument: model output is untrusted — it echoes rows out of the database, and
 * a parent's name could be `<img onerror=…>` — and React escapes every text
 * node it renders. There is no `dangerouslySetInnerHTML` anywhere in this file,
 * so there is no path by which model output becomes markup. Links are the one
 * place a value reaches an attribute, and only an `https?:` target is accepted.
 */

/* -------------------------------------------------------------------------- */
/* Inline                                                                     */
/* -------------------------------------------------------------------------- */

// One pass, alternatives in precedence order. Code is first so that backticked
// text is not then read as bold or as a link; links before emphasis so that a
// URL containing an asterisk survives.
const INLINE =
  /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([\s\S]+?)\*\*|(?<![*\w])\*([^*\n]+)\*(?!\*)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;

  for (const m of text.matchAll(INLINE)) {
    const at = m.index;
    if (at > last) out.push(text.slice(last, at));
    const key = `${keyPrefix}-${n++}`;

    if (m[1] !== undefined) {
      out.push(
        <code
          key={key}
          className="rounded border border-app-line-soft bg-muted px-1.5 py-0.5 font-mono text-[0.86em]"
        >
          {m[1]}
        </code>,
      );
    } else if (m[2] !== undefined) {
      out.push(
        <a
          key={key}
          href={m[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {m[2]}
        </a>,
      );
    } else if (m[4] !== undefined) {
      out.push(
        <strong key={key} className="font-semibold text-foreground">
          {m[4]}
        </strong>,
      );
    } else {
      out.push(
        <em key={key} className="italic">
          {m[5]}
        </em>,
      );
    }
    last = at + m[0].length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

// A pipe row is a table row; the row under the header is the alignment rule and
// carries no content of its own.
const isRow = (l: string) => l.startsWith("|") && l.length > 1;
const isRule = (l: string) => /^\|[\s:|-]+\|?$/.test(l) && l.includes("-");

const cellsOf = (l: string) =>
  l
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

type Block =
  | { k: "p"; lines: string[] }
  | { k: "h"; text: string }
  | { k: "quote"; lines: string[] }
  | { k: "list"; ordered: boolean; items: string[] }
  | { k: "code"; text: string }
  | { k: "table"; head: string[]; body: string[][] }
  | { k: "hr" };

function parse(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let para: string[] = [];
  let quote: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) out.push({ k: "p", lines: para });
    para = [];
  };
  const flushQuote = () => {
    if (quote.length) out.push({ k: "quote", lines: quote });
    quote = [];
  };
  const flushList = () => {
    if (list) out.push({ k: "list", ...list });
    list = null;
  };
  const flushAll = () => {
    flushPara();
    flushQuote();
    flushList();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const line = raw.trim();

    if (!line) {
      flushAll();
      continue;
    }

    // Fenced code. Everything up to the closing fence is taken verbatim, which
    // is the point — a fence is how the model shows an ID or a formula without
    // this parser reading the contents as markup.
    const fence = /^```/.test(line);
    if (fence) {
      flushAll();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test((lines[i] ?? "").trim())) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      out.push({ k: "code", text: body.join("\n") });
      continue;
    }

    // Tables are how the model lays out anything with more than one column —
    // classes and their strength, months and their collection — so they are
    // worth parsing rather than leaving as a row of pipes.
    if (isRow(line) && isRule((lines[i + 1] ?? "").trim())) {
      flushAll();
      const head = cellsOf(line);
      const body: string[][] = [];
      let c = i + 2;
      while (c < lines.length && isRow((lines[c] ?? "").trim())) {
        body.push(cellsOf((lines[c] ?? "").trim()));
        c += 1;
      }
      i = c - 1;
      out.push({ k: "table", head, body });
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(line)) {
      flushAll();
      out.push({ k: "hr" });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      out.push({ k: "h", text: heading[2] ?? "" });
      continue;
    }

    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      flushPara();
      flushList();
      quote.push(quoted[1] ?? "");
      continue;
    }
    flushQuote();

    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1] ?? "");
      continue;
    }

    flushList();
    para.push(line);
  }

  flushAll();
  return out;
}

/* -------------------------------------------------------------------------- */
/* Render                                                                     */
/* -------------------------------------------------------------------------- */

function renderBlock(b: Block, key: string): ReactNode {
  switch (b.k) {
    case "p":
      return (
        <p key={key} className="my-2 first:mt-0 last:mb-0">
          {inline(b.lines.join(" "), key)}
        </p>
      );

    case "h":
      // Headings inside a reply are all one size. The nesting carries no meaning
      // in a chat bubble, and h1-sized text in an answer just shouts.
      return (
        <p key={key} className="mt-4 mb-1.5 font-semibold text-foreground first:mt-0">
          {inline(b.text, key)}
        </p>
      );

    case "quote":
      return (
        <blockquote
          key={key}
          className="my-2 border-l-2 border-app-line py-0.5 pl-3 text-muted-foreground"
        >
          {inline(b.lines.join(" "), key)}
        </blockquote>
      );

    case "list": {
      const Tag = b.ordered ? "ol" : "ul";
      return (
        <Tag
          key={key}
          className={`my-2 space-y-1 pl-5 ${b.ordered ? "list-decimal" : "list-disc"} marker:text-muted-foreground`}
        >
          {b.items.map((item, i) => (
            <li key={i} className="pl-0.5">
              {inline(item, `${key}-${i}`)}
            </li>
          ))}
        </Tag>
      );
    }

    case "code":
      return (
        <pre
          key={key}
          className="my-2.5 overflow-x-auto rounded-xl border border-app-line-soft bg-muted px-3.5 py-3 font-mono text-xs leading-relaxed"
        >
          <code>{b.text}</code>
        </pre>
      );

    case "hr":
      return <hr key={key} className="my-4 border-app-line-soft" />;

    case "table":
      return (
        // The wrapper is what lets a wide table scroll inside the reply instead
        // of stretching the whole thread — the same rule the console's own
        // tables follow.
        <div
          key={key}
          className="my-2.5 overflow-x-auto rounded-xl border border-app-line-soft"
        >
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {b.head.map((cell, i) => (
                  <th
                    key={i}
                    className="border-b border-app-line bg-muted px-3 py-2 text-left font-semibold whitespace-nowrap text-muted-foreground"
                  >
                    {inline(cell, `${key}-h${i}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.body.map((row, r) => (
                <tr key={r}>
                  {/* A short row would collapse the grid, so every row is padded
                      out to the header's width. */}
                  {b.head.map((_, c) => (
                    <td
                      key={c}
                      className="border-b border-app-line-soft px-3 py-2 align-top last:border-r-0 [tr:last-child_&]:border-b-0"
                    >
                      {inline(row[c] ?? "", `${key}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="text-sm leading-relaxed break-words text-foreground">
      {parse(source).map((b, i) => renderBlock(b, `b${i}`))}
    </div>
  );
}
