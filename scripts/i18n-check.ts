/**
 * npm run i18n:check
 *
 * Compares messages/tr.json, tk.json and ru.json with messages/en.json and
 * fails (exit 1) when a translation is missing or broken:
 *   - a key that exists in English is missing (or empty) in TR/TK/RU
 *   - a list (e.g. month names, help sections) has a different length
 *   - a message uses different {placeholders} than English, or isn't valid ICU
 *   - a Russian plural lacks one of its four forms (one / few / many / other)
 * Keys that exist only in a translation are reported as warnings.
 * Messages identical to English are listed as warnings (fine for "XS" or "CVC",
 * but often a sign of an untranslated string).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { messageArgs, pluralForms } from "../src/i18n/icu";

/** Plural categories each language must spell out (Russian: 1 товар, 3 товара, 5 товаров). */
const REQUIRED_PLURALS: Record<string, string[]> = { ru: ["one", "few", "many", "other"] };

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const root = path.resolve(import.meta.dirname, "..");
const load = (lang: string) => JSON.parse(readFileSync(path.join(root, "messages", `${lang}.json`), "utf8")) as Json;

const en = load("en");
const targets = ["tr", "tk", "ru"] as const;
let errors = 0;
let warnings = 0;

const err = (lang: string, key: string, msg: string) => {
  errors++;
  console.error(`  ✗ [${lang}] ${key}: ${msg}`);
};
const warn = (lang: string, key: string, msg: string) => {
  warnings++;
  console.warn(`  ! [${lang}] ${key}: ${msg}`);
};

const isObj = (v: Json): v is { [k: string]: Json } => !!v && typeof v === "object" && !Array.isArray(v);
const args = (s: string) => {
  try {
    return messageArgs(s).sort().join(",");
  } catch (e) {
    return `INVALID: ${(e as Error).message}`;
  }
};

/** Short strings that are the same in every language. */
const SAME_OK = /^(Slug|Material|material|Türkiye|Turkmenistan|[A-Z]{1,4}|[XSML]{1,3}|\{[^}]+\}( [/–-] \{[^}]+\})?|\{[^}]+\} \(\{[^}]+\}\)|“\{query\}”|[\d\s×]+)$/;

function compare(lang: string, a: Json, b: Json | undefined, key: string) {
  if (b === undefined || b === null) return err(lang, key, "missing");
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return err(lang, key, "should be a list");
    if (a.length !== b.length) err(lang, key, `list has ${b.length} items, English has ${a.length}`);
    a.forEach((v, i) => compare(lang, v, b[i], `${key}[${i}]`));
    return;
  }
  if (isObj(a)) {
    if (!isObj(b)) return err(lang, key, "should be an object");
    for (const k of Object.keys(a)) compare(lang, a[k], b[k], key ? `${key}.${k}` : k);
    for (const k of Object.keys(b)) if (!(k in a)) warn(lang, key ? `${key}.${k}` : k, "not in en.json (unused?)");
    return;
  }
  if (typeof a === "string") {
    if (typeof b !== "string") return err(lang, key, "should be text");
    if (!b.trim()) return err(lang, key, "empty");
    const ea = args(a);
    const eb = args(b);
    if (eb.startsWith("INVALID")) return err(lang, key, `invalid ICU message (${eb})`);
    if (ea !== eb) err(lang, key, `placeholders {${eb}} differ from English {${ea}}`);
    for (const forms of pluralForms(b)) {
      const missing = (REQUIRED_PLURALS[lang] ?? []).filter((f) => !forms.includes(f));
      if (missing.length) err(lang, key, `plural is missing the ${missing.join(", ")} form(s)`);
    }
    if (a === b && a.length > 3 && !SAME_OK.test(a)) warn(lang, key, `same as English: "${a}"`);
  }
}

for (const lang of targets) {
  console.log(`\nmessages/${lang}.json`);
  const before = errors;
  compare(lang, en, load(lang), "");
  if (errors === before) console.log("  ✓ all keys translated");
}

console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
