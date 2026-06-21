/**
 * DriveStore — the app's single state container.
 *
 * Holds the active {@link DriveCore} (the mock adapter today, the WASM bridge tomorrow),
 * the current folder, the selection, and the live tree snapshot. Views subscribe; mutations
 * go through the store so re-renders happen from one source of truth (the converged CRDT).
 */

import { CeClient } from "@ce-net/sdk";
import type { DriveCore, TreeSnapshot } from "../core/drive-core.js";
import {
  MemoryBlobBackend,
  MockDriveCore,
  NodeBlobBackend,
  type BlobBackend,
} from "../core/mock-adapter.js";
import { ROOT, type NodeId } from "../core/model.js";

/** Whether the content backend is a live node or the offline in-memory fallback. */
export type Backend = "node" | "memory";

export interface ConnectionState {
  backend: Backend;
  /** Short node id of the local node, when connected. */
  nodeId?: string;
  /** Block height, when connected. */
  height?: number;
}

type Listener = () => void;

export class DriveStore {
  core!: DriveCore;
  snapshot: TreeSnapshot = { nodes: new Map(), children: new Map() };
  cwd: NodeId = ROOT;
  selection = new Set<NodeId>();
  connection: ConnectionState = { backend: "memory" };

  private readonly listeners = new Set<Listener>();

  /**
   * Initialize: probe a local CE node for the blob backend, else fall back to memory; then
   * construct the DriveCore (mock adapter) and seed a demo tree.
   *
   * In dev, `/ce` is proxied to `http://127.0.0.1:8844` (vite.config.ts) so the browser is
   * same-origin. In production behind a reverse proxy, the same `/ce` path resolves to the
   * local node. The node's read endpoints (`/blobs/:hash`) are unauthenticated; writes use
   * the discovered API token where available.
   */
  async init(): Promise<void> {
    const probe = await this.probeNode();
    let blobs: BlobBackend;
    let selfId: string;
    if (probe) {
      blobs = new NodeBlobBackend(probe.client.data);
      selfId = probe.nodeId;
      this.connection = { backend: "node", nodeId: short(probe.nodeId), height: probe.height };
    } else {
      blobs = new MemoryBlobBackend();
      selfId = "local-demo";
      this.connection = { backend: "memory" };
    }
    const core = new MockDriveCore(blobs, selfId);
    core.onChange(() => void this.refresh());
    await core.seedDemo();
    this.core = core;
    await this.refresh();
  }

  /** Try to reach a local node via the `/ce` proxy path. Returns null if unreachable. */
  private async probeNode(): Promise<{ client: CeClient; nodeId: string; height: number } | null> {
    try {
      // Same-origin proxy path; no token needed for `/status`.
      const client = CeClient.withToken(`${location.origin}/ce`);
      const status = (await Promise.race([
        client.getStatus(),
        timeout(1500),
      ])) as Awaited<ReturnType<CeClient["getStatus"]>>;
      return { client, nodeId: status.nodeId, height: status.height };
    } catch {
      return null;
    }
  }

  /** Re-resolve the converged tree from the core and notify subscribers. */
  async refresh(): Promise<void> {
    this.snapshot = await this.core.tree();
    // Drop selections / cwd that no longer exist (e.g. after trash/purge).
    if (this.cwd !== ROOT && !this.snapshot.nodes.has(this.cwd)) this.cwd = ROOT;
    for (const id of [...this.selection]) {
      if (!this.snapshot.nodes.has(id)) this.selection.delete(id);
    }
    this.emit();
  }

  /** Children of the current working directory, ordered (dirs first, name-sorted). */
  currentChildren(): NodeId[] {
    return this.snapshot.children.get(this.cwd) ?? [];
  }

  /** The breadcrumb chain from ROOT to cwd. */
  breadcrumb(): { id: NodeId; name: string }[] {
    const chain: { id: NodeId; name: string }[] = [{ id: ROOT, name: "My Drive" }];
    const parts: { id: NodeId; name: string }[] = [];
    let cur = this.snapshot.nodes.get(this.cwd);
    let guard = 0;
    while (cur && guard++ < 4096) {
      parts.unshift({ id: cur.id, name: cur.name });
      const parent = this.snapshot.nodes.get(cur.parent);
      if (!parent) break;
      cur = parent;
    }
    return [...chain, ...parts];
  }

  navigate(id: NodeId): void {
    this.cwd = id;
    this.selection.clear();
    this.emit();
  }

  select(id: NodeId, additive = false): void {
    if (!additive) this.selection.clear();
    if (this.selection.has(id) && additive) this.selection.delete(id);
    else this.selection.add(id);
    this.emit();
  }

  clearSelection(): void {
    this.selection.clear();
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Force a re-render without re-resolving the tree (e.g. sidebar expand/collapse). */
  subscribeNotify(): void {
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

function short(id: string): string {
  return id.length > 12 ? `${id.slice(0, 10)}…` : id;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}
