/**
 * Runs the API and the /admin page guard inside `npm run dev`, so there's
 * one command and one port (5173) during development.
 */
import type { Plugin } from "vite";
import { guardAdminPage, handleApi, localeRedirect, withHtmlLang } from "./app";
import { loadEnv } from "./env";

export function serverPlugin(): Plugin {
  return {
    name: "vendora-server",
    configureServer(server) {
      loadEnv(server.config.root);
      server.middlewares.use(async (req, res, next) => {
        try {
          if (await handleApi(req, res)) return;
          if (guardAdminPage(req, res)) return;
          if (localeRedirect(req, res)) return;
        } catch (err) {
          return next(err);
        }
        next();
      });
    },
    configurePreviewServer(server) {
      loadEnv();
      server.middlewares.use(async (req, res, next) => {
        if (await handleApi(req, res)) return;
        if (guardAdminPage(req, res)) return;
        if (localeRedirect(req, res)) return;
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
