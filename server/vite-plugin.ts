/**
 * Runs the API and the /admin page guard inside `npm run dev`, so there's
 * one command and one port (5173) during development.
 */
import type { Plugin } from "vite";
import { guardAdminPage, handleApi, localeRedirect, withHtmlLang } from "./app";
import { assertAdminConfig } from "./auth";
import { assertDatabaseReady } from "./db/pool";
import { loadEnv } from "./env";
import { applySecurity } from "./security";

export function serverPlugin(): Plugin {
  return {
    name: "vendora-server",
    configureServer(server) {
      loadEnv(server.config.root);
      assertAdminConfig();
      // No database → say why and stop, instead of a shop that half works
      void assertDatabaseReady();
      server.middlewares.use(async (req, res, next) => {
        try {
          if (await applySecurity(req, res)) return;
          if (await handleApi(req, res)) return;
          if (await guardAdminPage(req, res)) return;
          if (localeRedirect(req, res)) return;
        } catch (err) {
          return next(err);
        }
        next();
      });
    },
    configurePreviewServer(server) {
      loadEnv();
      void assertDatabaseReady();
      server.middlewares.use(async (req, res, next) => {
        // Same as dev: an error must reach Vite, not become an unhandled rejection
        try {
          if (await applySecurity(req, res)) return;
          if (await handleApi(req, res)) return;
          if (await guardAdminPage(req, res)) return;
          if (localeRedirect(req, res)) return;
        } catch (err) {
          return next(err);
        }
        next();
      });
    },
    // <html lang="tr"> on the first paint for /tr/… pages
    transformIndexHtml: {
      order: "pre",
      handler: (html, ctx) => withHtmlLang(html, new URL(ctx.originalUrl ?? ctx.path, "http://x").pathname),
    },
  };
}
