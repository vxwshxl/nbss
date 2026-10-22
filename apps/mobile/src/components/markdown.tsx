import { Fragment } from "react";
import { Linking, Text as Span, ScrollView, StyleSheet, View, type TextStyle } from "react-native";

import { color, font, radius, space } from "@/theme/tokens";

import { Text } from "./text";

/**
 * The assistant's replies, which are Markdown: headings, lists, tables, code,
 * quotes, and **bold**, *italic*, `code` and [links] inside a line. Small on
 * purpose: what the assistant writes, not the whole of CommonMark. It also copes
 * with a reply still streaming in, where a table or a fence is half written.
 */
export function Markdown({ children, tint }: { children: string; tint?: string }) {
  const blocks = parse(children);
  const ink: TextStyle | undefined = tint ? { color: tint } : undefined;

  return (
    <View style={styles.root}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading":
            return (
              <Text key={i} variant={b.level === 1 ? "sectionTitle" : "bodyLarge"} weight="semibold" style={[styles.heading, ink]}>
                <Inline text={b.text} ink={ink} />
              </Text>
            );
          case "list":
            return (
              <View key={i} style={styles.list}>
                {b.items.map((item, j) => (
                  <View key={j} style={[styles.item, { paddingLeft: item.depth * 14 }]}>
                    <Text variant="body" style={[styles.marker, ink]} mono={b.ordered}>
                      {b.ordered ? `${(b.start ?? 1) + j}.` : "•"}
                    </Text>
                    <Text variant="body" style={[styles.flex, ink]}>
                      <Inline text={item.text} ink={ink} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case "code":
            return (
              <ScrollView key={i} horizontal style={styles.code} contentContainerStyle={styles.codeIn} showsHorizontalScrollIndicator={false}>
                <Text variant="caption" mono>
                  {b.text}
                </Text>
              </ScrollView>
            );
          case "quote":
            return (
              <View key={i} style={styles.quote}>
                <Text variant="body" tone="muted">
                  <Inline text={b.text} ink={undefined} />
                </Text>
              </View>
            );
          case "table":
            return <Table key={i} head={b.head} rows={b.rows} />;
          case "rule":
            return <View key={i} style={styles.rule} />;
          default:
            return (
              <Text key={i} variant="body" style={ink}>
                <Inline text={b.text} ink={ink} />
              </Text>
            );
        }
      })}
    </View>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.table}>
      <View>
        <View style={[styles.tr, styles.th]}>
          {head.map((h, i) => (
            <Text key={i} variant="caption" weight="semibold" style={styles.td}>
              <Inline text={h} />
            </Text>
          ))}
        </View>
        {rows.map((r, i) => (
          <View key={i} style={[styles.tr, i > 0 && styles.trLine]}>
            {head.map((_, j) => (
              <Text key={j} variant="caption" style={styles.td}>
                <Inline text={r[j] ?? ""} />
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ───────────────────────────────────────────────────────────── inline */

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function Inline({ text, ink }: { text: string; ink?: TextStyle }) {
  const parts = text.split(INLINE).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if ((p.startsWith("**") && p.endsWith("**")) || (p.startsWith("__") && p.endsWith("__"))) {
          return (
            <Span key={i} style={[styles.bold, ink]}>
              {p.slice(2, -2)}
            </Span>
          );
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return (
            <Span key={i} style={styles.inlineCode}>
              {p.slice(1, -1)}
            </Span>
          );
        }
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p);
        if (link) {
          const href = link[2]!;
          return (
            <Span key={i} style={styles.link} onPress={() => void Linking.openURL(href).catch(() => undefined)}>
              {link[1]}
            </Span>
          );
        }
        if ((p.startsWith("*") && p.endsWith("*") && p.length > 2) || (p.startsWith("_") && p.endsWith("_") && p.length > 2)) {
          return (
            <Span key={i} style={[styles.italic, ink]}>
              {p.slice(1, -1)}
            </Span>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/* ───────────────────────────────────────────────────────────── blocks */

type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; start?: number; items: { text: string; depth: number }[] }
  | { kind: "code"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "rule" };

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

function parse(src: string): Block[] {
  const lines = src.replace(/\r/g, "").split("\n");
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const t = line.trim();

    if (!t) {
      i += 1;
      continue;
    }

    if (t.startsWith("```")) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) body.push(lines[i++]!);
      i += 1;
      out.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) {
      out.push({ kind: "heading", level: h[1]!.length, text: h[2]! });
      i += 1;
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(t)) {
      out.push({ kind: "rule" });
      i += 1;
      continue;
    }

    if (t.startsWith("|") && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1]!.trim())) {
      const head = cells(t);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(cells(lines[i++]!));
      out.push({ kind: "table", head, rows });
      continue;
    }

    if (t.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith(">")) body.push(lines[i++]!.trim().replace(/^>\s?/, ""));
      out.push({ kind: "quote", text: body.join(" ") });
      continue;
    }

    const bullet = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
    const first = bullet.exec(line);
    if (first) {
      const ordered = /\d/.test(first[2]!);
      const items: { text: string; depth: number }[] = [];
      while (i < lines.length) {
        const m = bullet.exec(lines[i]!);
        if (m && /\d/.test(m[2]!) === ordered) {
          items.push({ text: m[3]!, depth: Math.min(3, Math.floor(m[1]!.length / 2)) });
          i += 1;
        } else if (lines[i]!.trim() && /^\s{2,}/.test(lines[i]!) && items.length) {
          items[items.length - 1]!.text += ` ${lines[i]!.trim()}`;
          i += 1;
        } else break;
      }
      out.push({ kind: "list", ordered, start: ordered ? parseInt(first[2]!, 10) : undefined, items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,6}\s|```|>|\||\s*([-*+]|\d+[.)])\s)/.test(lines[i]!)) {
      para.push(lines[i++]!.trim());
    }
    if (para.length === 0) para.push(lines[i++]!.trim());
    out.push({ kind: "paragraph", text: para.join(" ") });
  }

  return out;
}

const styles = StyleSheet.create({
  root: { gap: space[2] },
  flex: { flex: 1 },
  heading: { marginTop: space[1] },
  list: { gap: space[1] },
  item: { flexDirection: "row", gap: space[2] },
  marker: { minWidth: 14, color: color.mutedForeground },
  code: { borderRadius: radius.lg, backgroundColor: color.muted },
  codeIn: { padding: space[3] },
  quote: { borderLeftWidth: 3, borderLeftColor: color.primary, paddingLeft: space[3] },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.border, marginVertical: space[1] },
  table: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: color.border },
  tr: { flexDirection: "row" },
  th: { backgroundColor: color.muted },
  trLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  td: { width: 132, paddingHorizontal: space[3], paddingVertical: space[2] },
  bold: { fontFamily: font.semibold },
  inlineCode: { fontFamily: font.mono, backgroundColor: color.muted },
  italic: { fontStyle: "italic" },
  link: { fontFamily: font.medium, color: color.primaryInk, textDecorationLine: "underline" },
});
