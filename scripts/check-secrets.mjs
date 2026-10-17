#!/usr/bin/env node
/**
 * Fails if the admin password, the admin session secret or a database password
 * (or the literal "admin2026") appears anywhere in the built client bundle.
 * Run after `npm run build`:  npm run check:secrets
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
if (!existsSync(dist)) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

const needles = new Set(["admin2026"]);
for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(ADMIN_PASSWORD|ADMIN_SESSION_SECRET|DATABASE_URL|MIGRATION_DATABASE_URL)\s*=\s*(.+)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (m[1].endsWith("DATABASE_URL")) {
      // The whole URL and the password inside it
      needles.add(value);
      try {
        const pw = decodeURIComponent(new URL(value).password);
        if (pw.length >= 4) needles.add(pw);
      } catch {}
    } else if (value.length >= 4) needles.add(value);
  }
}

const hits = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else {
      const content = readFileSync(full, "latin1");
      for (const n of needles) if (content.includes(n)) hits.push(`${path.relative(dist, full)} contains a secret value`);
    }
  }
};
walk(dist);

if (hits.length) {
  console.error("✗ Secrets found in the client build:\n  " + hits.join("\n  "));
  process.exit(1);
}
console.log(`✓ Checked dist/ — no admin password, session secret or database password in the client bundle (${needles.size} values checked).`);
