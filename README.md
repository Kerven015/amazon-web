# Vendora — towel marketplace UI (React + Vite)

Storefront + admin panel on a small Node server with a self-hosted **PostgreSQL**
database: products (edited at **/manager@**), customer accounts (register, sign in,
sign out), bags, wishlists, address books, reviews and orders. Shoppers can browse
and fill a bag signed out, but must sign in to check out. Payment is still a demo
(no card data is ever sent to the server). Built with **React 19 + Vite + React Router 7**, TypeScript, Tailwind CSS v4,
Motion-Primitives on `motion`, Zustand, lucide-react and shadcn/ui-style
primitives. This version was converted from the earlier Next.js build; the
URLs, design and features are the same.

## Run it

```bash
npm install
npm run db:migrate     # create / update the tables (see "Database" below)
npm run db:seed        # import data/products.json into the database (safe to run twice)
npm run dev            # store + API + admin on http://localhost:5173 (admin: /manager@) — this computer only
npm run build          # type-check + production build into dist/
npm run check:secrets  # confirm the admin password isn't in the built client code
npm run i18n:check     # fail if a key in messages/en.json is missing or broken in tr.json / tk.json / ru.json
npm start              # production server (API + dist/) on PORT (default 3000)
npm run images:fetch   # one-time Pexels photo download: products + editorial (needs PEXELS_API_KEY in .env.local)
npm run data:refresh   # re-apply content rules to the seed file data/products.json (then db:seed to load it)
npm run data:seed -- --force   # ⚠ reset the seed file data/products.json to the original catalogue
```

`npm run dev` only answers on this computer. Reaching it from a phone, another computer or a
port-forwarding tunnel (VS Code **Ports**, Codespaces, ngrok) must be switched on with
`DEV_EXPOSE=1` in `.env.local` (then restart `npm run dev`). With a **Public** tunnel anyone with the
link can open the site — including `/manager@`, so use a strong `ADMIN_PASSWORD` while it's shared.

Admin login lives in `.env.local` (server-only): `ADMIN_USERNAME`, `ADMIN_PASSWORD`
and a random `ADMIN_SESSION_SECRET` (32+ characters). See `.env.example`.
In production the server won't start with a weak admin password (under 16 characters or a
placeholder). Admin sessions are kept on the server: **Log out → Log out on all devices** in the
admin ends every admin session at once, and changing `ADMIN_PASSWORD` does the same. Admin sign-in
locks for 5 minutes after 5 failures from one address, and for 15 minutes after 50 failures from
any addresses together.
Customer accounts are separate: they live in the database (passwords hashed with Argon2id).
Customers can also use **Continue with Google**: set `GOOGLE_CLIENT_ID` in `.env.local`
(steps: [deploy/google-sign-in.md](deploy/google-sign-in.md)). Without it, the Google button stays
hidden. Google's script loads only when a customer clicks that button, so the shop sets no
tracking cookies and needs no cookie banner (see /help/cookies).

## Security tests

`npm test` runs about 100 security tests against the real API: access control (admin and
customer routes, nobody sees another customer's data), server-side prices and validation,
password storage, sessions and rate limits, CSRF and security headers, SQL injection and XSS,
and the order / review / address limits. They need a separate test database — see
[tests/README.md](tests/README.md). GitHub Actions runs them, plus the type check, build,
translation check and secret check, on every pull request.

## Database

PostgreSQL runs on your own server, next to the Node app, and is only reachable
from that machine. **[deploy/postgres-setup.md](deploy/postgres-setup.md)** walks
through installing it on Ubuntu/Debian, locking it down, the two roles
(`vendora_owner` runs migrations, `vendora_app` runs the site), daily backups and
the same setup on your own computer. Then:

```bash
npm run db:migrate     # as vendora_owner (MIGRATION_DATABASE_URL); each file in server/db/migrations runs once
npm run db:seed        # imports data/products.json (products, stock, reviews) — upsert by id
npm run build && npm start
```

Without `DATABASE_URL`, or when the database can't be reached, the server prints
why and exits. `data/products.json` is only seed data now; the shop never reads it
at runtime (re-running `db:seed` overwrites products that are also in the file).

| Table | What's in it |
| --- | --- |
| `products` | id, slug, SKU, hidden, price, stock, type + `data` (the rest of the product, as the admin edits it) |
| `product_stock` | units per product × size × colour — what orders decrease |
| `users`, `sessions` | customers; sessions store only a SHA-256 of the cookie token |
| `addresses`, `cart_items`, `wishlist_items` | each customer's address book, bag and wishlist |
| `orders`, `order_items`, `order_events` | orders (prices worked out on the server), their lines and tracking timeline |
| `reviews` | product reviews; rating and review count are computed from here |
| `login_attempts` | failed sign-ins, for the rate limit (5 per IP + email in 15 minutes) |

**Admin → Customers** (`/manager@/customers`) lists every customer account: who is signed in
and active right now, on which devices, their orders and spend. From there you can sign a
customer out (one device or all), block / unblock the account (blocking also signs them
out and stops them signing in), or delete an account that has no orders.

To rename the store, change `siteConfig.name` in `src/lib/config.ts`.

## How it's put together

| Area | Where |
| --- | --- |
| Entry point | `index.html` → `src/main.tsx`, which loads the fonts and styles and starts the router |
| Routes | `src/router.tsx` — all URLs, each with a **loader** that calls `src/lib/api` before the page renders |
| Pages | `src/pages/shop/*`, `src/pages/auth/*`, `src/pages/admin/*` |
| Server (API, login, uploads) | `server/` — `app.ts` (admin routes), `shop-api.ts` (customer routes), `auth.ts` (admin session), `customer-auth.ts` (customer sessions, Argon2id), `upload.ts` (sharp), `index.ts` (production), `vite-plugin.ts` (dev) |
| Database | `server/db/pool.ts` (one `pg` pool + `withTransaction`), `server/db/migrations/*.sql`, `server/lib/db/{products,account,orders}.ts` — plain SQL, always with `$1, $2…` parameters |
| Customer session in the browser | `src/lib/session.ts` — `useSession()`, sign in/out, merging the signed-out bag/wishlist/addresses into the account; `src/lib/account-api.ts` calls the API |
| Products in the browser | `src/lib/catalog.ts` (loads `/api/products`), used by `src/lib/api` |
| Layouts, 404, errors, loading | `src/pages/layouts.tsx` |
| Links and navigation | `src/lib/router.tsx` — `Link href`, `useRouter().push/replace/back`, `usePathname`, `useSearchParams`, `notFound()` on top of React Router |
| Images | `src/components/ui/image.tsx`: plain `<img>` with lazy loading, `priority` and blur placeholders |
| Page titles | `<PageTitle>` in each page (React 19 moves `<title>` into the head) |
| Fonts | self-hosted with `@fontsource`: Manrope (sans) and Cormorant Garamond (serif), both with latin, latin-ext and Cyrillic |
| Dark mode | `src/lib/theme.tsx` plus a small script in `index.html` that applies the theme before first paint |

### Hosting

The site runs on your own server (any VPS): Node for the app and PostgreSQL next
to it, plus a folder on disk for uploaded photos (`public/images/products/`).
`npm run build && npm start` serves the API, uploaded images, the app and the
SPA fallback. Static-only hosts (Netlify, plain Vercel) can't run it.

The store sells towels only: the earlier non-towel demo products (and their
categories, brands, sellers and orders) were removed.

### Next.js → React notes

- Data that the Next.js pages fetched on the server is now fetched by React Router loaders in the browser. The mock API stays the same, so swapping in a real API is still a one-folder change.
- Filtering, sorting and "Show more" on collection pages don't re-run the loader (`shouldRevalidate`). Only a new page or search term does.
- SEO: a single-page app renders in the browser, so search engines see less on the first load than they did with Next.js server rendering. If SEO matters at launch, consider pre-rendering (for example React Router's framework mode) or staying on Next.js.

## What changed in the redesign

| Area | Now |
| --- | --- |
| Tokens | `src/styles/globals.css`: background, surface, foreground, muted, border, accent (sale), success/warning/danger, 2–8px radii, almost no shadows, serif + sans font variables, light + dark. Old token names (`primary`, `deal`, `ink`) are mapped to the new palette, so every page picked up the new look |
| Fonts | Cormorant Garamond for display (h1/h2 and the wordmark), DM Sans for body, UI and prices |
| Announcement bar | `layout/announcement-bar.tsx`: rotates 3 messages with Text Loop; "#quiz" links open the quiz |
| Header | `layout/header.tsx`: sticky and shrinks on scroll; serif logo, mega menu, then search / Log in / wishlist / bag icons |
| Mega menu | `layout/mega-menu.tsx` + `menu-config.ts`: full-width columns (Shop by category / collection / size or feeling / material / colour, plus Need some help?) and a promo card. Opens on hover with a short delay, or from the chevron button. Esc closes it and returns focus. Fades and slides down |
| Mobile menu | `layout/mobile-menu.tsx`: full-height drawer with an Accordion section for each top-level item |
| Search | `layout/search-overlay.tsx`: full-width panel with a large input. Before typing: popular-search pills and "You may also like". While typing: live results with arrow-key navigation |
| Collection page | `collection/collection-view.tsx`: breadcrumb, serif title + intro, quick-filter chips (Shop by product / Shop by feeling), sticky toolbar (Filter, result count, 2/3/4 column toggle, sort), grid, "Show more" with a progress line and "Showing X of Y" |
| Filter drawer | `collection/filter-drawer.tsx`: left drawer with accordion groups (Product, Feel, Weight (GSM), Material, Colour swatches, Size, Design, Brand, Price, Availability). Each option shows a count. Price has a dual-handle slider plus min/max inputs (`price-range-slider.tsx`). The sticky footer has "Clear all", "Apply" and a live "Showing X items" (Animated Number) |
| URL state | `collection/query-state.ts`: `?feel=…&colour=Green,Blue&material=…&type=…&size=…&gsm=…&min=10&max=80&fast=1&stock=1&sale=1&sort=price-asc&view=3&show=24`. Survives refresh and can be shared |
| Product card | `product/product-card.tsx`: 4:5 image. Desktop hover crossfades to the second image and slides up "Quick add" (size/colour picker in `quick-add.tsx`). Touch devices get a swipeable strip with dots and a visible Quick add button. Badge (−%, NEW IN, New Colour, Bestseller, Sold out), heart, tagline, name, "From $X" with sale styling, swatch row (5 + "+N more") that swaps the image per colour |
| Shopping Bag | `cart/cart-drawer.tsx`: opens on add-to-bag, with a toast offering "Go to bag" / "Continue shopping". Has the free-delivery progress bar with $50 and $80 milestones (`free-shipping-progress.tsx`), line items, "Complete the look", discount code, subtotal ("Tax included…"), checkout button, and an empty state |
| Wishlist | `cart/wishlist-drawer.tsx`: same drawer pattern, with an empty state |
| Quiz | `quiz/quiz-modal.tsx`: 3 steps (use case → feel → colour) scored against mock data, then "See all matches" opens a filtered collection. `quiz-banner.tsx` on the home page and the promo card in the mega menu link to it |
| Footer | `layout/footer.tsx` + `newsletter.tsx`: newsletter block first, with inline validation ("Please include an '@'…"). Then socials, three link columns, and a legal row with "© Vendora YEAR". The popup appears once, never on product, bag, checkout, order, account or sign-in pages, and only after 3+ page views and 30+ seconds (desktop: on exit intent or 30s later; phones: a small bottom sheet). Remembered in localStorage |
| Product page | `product/product-detail.tsx`: large gallery (thumbnails, full-screen viewer, mobile carousel; no hover zoom) beside sticky details: tagline, serif title, rating, price, colour swatches with the colour name, size selector, quantity, "Add to bag", wishlist, delivery line, and accordions (Description, Details & care, Delivery, Returns, maker). Below: Complete the look, Reviews, You may also like, Recently viewed |
| Other pages | Home rebuilt editorially. Bag page, checkout, confirmation, account, auth, seller dashboard and 404/error use the new tokens and typography. New `/help/[topic]` pages (delivery, returns, size-guide, care…) |

### Main navigation (towels)

- **Menu items:** edit them in `src/lib/navigation.ts`. The top bar is Towels · Bundles · Bath Mats · Bathrobes · Sale · Gifting · About Us. "Towels" and "Gifting" open panels; the others are plain links.
- **Panel styling:** the exact values are plain CSS in `src/styles/globals.css` (between `@mega-menu-start` and `@mega-menu-end`):
  - cream `#F4F0E9`, navy `#2B3B63`, 1px hairline at the top;
  - columns at 86 / 510 / 940px, with fixed 424px / 430px columns from 1180px up, scaling proportionally below that;
  - 17px headings, 15px links on 26px rows.
- **Vertical spacing:** this is tuned to the target positions (heading text at y≈39, first link at y≈83), so it uses 37px top padding and a 20px gap under the heading instead of the spec's 32px and 24px. Those two numbers together produced a 48px heading-to-link gap rather than the 44px the target positions need.
- **Behaviour:**
  - opens 120ms after hover and closes 200ms after the pointer leaves;
  - Click, Enter or Space toggles a panel, and ArrowDown opens it and moves focus to the first link;
  - Esc, an outside click, the dim overlay or a route change closes it;
  - the active item shows a 1px navy underline.
- **Colour tokens:** `--color-cream`, `--color-navy`, plus the matching `bg-cream` and `text-navy` utilities. The announcement bar, header, mobile menu and footer all use them.
- **Fonts:** Manrope is the site-wide sans (it replaced Figtree, which has no Cyrillic). Page titles (h1/h2) and the logo stay in the Cormorant serif.
- **Links:** every menu link goes to `/collections/[slug]`. The rules for each collection are in `src/lib/collections.ts`, and 18 towel products (p41–p58) were added to the mock data so each page has items.

### Product photos (Pexels)

Product images are real photos from Pexels, downloaded into the project. The
site never hotlinks Pexels, and the API key is never sent to the browser.

1. Copy `.env.example` to `.env.local` and set `PEXELS_API_KEY`.
2. Run `npm install`, then `npm run images:fetch`.

For each product the script saves `public/images/products/{slug}/main.webp`,
`gallery-1…3.webp` and one `{colour}.webp` per extra colour. Every file is
WebP, at most 1200px on the long side, quality 80. It also writes
`src/lib/mock-data/image-manifest.json` (paths and blur placeholders) and
`src/lib/mock-data/image-credits.json`, which feeds `/credits`.

Search queries come from the product type and colour ("folded bath towels sage
green", "hooded baby towel", …), and no photo is used twice. The script waits
300ms between requests, retries once, skips files that already exist, saves
after every product, and stops cleanly if Pexels' hourly limit (200
requests) is hit. A full catalogue needs about 190 requests, so you may have to
re-run it once after the hour resets.

Until a product has photos, it shows a **built-in towel illustration**
(`src/lib/art.ts`): an SVG drawn in code in the product's own colours, so
swatches still change the picture. Illustrations load instantly, never make a
network request and can't break. The hero, category tiles and banners use the
same drawings (`src/lib/images.ts`). The site no longer loads anything from
third-party image sites.

### Mock data added

`types/index.ts` and `lib/mock-data/products.ts` now include, per product:
`tagline`, `productType`, `feel`, `material`, `weightGsm`, `design` and `badge`.
Each colour variant has a `family` (for the colour filter) and its own `image`
(for swatch switching). Larger sizes cost more (`sizePriceStep`), which is
where "From $X" comes from. IDs p1–p40 haven't changed, so existing orders and
reviews still match.

## Store settings you'll want to know about

All in `src/lib/config.ts`:

| Setting | What it drives |
| --- | --- |
| `deliveryOptions` (id, price, minDays, maxDays) | The only source of delivery speeds and prices: product page, checkout, help page, confirmation, orders. Days are **business days** (`src/lib/delivery.ts`). |
| `shippingCountries` (ISO codes) | The checkout country list. While it is `["US"]`, Turkish/Turkmen/Russian visitors see "We currently deliver to the US only" in the announcement bar and the bag. Country names: `countries.{code}` in `messages/`. |
| `social` | Footer social icons — only real profile URLs are shown; empty = hidden. |

### Photos

`npm run images:fetch` downloads product photos **and** the editorial photos (hero ×3,
collection tiles ×6, quiz banner, newsletter) into `public/images/editorial/`, sized exactly
for their slot (`src/lib/editorial.ts`), and records them in
`src/lib/mock-data/editorial-manifest.json`. `photo()` serves the file when it's in the
manifest and falls back to the drawn illustration otherwise (also if a file goes missing).

Generated illustrations are never stored: the admin edits raw records, `toPayload()` and the
server drop any `data:` image, and products may be saved with no photos (the image manager
says "No photos yet — the store shows an illustration"). So `images:fetch` can still fill them.

### Reviews and product text

`src/lib/mock-data/product-details.ts` + `review-pools.ts`: reviews are generated per product
type and fabric, with no text used twice across the catalogue, one author per review, and the
size/colour bought always in stock. `reviewCount` and `rating` are the real count and average
(the server keeps them in sync on save). Highlights, care lines and descriptions depend on the
fabric (terry, waffle, flat weave, muslin, linen, microfibre, pile). Shoppers can write a review;
it is saved on their device (`lib/store/my-reviews.ts`).

### Shopper data kept in the browser (until there's a backend)

Address book (`lib/store/addresses.ts`, used by checkout and the account page), profile name
and email (`lib/store/profile.ts`), placed orders, bag, wishlist and own reviews.

## Languages (English, Turkish, Turkmen, Russian)

**URLs.** Every shop page lives under a language prefix: `/en/…` (default), `/tr/…`, `/tk/…`,
`/ru/…` (e.g. `/ru/products/organic-cotton-bath-towel`). The list lives in one place:
`locales` in `src/i18n/config.ts` (its order is the switcher order). Slugs are the same in all languages.
`/manager@` stays English-only and outside the prefix.

**First visit.** A URL without a prefix (`/`, `/collections/x`) redirects to the saved
language (cookie `vendora_locale`) or, the first time, to the browser's `Accept-Language`:
Turkish → `/tr`, Turkmen → `/tk`, Russian → `/ru`, English → `/en`, in the browser's order of
preference; if none of those is listed, Ukrainian, Belarusian, Kazakh or Uzbek → `/ru`, anything
else → `/en`. The server does this before the
page loads (`server/app.ts` → `localeRedirect`), and also sets `<html lang>` in the first
response. The client does the same for in-app links (`src/pages/layouts.tsx` →
`rootRedirectLoader`, `localeLoader`) and keeps `<html lang>` in sync.

**Switcher.** A globe + `EN` menu (English · Türkçe · Türkmençe · Русский) in the header (next to the account icon), the footer's
bottom row and the mobile drawer (`src/components/layout/language-switcher.tsx`). It saves
the cookie and swaps the prefix on the current URL, keeping the page, query string
(filters, sort, `?colour=`) and hash. The bag, wishlist and recently viewed are stored by
product id, so they carry over and show names in the new language.

**Translations.** `messages/en.json`, `tr.json`, `tk.json` and `ru.json` hold every
interface string, in ICU format (`{count, plural, one {# item} other {# items}}`, `{name}`).
Russian plurals spell out all four forms —
`{count, plural, one {# товар} few {# товара} many {# товаров} other {# товара}}` —
so counts read 1 товар, 3 товара, 5 товаров, 21 товар.
In components: `const t = useT("cart"); t("title")`, `t.rich(...)` for messages with
React elements inside, and `translate(key)` outside React (`src/i18n/index.tsx`). A missing
translated message falls back to English and warns in development.
To add a string: add it to `en.json`, then the same key to `tr.json`, `tk.json` and `ru.json`,
then run `npm run i18n:check`. It fails on missing keys, list length differences,
`{placeholder}` mismatches and Russian plurals without all four forms, and warns about
text identical to English.

> The spec asked for next-intl. next-intl is built for Next.js; this app is Vite +
> React Router, so `src/i18n/` is a small equivalent (same JSON/ICU format, plurals,
> `useT`/`t.rich` like next-intl's `useTranslations`/`t.rich`), so moving to next-intl
> later only means swapping the hook.

**Product content.** Translatable product fields are stored per language —
`title`, `tagline`, `description`, `material`, `weave`, `origin`, `features`,
`highlights`, care text, colour and size names — as `{ en, tr?, tk?, ru? }`
(`ProductRecord` in `src/types`). Prices, SKU, images, stock and slugs are shared.
`src/lib/localize.ts` turns a record into the plain product in the current language,
falling back to English for anything not translated. Russian text for the existing
catalogue was added with `npx tsx scripts/add-russian.ts` (fills only empty Russian fields,
so it never overwrites admin edits; safe to re-run). Filter values (feel, colour family,
design, product type) and badges are translated through the messages. Customer reviews
are shown as written (user content isn't translated).

**Admin.** The admin panel is fully multilingual and has its own language, separate from
the shop's: one EN | TR | TK | RU switcher changes the whole admin page at once — interface
(titles, labels, help texts, buttons, status bar, validation errors, dialogs, toasts, empty
states, top bar, banner, search, bulk bar, sort and filters), the product text being edited,
the catalog (menu, cards, chips — the shop's own translations) and the live preview.
Admin URLs keep no prefix (`/manager@/…`, set in `src/lib/admin-path.ts`); the choice is stored in a cookie `admin_locale` (and
localStorage), so it survives refresh, logout/login and moving between products. First visit:
English. Code: `src/lib/admin-locale.ts` (store), `src/components/admin/admin-i18n.tsx`
(`AdminI18n` provider around every admin page + `AdminLanguageSwitcher`), texts under the
`admin` key in `messages/*.json`. Validation and server messages stay English in the API
and are translated for display by `src/lib/admin-errors.ts`.
Where the switcher sits: in the product form's sticky status bar (right side), in the admin
top bar on the catalog, and top-right on the login page — one per page. Keyboard: arrow keys
on the switcher, or Alt+1 / Alt+2 / Alt+3 / Alt+4 anywhere in the admin.
The status bar says which language is being edited (“Düzenleniyor: Türkçe”,
“Redaktirlenýär: Türkmençe”, “Редактирование: русский”). English content is required; an
amber dot marks a language with empty fields, the status line counts them (click to jump to
the first), and empty fields get an amber left border with the English text as a gray
placeholder. Saving with gaps works but warns which fields will show English. Errors on
English-only fields, seen in another language, say to switch to EN.
Known colour, size, material, weave, origin and care terms pre-fill their translations
(`src/lib/term-translations.ts`). The catalog has a **Missing translations** filter: any
language (`/manager@?missing=1`) or one language (`?missing=tr`, `tk`, `ru`).

**Formatting.** Prices use `Intl.NumberFormat`: `$24.00` in English, `24,00 $` in Turkish,
Turkmen and Russian (Turkmen uses Turkish number style if the browser lacks Turkmen data).
Dates use `Intl.DateTimeFormat` (Russian: `Вт, 14 окт.`). When the browser has no Turkmen data, month and weekday
names come from `tk.json` (`dates.*`). Badges uppercase with the language's rules
(`toLocaleUpperCase`: Turkish `i` → `İ`, Russian `Новинка` → `НОВИНКА`). The size guide keeps cm and inches.

**Search** matches every language and script, ignoring case and accents: `yumsak` finds
`ýumşak`, `havlu` finds Turkish titles, `полотенце` finds `Полотенце`, `i`/`ı`/`İ` and
`е`/`ё` are treated alike.

**SEO.** Translated page titles and meta descriptions; `hreflang` alternates for en / tr /
tk / ru plus `x-default` → English, and a canonical link on every page; `sitemap.xml` lists
every page in all four languages with alternates; Product JSON-LD and Open Graph use the
current language (`inLanguage`, `og:locale`).

**Home link.** "Home" is the first item of the desktop menu (house icon + label; icon only
with a tooltip between 1024 and 1179px), the first row of the mobile drawer, and the
logo does the same. It always goes to `/{current language}`, closes any open menu, panel
or drawer, and on the home page itself smooth-scrolls to the top instead of navigating
(`src/components/layout/home-link.tsx`). The admin top bar has its own Home → `/manager@`.
When the menu doesn't fit next to the logo and icons (Turkish/Turkmen/Russian on smaller desktops),
it moves to its own centred row under them; the header measures this live
(`useStackedNav` in `header.tsx`), so it adapts to any language or font.

**Icons.** Navigation uses single-colour lucide line icons, never emoji. Each menu link in
`lib/navigation.ts` names an `icon` key; `src/components/ui/nav-icon.tsx` maps keys to icons
(the only place to change one). They're drawn in the `--color-icon` token: the site navy
`#2B3B63`, or `#8FA8D9` in dark mode; on a selected (navy) chip they take the chip's text colour.
Menu rows keep a fixed 22px icon box + 8px gap so labels line up (16px icons in the mega menu,
18px in the mobile drawer).

**Fonts** are the `@fontsource` packages: **Manrope** (sans, everything except headings) and
**Cormorant Garamond** (serif headings and logo). Both cover latin, latin-ext
(ç ğ ı İ ş ä ň ö ü ý ž) and Cyrillic, so all four languages use the same two fonts. Each
stylesheet splits subsets by `unicode-range`, so a page only downloads what it shows.
(Manrope replaced Figtree, which has no Cyrillic.) Buttons grow in height rather than
cutting off longer Turkish, Turkmen and Russian labels.

## Admin panel (`/manager@`)

**Login** — `/manager@/login`. Credentials are checked on the server (`POST /api/admin/login`) against `.env.local` with a constant-time comparison. 5 wrong attempts from one IP lock login for 5 minutes. A correct login sets an HS256-signed session (8 hours) in an `httpOnly`, `SameSite=Strict` cookie (`Secure` in production). Without a valid cookie, every `/manager@` page redirects to the login page and every `/api/admin/*` call returns 401 (`server/app.ts` → `guardAdminPage` / `handleApi`). Admin pages send `noindex` (meta tag + `X-Robots-Tag`), `/manager@` isn't in `/sitemap.xml`, and `robots.txt` doesn't mention it (that would point people to it). The old `/admin` address is just an unknown page.

**Catalog** — `/manager@` (all products, including hidden) and `/manager@/collections/:slug`. It's the public collection page (`CollectionView`, `ProductGrid`, `ProductCard`, filter drawer, sort, view toggle, Show more) with an admin layer:
- the same mega menu (`lib/navigation.ts`) pointed at admin URLs, plus a search box (name, SKU or colour),
- Edit / Delete buttons and a checkbox on every card; clicking a card opens the edit page,
- a bulk bar (“3 selected · Delete selected · Clear selection”) and “+ Add product”.

**Delete** — confirmation dialog, then the card animates out and a toast offers Undo for 8 seconds (the server keeps deleted products for 10 minutes for this). Shoppers' bags, wishlists and recently viewed drop deleted or hidden products, with “An item in your bag is no longer available”.

**Add / Edit** — `/manager@/products/new` and `/manager@/products/:id/edit`. Two columns with a live ProductCard preview. Fields: name, slug (auto), SKU, tagline, description, category / collections / sizes (from the Shop By menus), price and sale price per size (−X% calculated), badge, material, GSM, feel, weave, origin, features, care guide, colour rows (name, picker, filter group, image, stock per size; reorder), drag-and-drop images (JPG/PNG/WebP ≤ 5MB → WebP via sharp into `public/images/products/{slug}/`, drag to reorder, alt text), stock status and “Visible on site”. Validation uses zod (`src/lib/product-schema.ts`) in the browser and again on the server, plus unique slug/SKU. “Save”, “Save and add another”, “Cancel”, and “Delete product” on edit. You get a warning before leaving with unsaved changes.

**After a save** the admin reloads the catalogue, and open store tabs pick up the change when you return to them or within 30 seconds (`src/lib/catalog.ts`). This replaces Next.js `revalidatePath`.

**API** (`server/app.ts`): `GET /api/products` · `POST /api/admin/login` · `POST /api/admin/logout` · `GET /api/admin/session` · `GET|POST /api/admin/products` · `PUT|DELETE /api/admin/products/:id` · `POST /api/admin/products/delete` (bulk) · `POST /api/admin/products/restore` (undo) · `POST /api/admin/upload`.

## Product pages (`/products/:slug`)

- Every product card (home, collections, search, rows) links to `/products/{slug}`. A swatch picked on the card carries over as `?colour=sand`. Heart, swatches and Quick add don't open the page.
- Hovering/focusing a card preloads the page data (`src/lib/product-page-data.ts`), standing in for Next.js `<Link prefetch>`.
- Old `/product/:id` links (cart lines, orders) redirect to the slug URL.
- Products come from the server (`/api/products`); hidden or deleted products return the 404 page.
- New product fields: `features[]`, `weave`, `origin`, `sizes[]` (name, cm dimensions, price, salePrice, stock per colour), `careInstructions[]`, `reviews[]`, `hidden`. Generated for the mock catalogue in `src/lib/mock-data/product-details.ts`.
- The admin form `/manager@/products/:id/edit` edits these fields.
- SEO: title `{name} | Vendora`, meta description, Open Graph, canonical and Product JSON-LD (`src/components/product/product-seo.tsx`). The app is client-rendered, so Google sees these after rendering JS. Social link previews need prerendering/SSR, and an OG image needs real photos (the built-in illustrations are data URIs).
- The page uses the cream `#F4F0E9` / navy `#2B3B63` scope (`.theme-cream` in globals.css).

## Motion-Primitives usage

| Component | Where it's used |
| --- | --- |
| Text Loop | Announcement bar |
| Transition Panel | Quiz steps, checkout steps, account tabs |
| Accordion | Filter drawer, mobile menu, product details, help pages |
| Animated Number | Filter "Showing X items", result count, bag subtotal, free-delivery amount, prices on the product page |
| Sliding Number | Bag badge count, quantity steppers |
| Animated Group + In View | Product grids (per-card staggered fade-up), category tiles, section headings |
| Carousel | Hero, product gallery |
| Scroll Progress | Product page |
| Text Shimmer | Loading states |
| Animated Background | Account tabs, seller nav, order filters, auth role toggle |

All motion uses a 200–500ms ease-out curve with no springy bounces. Reduced
motion is respected through `<MotionConfig reducedMotion="user">`, checks in the
components themselves, and a CSS media query.

I removed Spotlight, Tilt, Dock, Morphing Popover and Morphing Dialog from the
first build because they don't fit the calmer direction. The components in
`components/motion-ui/` were written by hand to the public Motion-Primitives
APIs, because the CLI host was unreachable from the build environment.

## Accessibility notes

- Drawers and modals use Radix Dialog: focus is trapped, Esc closes them, and focus returns to the trigger.
- The mega menu can be used from the keyboard: Tab to a chevron button, press Enter to open it, Tab into the links, and press Esc to close.
- The search overlay is a combobox with `aria-activedescendant`.
- Swatches are radio groups, icon buttons have labels, and the skip link is kept.
- The muted text colour (#645d54) on the off-white background is about 5.6:1, and the accent (#94503d) with white text is about 5.9:1.

## TODO for the backend phase

- Replace the bodies in `src/lib/api/index.ts` with real fetches, and move filtering and faceting to the server. The query-string format can stay the same.
- Real auth and sessions; protect the account, checkout and seller pages.
- Server-side cart, discount-code validation, and merging the browser cart on sign-in.
- Payments, and creating orders through the API.
- Newsletter sign-up to an email provider; the popup currently only uses localStorage.
- Per-colour images and stock from the catalogue, plus real size pricing.
- Move the help content to a CMS; real reviews and write-a-review.
- Wire the language and currency selectors to i18n and currency conversion.
- Show dates in the user's time zone (currently UTC).
- The social icons use lucide's brand icons, which lucide has deprecated. Swap in your own SVGs if a future lucide version removes them.
"# amazon-web" 
