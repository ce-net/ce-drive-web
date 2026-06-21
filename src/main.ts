/**
 * ce-drive-web — app entry.
 *
 * The open-source Google Drive face of CE Drive (PLAN/10-drive-fs.md §8). A framework-free
 * TypeScript + Vite SPA over @ce-net/sdk.
 *
 * It renders a DriveTree model — the Kleppmann move-CRDT directory tree ce-drive-core owns
 * (§4) — and stores file *bytes* via the node's content-addressed blob layer (chunked,
 * CID-verified, §3.1) through the SDK. The tree/sharing/audit logic is, for now, served by
 * an in-memory mock adapter that mirrors ce-drive-core's surface verbatim
 * (src/core/mock-adapter.ts).
 *
 * // TODO(ce-drive-core WASM bridge): swap MockDriveCore for WasmDriveCore — ce-drive-core
 * // compiled to WASM, running in the browser CE node, doing the real move-CRDT, ce-cap
 * // minting, on-chain audit reads, and (optional) E2E envelope. The UI is unchanged: it
 * // only depends on the DriveCore interface (src/core/drive-core.ts).
 */

import "./app.css";
import { DriveStore } from "./store/drive-store.js";
import { mountApp } from "./views/app.js";
import { el, mount } from "./lib/dom.js";

const root = document.getElementById("app");
if (!root) {
  throw new Error("missing #app root");
}

mount(root, el("div", { class: "boot" }, el("div", { class: "boot-spinner" }), el("span", {}, "Loading CE Drive…")));

const store = new DriveStore();
store
  .init()
  .then(() => mountApp(store, root))
  .catch((err: unknown) => {
    mount(
      root,
      el(
        "div",
        { class: "boot error" },
        el("h2", {}, "CE Drive failed to start"),
        el("p", { class: "muted" }, err instanceof Error ? err.message : String(err)),
      ),
    );
  });
