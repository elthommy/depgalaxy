import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { useGalaxyStore } from "../store";

const initialStore = useGalaxyStore.getState();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // zustand stores are module singletons: reset between tests
  useGalaxyStore.setState(initialStore, true);
});
