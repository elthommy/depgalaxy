import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as api from "./api";
import { useGalaxyStore } from "./store";
import { pathResult } from "./test/fixtures";
import { usePath } from "./usePath";

const store = () => useGalaxyStore.getState();

describe("usePath", () => {
  it("does not fetch until a target is picked", () => {
    const fetchPath = vi.spyOn(api, "fetchPath");
    renderHook(() => usePath());
    act(() => store().startPathPick("a"));
    expect(fetchPath).not.toHaveBeenCalled();
  });

  it("fetches the picked pair and stores the result", async () => {
    const fetchPath = vi.spyOn(api, "fetchPath").mockResolvedValue(pathResult("a", "b"));
    renderHook(() => usePath());
    act(() => {
      store().startPathPick("a");
      store().pickPathTarget("b");
    });
    expect(fetchPath).toHaveBeenCalledWith("a", "b", []);
    await waitFor(() => expect(store().path?.target).toBe("b"));
  });

  it("refetches when packs are collapsed", async () => {
    const fetchPath = vi.spyOn(api, "fetchPath").mockResolvedValue(pathResult("a", "b"));
    useGalaxyStore.setState({ pathEnds: { source: "a", target: "b" } });
    renderHook(() => usePath());
    act(() => store().togglePack("pack:net"));
    await waitFor(() => expect(fetchPath).toHaveBeenLastCalledWith("a", "b", ["pack:net"]));
    expect(fetchPath).toHaveBeenCalledTimes(2);
  });

  it("stores the error message on failure", async () => {
    vi.spyOn(api, "fetchPath").mockRejectedValue(new Error("400: source and target overlap"));
    useGalaxyStore.setState({ pathEnds: { source: "a", target: "a" } });
    renderHook(() => usePath());
    await waitFor(() => expect(store().pathError).toBe("400: source and target overlap"));
  });

  it("ignores a response that arrives after the path was cleared", async () => {
    let resolve: (value: ReturnType<typeof pathResult>) => void = () => {};
    vi.spyOn(api, "fetchPath").mockReturnValue(new Promise((r) => (resolve = r)));
    useGalaxyStore.setState({ pathEnds: { source: "a", target: "b" } });
    renderHook(() => usePath());
    act(() => store().clearPath());
    await act(async () => resolve(pathResult("a", "b")));
    expect(store().path).toBeNull();
  });
});
