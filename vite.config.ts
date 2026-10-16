import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { serverPlugin } from "./server/vite-plugin";

export default defineConfig({
  // API routes + /admin guard run inside the dev server (see server/)
  plugins: [react(), tailwindcss(), serverPlugin()],
  // Only VITE_* variables ever reach the browser; admin secrets stay server-side.
  envPrefix: "VITE_",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    // Listen on all interfaces so VS Code / Codespaces port forwarding can reach it
    host: true,
    port: 5173,
    strictPort: true,
    // Vite 7 blocks requests from unknown hostnames. Allow the forwarding/tunnel domains
    // (GitHub Codespaces, VS Code dev tunnels, Gitpod) plus anything in DEV_ALLOWED_HOSTS.
    allowedHosts: [
      ".app.github.dev",
      ".github.dev",
      ".githubpreview.dev",
      ".devtunnels.ms",
      ".gitpod.io",
      ...(process.env.DEV_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean),
    ],
    // Hot reload through the HTTPS forwarded address (port 443) in Codespaces
    hmr: process.env.CODESPACES ? { clientPort: 443 } : undefined,
    // data/products.json changes on every admin save — don't reload the page for it
    watch: { ignored: ["**/data/**"] },
  },
  preview: { host: true, port: 4173 },
});
