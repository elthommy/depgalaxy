import { create } from "zustand";

interface GalaxyState {
  collapsed: string[];
  depth: number | null;
  root: string | null;
  selectedId: string | null;
  togglePack: (id: string) => void;
  setCollapsed: (ids: string[]) => void;
  setDepth: (depth: number | null) => void;
  setRoot: (root: string | null) => void;
  select: (id: string | null) => void;
}

export const useGalaxyStore = create<GalaxyState>((set) => ({
  collapsed: [],
  depth: null,
  root: null,
  selectedId: null,
  togglePack: (id) =>
    set((state) => ({
      collapsed: state.collapsed.includes(id)
        ? state.collapsed.filter((c) => c !== id)
        : [...state.collapsed, id],
    })),
  setCollapsed: (ids) => set({ collapsed: ids }),
  setDepth: (depth) => set({ depth }),
  setRoot: (root) => set({ root }),
  select: (id) => set({ selectedId: id }),
}));
