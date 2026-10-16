// Fonts cover latin, latin-ext (Turkish, Turkmen) and Cyrillic (Russian): each
// @fontsource stylesheet includes every subset, split by unicode-range, so the
// browser only downloads the subsets a page actually uses.
import "@fontsource-variable/manrope";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import "./styles/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
