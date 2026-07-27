import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { CONTENT } from "./content/loadContent";
import "./styles/global.css";

// Content problems are logged once, in development only. The user sees the
// plain Japanese notice the store raises; she never sees any of this.
if (import.meta.env.DEV) {
  if (CONTENT.errors.length) {
    console.error("[content] validation failed:\n" + CONTENT.errors.join("\n"));
  }
  if (CONTENT.placeholders.length) {
    console.warn(
      `[content] ${CONTENT.placeholders.length} entries still hold REPLACE_WITH_* placeholders: ` +
        CONTENT.placeholders.join(", "),
    );
  }
}

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
