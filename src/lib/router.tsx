/**
 * Small routing helpers on top of React Router, with the same names the
 * components already use (Link `href`, useRouter().push/replace/back,
 * usePathname, useSearchParams, notFound).
 *
 * Language: in the shop every internal path gets the current /{locale} prefix
 * automatically, and usePathname() returns the path WITHOUT it — so components
 * keep writing href="/cart" and get /tr/cart in Turkish.
 */
import { type ComponentProps, useMemo } from "react";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useSearchParams as useRouterSearchParams,
} from "react-router";
import { splitLocale, useHref } from "@/i18n";

export type LinkProps = Omit<ComponentProps<typeof RouterLink>, "to"> & {
  href: string;
  /** false keeps the scroll position (e.g. tab switches) */
  scroll?: boolean;
};

/** `<Link href="/cart">` → React Router link to /{locale}/cart. */
export function Link({ href, scroll = true, ...props }: LinkProps) {
  const localize = useHref();
  return <RouterLink to={localize(href)} preventScrollReset={!scroll} {...props} />;
}

export function useRouter() {
  const navigate = useNavigate();
  const localize = useHref();
  return useMemo(
    () => ({
      push: (href: string, opts?: { scroll?: boolean }) => navigate(localize(href), { preventScrollReset: opts?.scroll === false }),
      replace: (href: string, opts?: { scroll?: boolean }) =>
        navigate(localize(href), { replace: true, preventScrollReset: opts?.scroll === false }),
      back: () => navigate(-1),
    }),
    [navigate, localize],
  );
}

/** Current path without the language prefix ("/tr/cart" → "/cart"). */
export function usePathname() {
  return splitLocale(useLocation().pathname).rest;
}

/** Read-only search params for the current URL. */
export function useSearchParams() {
  return useRouterSearchParams()[0];
}

/** Throw from a loader to render the 404 page. */
export function notFound(): never {
  throw new Response("Not Found", { status: 404, statusText: "Not Found" });
}
