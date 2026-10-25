#!/usr/bin/env node
/**
 * Assert the built dashboard bundle contains no credentials.
 *
 * Guide rule (§7.1): "the dashboard bundle must contain no secrets (CI can
 * assert no AWS_SECRET, no tokens in the built assets)."
 *
 * Usage: node scripts/check-bundle-secrets.mjs [dist]
 * Exit 1 on a leak, so CI fails loudly.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const distDir = path.resolve(process.argv[2] ?? "dist");
const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {
  ...readEnvFile(path.join(repoRoot, ".env")),
  ...readEnvFile(path.resolve(".env.local")),
  ...process.env,
};

const secretKeys = [
  "LAD_ADMIN_TOKEN",
  "LAD_COLLECTOR_TOKEN",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
];

const secrets = secretKeys
  .map((key) => [key, env[key]])
  .filter(([, value]) => typeof value === "string" && value.length >= 8);

if (!secrets.length) {
  console.log("[check-bundle-secrets] no credentials in environment; nothing to compare (ok)");
  process.exit(0);
}

if (!fs.existsSync(distDir)) {
  console.error(`[check-bundle-secrets] build output not found: ${distDir}`);
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
})(distDir);

const leaks = [];
for (const file of files) {
  const contents = fs.readFileSync(file, "utf8");
  for (const [key, value] of secrets) {
    if (contents.includes(value)) {
      leaks.push(`${path.relative(distDir, file)} contains ${key}`);
    }
  }
}

if (leaks.length) {
  console.error("[check-bundle-secrets] credential leak detected:");
  for (const leak of leaks) console.error(`  - ${leak}`);
  process.exit(1);
}

console.log(
  `[check-bundle-secrets] ok: ${files.length} bundle files carry no credentials`,
);
