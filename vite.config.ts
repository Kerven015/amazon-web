import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { serverPlugin } from "./server/vite-plugin";

/**
 * DEV_EXPOSE=1 (or running inside GitHub Codespaces, whose forwarded ports are private to you
 * by default) lets other devices and port-forwarding tunnels reach the dev server.
 */
const exposed = process.env.DEV_EXPOSE === "1" || process.env.CODESPACES === "true";
if (exposed) console.warn("\n! DEV_EXPOSE: the dev server accepts connections from other devices and tunnels. Keep tunnels private.\n");

export default defineConfig({
  // API routes + /admin guard run inside the dev server (see server/)
  plugins: [react(), tailwindcss(), serverPlugin()],
  // Only VITE_* variables ever reach the browser; admin secrets stay server-side.
  envPrefix: "VITE_",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    // Only this computer can open the dev site (http://localhost:5173). Opening it to other
    // devices or through a tunnel (VS Code "Ports", Codespaces, ngrok…) must be switched on
    // on purpose with DEV_EXPOSE=1 — the dev server runs the admin API with your local
    // passwords, and anyone with a public tunnel link could reach it.
    host: exposed ? true : "localhost",
    port: 5173,
    strictPort: true,
    // Vite blocks requests whose Host isn't localhost unless listed here. Tunnel domains are
    // only allowed when exposure is switched on, so a forwarded port gets "Blocked request".
    allowedHosts: [
      ...(exposed ? [".app.github.dev", ".github.dev", ".githubpreview.dev", ".devtunnels.ms", ".gitpod.io"] : []),
      ...(process.env.DEV_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean),
    ],
    // Hot reload through the HTTPS forwarded address (port 443) in Codespaces
    hmr: exposed && process.env.CODESPACES ? { clientPort: 443 } : undefined,
    // data/products.json changes on every admin save — don't reload the page for it
    watch: { ignored: ["**/data/**"] },
  },
  preview: { host: exposed ? true : "localhost", port: 4173 },
});
