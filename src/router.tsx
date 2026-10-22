import { createBrowserRouter, redirect, type RouteObject, type ShouldRevalidateFunctionArgs } from "react-router";
import { setActiveLocale } from "@/i18n";
import { AdminI18n } from "@/components/admin/admin-i18n";
import { getAdminLocale } from "@/lib/admin-locale";
import AccountPage, { accountLoader } from "@/pages/shop/account";
import CartPage, { cartLoader } from "@/pages/shop/cart";
import CheckoutPage, { checkoutLoader } from "@/pages/shop/checkout";
import TowelCollectionPage, { collectionLoader } from "@/pages/shop/collection";
import ConfirmationPage, { confirmationLoader } from "@/pages/shop/confirmation";
import CreditsPage from "@/pages/shop/credits";
import HelpPage, { helpLoader } from "@/pages/shop/help";
import HomePage, { homeLoader } from "@/pages/shop/home";
import OrderDetailPage, { orderDetailLoader } from "@/pages/shop/order-detail";
import ProductPage, { legacyProductLoader, productLoader } from "@/pages/shop/product";
import SearchPage, { searchLoader } from "@/pages/shop/search";
import LoginPage, { loginLoader } from "@/pages/auth/login";
import RegisterPage, { registerLoader } from "@/pages/auth/register";
import AdminOrdersPage, { adminOrdersLoader } from "@/pages/admin/orders";
import AdminDashboardPage, { adminDashboardLoader } from "@/pages/admin/dashboard";
import AdminInventoryPage, { adminInventoryLoader } from "@/pages/admin/inventory";
import AdminReviewsPage, { adminReviewsLoader } from "@/pages/admin/reviews";
import AdminReportsPage, { adminReportsLoader } from "@/pages/admin/reports";
import AdminActivityPage, { adminActivityLoader } from "@/pages/admin/activity";
import AdminCustomersPage, { adminCustomersLoader } from "@/pages/admin/customers";
import AdminCatalogPage, { adminCatalogLoader } from "@/pages/admin/catalog";
import { AdminLayout, adminLayoutLoader } from "@/pages/admin/layout";
import AdminLoginPage, { adminLoginLoader } from "@/pages/admin/login";
import { AdminEditProductPage, AdminNewProductPage, adminEditLoader, adminNewLoader } from "@/pages/admin/product-edit";
import {
  AuthLayout,
  LoadingScreen,
  LocaleLayout,
  localeLoader,
  NotFoundPage,
  RootLayout,
  rootRedirectLoader,
  RouteError,
  ShopLayout,
  withLocale,
} from "@/pages/layouts";

/**
 * Collection pages filter/sort/paginate in the browser via the query string,
 * so only refetch when the page, the language or the search term changes.
 */
function collectionRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname !== nextUrl.pathname) return defaultShouldRevalidate;
  const keys = ["q", "deals"];
  return keys.some((k) => currentUrl.searchParams.get(k) !== nextUrl.searchParams.get(k));
}

/** Shop pages (all under /:locale). Loaders run with the page's language. */
const shopPages: RouteObject[] = [
  { index: true, element: <HomePage />, loader: withLocale(homeLoader) },
  { path: "search", element: <SearchPage />, loader: withLocale(searchLoader), shouldRevalidate: collectionRevalidate },
  { path: "collections/:slug", element: <TowelCollectionPage />, loader: withLocale(collectionLoader), shouldRevalidate: collectionRevalidate },
  { path: "products/:slug", element: <ProductPage />, loader: withLocale(productLoader) },
  // Old URLs: /product/:id (cart lines, orders) and /category/* (removed) redirect
  { path: "product/:id", loader: withLocale(legacyProductLoader) },
  { path: "category/*", loader: ({ params }) => redirect(`/${params.locale}/collections/all-towels`) },
  { path: "cart", element: <CartPage />, loader: withLocale(cartLoader) },
  // Signed-in only: these loaders send signed-out shoppers to /login?next=…
  { path: "checkout", element: <CheckoutPage />, loader: withLocale(checkoutLoader) },
  { path: "order/:id/confirmation", element: <ConfirmationPage />, loader: withLocale(confirmationLoader) },
  // Account tabs live in ?tab=, so only refetch for a new page or language
  { path: "account", element: <AccountPage />, loader: withLocale(accountLoader), shouldRevalidate: ({ currentUrl, nextUrl }) => currentUrl.pathname !== nextUrl.pathname },
  { path: "account/orders/:id", element: <OrderDetailPage />, loader: withLocale(orderDetailLoader) },
  { path: "help/:topic", element: <HelpPage />, loader: withLocale(helpLoader) },
  { path: "credits", element: <CreditsPage /> },
  { path: "*", element: <NotFoundPage /> },
];

/**
 * All routes.
 *   /             → /en (or the saved / browser language; the server does this too)
 *   /:locale/…    the shop in English (en), Turkish (tr) or Turkmen (tk)
 *   /admin/…      admin panel — its own language (cookie admin_locale), no URL prefix
 * A loader throwing notFound() shows the 404 page inside the shop layout.
 */
/** Admin pages use the admin's own language (cookie admin_locale), set before their loaders run. */
const withAdminLocale =
  <A,>(loader: (args: A) => unknown) =>
  (args: A) => {
    setActiveLocale(getAdminLocale());
    return loader(args);
  };

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <LoadingScreen />,
    children: [
      { index: true, loader: rootRedirectLoader },

      // Admin (the server also redirects /admin/* to the login page without a session)
      { path: "admin/login", element: <AdminI18n><AdminLoginPage /></AdminI18n>, loader: withAdminLocale(adminLoginLoader) },
      {
        path: "admin",
        element: (
          <AdminI18n>
            <AdminLayout />
          </AdminI18n>
        ),
        loader: withAdminLocale(adminLayoutLoader),
        // Session is checked on entry; API calls re-check it on every request
        shouldRevalidate: ({ currentUrl, nextUrl }) => !currentUrl.pathname.startsWith("/admin") || !nextUrl.pathname.startsWith("/admin"),
        errorElement: <RouteError />,
        children: [
          {
            errorElement: <RouteError />,
            children: [
              { index: true, element: <AdminCatalogPage />, loader: withAdminLocale(adminCatalogLoader) },
              { path: "collections/:slug", element: <AdminCatalogPage />, loader: withAdminLocale(adminCatalogLoader) },
              { path: "products/new", element: <AdminNewProductPage />, loader: withAdminLocale(adminNewLoader) },
              { path: "products/:id/edit", element: <AdminEditProductPage />, loader: withAdminLocale(adminEditLoader) },
              { path: "orders", element: <AdminOrdersPage />, loader: withAdminLocale(adminOrdersLoader) },
              { path: "customers", element: <AdminCustomersPage />, loader: withAdminLocale(adminCustomersLoader) },
              { path: "dashboard", element: <AdminDashboardPage />, loader: withAdminLocale(adminDashboardLoader) },
              { path: "inventory", element: <AdminInventoryPage />, loader: withAdminLocale(adminInventoryLoader) },
              { path: "reviews", element: <AdminReviewsPage />, loader: withAdminLocale(adminReviewsLoader) },
              { path: "reports", element: <AdminReportsPage />, loader: withAdminLocale(adminReportsLoader) },
              { path: "activity", element: <AdminActivityPage />, loader: withAdminLocale(adminActivityLoader) },
            ],
          },
        ],
      },

      // The shop, per language
      {
        path: ":locale",
        element: <LocaleLayout />,
        loader: localeLoader,
        errorElement: <RouteError />,
        children: [
          {
            element: <ShopLayout />,
            errorElement: <RouteError />,
            children: [{ errorElement: <RouteError />, children: shopPages }],
          },
          {
            element: <AuthLayout />,
            children: [
              { path: "login", element: <LoginPage />, loader: withLocale(loginLoader) },
              { path: "register", element: <RegisterPage />, loader: withLocale(registerLoader) },
            ],
          },
        ],
      },
    ],
  },
]);
