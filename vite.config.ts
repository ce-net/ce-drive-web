import { defineConfig } from "vite";

// CE Drive web app — the open-source Google Drive face of CE Drive (PLAN/10-drive-fs.md §8).
//
// A pure-web SPA on @ce-net/sdk. It talks to a *local* CE node's HTTP API (:8844) for the
// blob/object layer (chunked, CID-verified storage), and renders a DriveTree model — the
// Kleppmann move-CRDT directory tree that ce-drive-core owns. In production the DriveTree
// CRDT + sharing envelope are ce-drive-core compiled to WASM, running in the browser CE
// node; until that WASM bridge is wired, the tree is backed by a thin in-memory mock
// adapter (src/core/mock-adapter.ts) that mirrors the same TS client interface verbatim.
//
// In dev we proxy `/ce/*` to a local CE node so the browser is same-origin (no CORS). The
// build is a static bundle (deploy like ce-host / ce-infer-ui).
export default defineConfig({
  server: {
    port: 5184,
    proxy: {
      "/ce": {
        target: "http://127.0.0.1:8844",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ce/, ""),
      },
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
});
