# ce-drive-web

The open-source Google Drive UI for CE Drive — the web face of the CE Drive capstone
(PLAN/10-drive-fs.md §8, milestone **v1.M3**). A calm, polished, accessible single-page app
that renders a **DriveTree** model (the Kleppmann move-CRDT directory tree ce-drive-core
owns) and stores file bytes via the CE node's content-addressed, CID-verified blob layer
through `@ce-net/sdk`.

Framework-free TypeScript + Vite. No React, no build magic — just typed DOM and a clean
client interface that mirrors `ce-drive-core`'s surface.

## What it does

- **File browser** — folder tree sidebar + list pane, both rendered from the DriveTree
  `children` index. Breadcrumb navigation, dirs-first sorting, multi-select.
- **Upload / download** — chunked (1 MiB) → `put_blob` per chunk → manifest blob, and
  `get_object` with **per-chunk CID verification** on the way back (the SDK data layer).
  Drag a file onto the pane to upload into the current folder.
- **Drag-to-move / rename / copy** — each structural mutation is a single `MoveOp`
  (create / delete / rename / move-dir). The move runs the CRDT **cycle check** — you
  cannot drop a folder into its own subtree.
- **Trash / restore** — delete = move into the reserved `TRASH` node; content is retained
  (undelete) until permanent deletion.
- **Version history panel** — every save is a new CID, old CIDs stay valid, so the version
  list is free. Download any version or restore one as current.
- **Share dialog** — mint / revoke a Drive capability (Viewer / Commenter / Editor / Admin)
  scoped to a node's subtree, to a specific node or "anyone with link", with optional
  expiry. Lists and revokes active grants.
- **Search** — instant filename / path / CID metadata search over the tree.
- **Audit log** — the immutable record of grant/revoke + activity facts (v1).

## Architecture: the `DriveCore` seam

The single seam between UI and storage is `src/core/drive-core.ts` — a clean TypeScript
interface mirroring `ce-drive-core`'s Rust surface (`tree.rs` / `content.rs` / `store.rs` /
`share.rs` / `audit.rs`). Two adapters satisfy it:

- **`MockDriveCore`** (`src/core/mock-adapter.ts`) — today's adapter. The **content path is
  real**: bytes are chunked → `put_blob` → manifest and downloaded CID-verified via the
  SDK. The **tree / sharing / audit** logic is simulated in-memory (stable NodeId edges,
  derived paths, cycle-skip, TRASH, version lists, conflict-rename projection, capability
  minting) but does **not** converge with other replicas, mint signed `ce-cap` chains, or
  read on-chain facts.
- **`WasmDriveCore`** (future) — `ce-drive-core` compiled to WASM, running in the browser
  CE node, doing the real move-CRDT, `ce-cap` minting, on-chain audit reads, and optional
  E2E envelope. **The UI is unchanged** when this lands; it only depends on the interface.

Every mock-backed stub and every deferred wire call is marked `// TODO` in the source. The
load-bearing ones:

- `mock-adapter.ts` — the whole adapter is `// TODO(ce-drive-core WASM bridge)`.
- `mock-adapter.ts::share` / `::revoke` — `// TODO(ce-cap wire call)` for minting a real
  attenuating chain and submitting on-chain `RevokeCapability`.
- `audit-view.ts` — the on-chain `/history` read is the real `ce-drive-core` audit.rs path.

## Content backend

On startup the app probes a local CE node via the `/ce` path (proxied to
`http://127.0.0.1:8844` in dev; resolved by the reverse proxy in production). If reachable,
uploads/downloads hit the node's durable `/blobs` store. If not, it falls back to an
in-memory CID store so the app is fully demoable offline — the connection pill shows which.

## Develop

```bash
npm install
npm run dev        # http://localhost:5184
npm run build      # tsc --noEmit && vite build → dist/
npm run typecheck
```

`@ce-net/sdk` and `ce-drive-core` (when wired) are local path deps, mirroring how
`ce-pin` / `rdev` / `ce-notes` wire up.

## License

MIT — Leif Rydenfalk.
