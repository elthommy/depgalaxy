import { create } from "zustand";
import type { GraphView } from "./types";

interface GalaxyState {
  // view parameters (drive /graph refetches)
  collapsed: string[];
  depth: number | null;
  // explicit isolation root; when null and a depth limit is active, the
  // selected node (if any) becomes the slice root, else the slice is global
  root: string | null;
  // bumped when a feed replaces the server-side graph, to force a refetch
  graphEpoch: number;
  // ui state
  selectedId: string | null;
  focus: { id: string; seq: number } | null;
  autoRotate: boolean;
  showLabels: boolean;
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
  setShowLabels: (on: boolean) => void;
  setView: (view: GraphView) => void;
  setViewError: (error: string | null) => void;
  loadNewGraph: () => void;
}

export const useGalaxyStore = create<GalaxyState>((set, get) => ({
  collapsed: [],
  depth: null,
  root: null,
  graphEpoch: 0,
  selectedId: null,
  focus: null,
  autoRotate: true,
  showLabels: false,
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
  setShowLabels: (on) => set({ showLabels: on }),
  setView: (view) => set({ view, viewError: null }),
  setViewError: (error) => set({ viewError: error }),
  // reset every view parameter tied to the replaced graph and refetch
  loadNewGraph: () =>
    set((state) => ({
      collapsed: [],
      depth: null,
      root: null,
      selectedId: null,
      focus: null,
      graphEpoch: state.graphEpoch + 1,
    })),
}));
