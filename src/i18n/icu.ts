/**
 * Tiny ICU MessageFormat subset (the same syntax next-intl uses):
 *   "Hello {name}"
 *   "{count, plural, =0 {No results} one {# result} other {# results}}"
 *   "{kind, select, bath {Bath} other {Other}}"
 * `#` inside a plural branch is the number, formatted for the locale.
 * Use '{' and '}' quoting ('{'…'}') for literal braces.
 */

type Values = Record<string, string | number | undefined | null>;
type Node =
  | string
  | { type: "arg"; name: string }
  | { type: "plural" | "select"; name: string; offset: number; options: Record<string, Node[]> }
  | { type: "hash" };

const cache = new Map<string, Node[]>();

function parse(src: string): Node[] {
  let i = 0;

  function parseNodes(inPlural: boolean, stopAtBrace: boolean): Node[] {
    const out: Node[] = [];
    let text = "";
    const flush = () => {
      if (text) out.push(text);
      text = "";
    };
    while (i < src.length) {
      const ch = src[i];
      if (ch === "'" && (src[i + 1] === "{" || src[i + 1] === "}" || src[i + 1] === "#")) {
        const end = src.indexOf("'", i + 1);
        text += src.slice(i + 1, end < 0 ? undefined : end);
        i = end < 0 ? src.length : end + 1;
        continue;
      }
      if (ch === "'" && src[i + 1] === "'") {
        text += "'";
        i += 2;
        continue;
      }
      if (ch === "}" && stopAtBrace) break;
      if (ch === "#" && inPlural) {
        flush();
        out.push({ type: "hash" });
        i++;
        continue;
      }
      if (ch === "{") {
        flush();
        i++;
        out.push(parseArg());
        continue;
      }
      text += ch;
      i++;
    }
    flush();
    return out;
  }

  function readUntil(chars: string) {
    const start = i;
    while (i < src.length && !chars.includes(src[i])) i++;
    return src.slice(start, i).trim();
  }

  function parseArg(): Node {
    const name = readUntil(",}");
    if (src[i] === "}") {
      i++;
      return { type: "arg", name };
    }
    i++; // ,
    const kind = readUntil(",}");
    if (src[i] === "}") {
      // {n, number} etc. — treat as plain argument
      i++;
      return { type: "arg", name };
    }
    i++; // ,
    const type = kind === "plural" || kind === "selectordinal" ? "plural" : "select";
    let offset = 0;
    const options: Record<string, Node[]> = {};
    while (i < src.length) {
      while (/\s/.test(src[i] ?? "")) i++;
      if (src[i] === "}") {
        i++;
        break;
      }
      const key = readUntil("{ \n\t");
      if (key.startsWith("offset:")) {
        offset = Number(key.slice(7)) || 0;
        continue;
      }
      while (/\s/.test(src[i] ?? "")) i++;
      if (src[i] !== "{") break;
      i++;
      options[key] = parseNodes(type === "plural", true);
      i++; // }
    }
    return { type, name, offset, options };
  }

  return parseNodes(false, false);
}

const pluralRules = new Map<string, Intl.PluralRules>();
function pluralCategory(locale: string, n: number) {
  let rules = pluralRules.get(locale);
  if (!rules) {
    try {
      rules = new Intl.PluralRules(locale);
      // Browsers without Turkmen data fall back to Turkish rules (same categories)
      if (!rules.resolvedOptions().locale.startsWith(locale)) rules = new Intl.PluralRules(locale === "tk" ? "tr" : locale);
    } catch {
      rules = new Intl.PluralRules("en");
    }
    pluralRules.set(locale, rules);
  }
  return rules.select(n);
}

function render(nodes: Node[], values: Values, locale: string, formatNumber: (n: number) => string, hash?: number): string {
  let out = "";
  for (const node of nodes) {
    if (typeof node === "string") out += node;
    else if (node.type === "hash") out += hash === undefined ? "#" : formatNumber(hash);
    else if (node.type === "arg") {
      const v = values[node.name];
      out += v === undefined || v === null ? `{${node.name}}` : typeof v === "number" ? formatNumber(v) : v;
    } else if (node.type === "plural") {
      const n = Number(values[node.name] ?? 0);
      const branch = node.options[`=${n}`] ?? node.options[pluralCategory(locale, n - node.offset)] ?? node.options.other ?? [];
      out += render(branch, values, locale, formatNumber, n - node.offset);
    } else {
      const v = String(values[node.name] ?? "other");
      out += render(node.options[v] ?? node.options.other ?? [], values, locale, formatNumber, hash);
    }
  }
  return out;
}

export function formatMessage(message: string, values: Values = {}, locale = "en", formatNumber: (n: number) => string = String) {
  if (!message.includes("{") && !message.includes("'")) return message;
  let nodes = cache.get(message);
  if (!nodes) {
    nodes = parse(message);
    cache.set(message, nodes);
  }
  return render(nodes, values, locale, formatNumber);
}

/** Placeholder names used by a message (for the i18n:check script). */
export function messageArgs(message: string): string[] {
  const names = new Set<string>();
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (typeof n === "string" || n.type === "hash") continue;
      names.add(n.name);
      if (n.type !== "arg") Object.values(n.options).forEach(walk);
    }
  };
  walk(parse(message));
  return [...names].sort();
}

/** Branch keys of every plural in a message, e.g. [["one", "few", "many", "other"]] (for i18n:check). */
export function pluralForms(message: string): string[][] {
  const out: string[][] = [];
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (typeof n === "string" || n.type === "hash" || n.type === "arg") continue;
      if (n.type === "plural") out.push(Object.keys(n.options));
      Object.values(n.options).forEach(walk);
    }
  };
  walk(parse(message));
  return out;
}
