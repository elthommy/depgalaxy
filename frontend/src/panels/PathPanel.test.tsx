import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useGalaxyStore } from "../store";
import { node, pathResult, sampleView } from "../test/fixtures";
import type { NodeRef, PathResult } from "../types";
import PathPanel from "./PathPanel";

const ENDS = { source: "curl", target: "libz" };

function ref(id: string): NodeRef {
  return { id, label: id, kind: "library" };
}

/** A forward result listing `count` two-hop paths curl -> mid<i> -> libz. */
function manyPaths(count: number, listed = count): PathResult {
  return {
    ...pathResult("curl", "libz"),
    hops: 2,
    path_count: count,
    paths: Array.from({ length: listed }, (_, i) => [ref("curl"), ref(`mid${i}`), ref("libz")]),
    truncated: count > listed,
  };
}

function showPath(path: PathResult | null, extra: object = {}) {
  useGalaxyStore.setState({ view: sampleView(), pathEnds: ENDS, path, ...extra });
  render(<PathPanel />);
}

describe("PathPanel", () => {
  it("renders nothing without a path search", () => {
    const { container } = render(<PathPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the ends while searching", () => {
    showPath(null);
    expect(screen.getByText(/curl/)).toHaveTextContent("curl ⇢ libz");
    expect(screen.getByText("searching…")).toBeInTheDocument();
  });

  it("shows the summary and the hops of a forward path", () => {
    showPath(pathResult("curl", "libz"));
    expect(screen.getByText("1 hop · 1 shortest path")).toBeInTheDocument();
    const row = screen.getByTestId("path-row");
    expect(row).toHaveTextContent("curl→libz");
    expect(screen.queryByText(/reverse/)).not.toBeInTheDocument();
  });

  it("explains a reverse path", () => {
    // no curl -> libz path, but libz depends on curl
    showPath({ ...pathResult("curl", "libz"), direction: "reverse" });
    expect(screen.getByText("reverse: libz depends on curl")).toBeInTheDocument();
  });

  it("says when no path exists", () => {
    const none = { direction: null, hops: null, path_count: 0, paths: [] };
    showPath({ ...pathResult("curl", "libz"), ...none });
    expect(screen.getByText("No dependency path between curl and libz.")).toBeInTheDocument();
  });

  it("shows the error message", () => {
    showPath(null, { pathError: "400: source and target overlap" });
    expect(screen.getByText("400: source and target overlap")).toBeInTheDocument();
    expect(screen.queryByText("searching…")).not.toBeInTheDocument();
  });

  it("flies to a hop when clicked, keeping the path", async () => {
    showPath(pathResult("curl", "libz"));
    await userEvent.click(within(screen.getByTestId("path-row")).getByText("libz"));
    expect(useGalaxyStore.getState().focus?.id).toBe("libz");
    expect(useGalaxyStore.getState().pathEnds).toEqual(ENDS);
  });

  it("lists 3 paths, then all listed ones on demand", async () => {
    showPath(manyPaths(25, 10));
    expect(screen.getByText("2 hops · 25 shortest paths")).toBeInTheDocument();
    expect(screen.getAllByTestId("path-row")).toHaveLength(3);

    await userEvent.click(screen.getByText("+ 7 more"));
    expect(screen.getAllByTestId("path-row")).toHaveLength(10);
    expect(screen.getByText(/showing the first 10/)).toBeInTheDocument();
  });

  it("caps a huge path count", () => {
    showPath(manyPaths(123456, 10));
    expect(screen.getByText("2 hops · 1,000+ shortest paths")).toBeInTheDocument();
  });

  it("offers to lift the depth filter when path nodes are hidden", async () => {
    // libssl is on the path but missing from the sliced view
    const view = { nodes: [node("curl"), node("libz")], edges: [] };
    const path = { ...pathResult("curl", "libz"), highlight_nodes: ["curl", "libssl", "libz"] };
    useGalaxyStore.setState({ pathEnds: ENDS, path, depth: 1, root: "curl" });
    render(<PathPanel />);
    useGalaxyStore.setState({ view });

    const hint = await screen.findByText(/1 node on the path hidden by the isolation/);
    expect(hint).toBeInTheDocument();
    await userEvent.click(screen.getByText("show full graph"));
    expect([useGalaxyStore.getState().depth, useGalaxyStore.getState().root]).toEqual([null, null]);
  });

  it("does not show the hint without a depth filter", () => {
    const path = { ...pathResult("curl", "libz"), highlight_nodes: ["curl", "gone", "libz"] };
    showPath(path);
    expect(screen.queryByText(/hidden by/)).not.toBeInTheDocument();
  });

  it("clears the path", async () => {
    showPath(pathResult("curl", "libz"));
    await userEvent.click(screen.getByTitle("Clear path"));
    expect(useGalaxyStore.getState().pathEnds).toBeNull();
    expect(screen.queryByText("Path")).not.toBeInTheDocument();
  });
});
