import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SessionProvider } from "./auth";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
