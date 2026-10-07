import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Landing from "../../src/Landing";

// Mount the real page in isolation so cleanup is tested without a document reload.
export function mountProbe() {
  const host = document.createElement("div");
  document.body.prepend(host);
  const root = createRoot(host);
  root.render(
    <StrictMode>
      <Landing />
    </StrictMode>,
  );
  return () => {
    root.unmount();
    host.remove();
  };
}
