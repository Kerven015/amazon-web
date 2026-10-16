/**
 * Loads .env.local and .env into process.env (server only — nothing here
 * reaches the browser bundle; Vite only exposes VITE_* variables).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let loaded = false;

export function loadEnv(root = process.cwd()) {
  if (loaded) return;
  loaded = true;
  for (const file of [".env.local", ".env"]) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || line.trimStart().startsWith("#")) continue;
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    }
  }
}

export function env(name: string): string | undefined {
  loadEnv();
  return process.env[name];
}

export const isProduction = () => env("NODE_ENV") === "production";
