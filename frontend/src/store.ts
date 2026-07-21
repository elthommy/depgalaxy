import { create } from "zustand";
import type { GraphView } from "./types";

interface GalaxyState {
  // view parameters (drive /graph refetches)
  collapsed: string[];
  depth: number | null;
  root: string | null;
  // ui state
  selectedId: string | null;
  focus: { id: string; seq: number } | null;
  autoRotate: boolean;
  // last fetched view (shared by canvas + panels)
  view: GraphView | null;
  viewError: string | null;

  togglePack: (id: string) => void;
  collapseAll: () => void;
  expandAll: () => void;
  setDepth: (depth: number | null) => void;
  setRoot: (root: string | null) => void;
  select: (id: string | null) => void;
  focusNode: (id: string) => void;
  setAutoRotate: (on: boolean) => void;
  setView: (view: GraphView) => void;
  setViewError: (error: string | null) => void;
}

export const useGalaxyStore = create<GalaxyState>((set, get) => ({
  collapsed: [],
  depth: null,
  root: null,
  selectedId: null,
  focus: null,
  autoRotate: true,
  view: null,
  viewError: null,

  togglePack: (id) =>
    set((state) => ({
      collapsed: state.collapsed.includes(id)
        ? state.collapsed.filter((c) => c !== id)
        : [...state.collapsed, id],
    })),
  // union with the current set: packs nested inside an already-collapsed
  // pack are absent from the view but must stay collapsed
  collapseAll: () => {
    const { view, collapsed } = get();
    const packs = (view?.nodes ?? []).filter((n) => n.is_pack).map((n) => n.id);
    set({ collapsed: [...new Set([...collapsed, ...packs])] });
  },
  expandAll: () => set({ collapsed: [] }),
  setDepth: (depth) => set({ depth }),
  setRoot: (root) => set({ root }),
  select: (id) => set({ selectedId: id }),
  focusNode: (id) =>
    set((state) => ({ selectedId: id, focus: { id, seq: (state.focus?.seq ?? 0) + 1 } })),
  setAutoRotate: (on) => set({ autoRotate: on }),
  setView: (view) => set({ view, viewError: null }),
  setViewError: (error) => set({ viewError: error }),
}));
