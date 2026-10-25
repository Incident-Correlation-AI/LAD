import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Read the admin credential on the dev-server side only.
 *
 * The token must never reach the browser bundle, so it is deliberately NOT
 * prefixed with `VITE_` and is never passed through `define`. Vite injects it
 * into the proxied request server-side.
 *
 * Lookup order: dashboard/.env.local, then the repo-root .env.
 */
function readEnvValue(key: string): string {
  const candidates = [path.join(here, ".env.local"), path.join(here, "..", ".env")];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      if (line.slice(0, eq).trim() !== key) continue;
      return line
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
  return "";
}

export default defineConfig(() => {
  const apiTarget = process.env.LAD_API_TARGET ?? "http://127.0.0.1:8080";
  const adminToken = process.env.LAD_ADMIN_TOKEN ?? readEnvValue("LAD_ADMIN_TOKEN");

  if (!adminToken) {
    console.warn(
      "[dashboard] No LAD_ADMIN_TOKEN found. Set it in dashboard/.env.local " +
        "or the repo-root .env, otherwise incident requests will return 401.",
    );
  }

  return {
    plugins: [react()],
    build: {
      // MUI + Recharts are large but stable; splitting them keeps the app
      // chunk small and cacheable across deploys.
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            mui: ["@mui/material", "@mui/icons-material", "@emotion/react", "@emotion/styled"],
            charts: ["recharts"],
          },
        },
      },
      chunkSizeWarningLimit: 700,
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          configure: (proxy) => {
            // Server-side header injection: same-origin for the browser, so no
            // CORS preflight and no credential in client code.
            proxy.on("proxyReq", (proxyReq) => {
              if (adminToken) {
                proxyReq.setHeader("authorization", `Bearer ${adminToken}`);
              }
            });
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
