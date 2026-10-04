import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { useGalaxyStore } from "../store";
import type { NodeDetails } from "../types";
import DetailPanel from "./DetailPanel";

const CURL: NodeDetails = {
  id: "curl",
  label: "curl",
  kind: "binary",
  attrs: { version: "8.9.1" },
  is_pack: false,
  parent: null,
  members: [],
  deps: [
    { id: "libssl", label: "libssl", kind: "library", link_type: "hard" },
    { id: "wget", label: "wget", kind: "binary", link_type: "conflicts" },
  ],
  reverse_deps: [{ id: "git", label: "git", kind: "binary", link_type: "optional" }],
  edges_in: 1,
  edges_out: 2,
  edge_attrs: {},
  hops_deep: 3,
};

describe("DetailPanel", () => {
  it("renders nothing without a selection", () => {
    const { container } = render(<DetailPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the selected node with conflicts split from dependencies", async () => {
    const fetchNode = vi.spyOn(api, "fetchNode").mockResolvedValue(CURL);
    useGalaxyStore.setState({ selectedId: "curl" });
    render(<DetailPanel />);

    expect(await screen.findByText("Direct dependencies · 1")).toBeInTheDocument();
    expect(fetchNode).toHaveBeenCalledWith("curl");
    expect(screen.getByText("Reverse dependencies · 1")).toBeInTheDocument();
    expect(screen.getByText("Conflicts · 1")).toBeInTheDocument();
    expect(screen.getByText("HOPS DEEP").previousSibling).toHaveTextContent("3");
    expect(screen.getByText("DEPS").previousSibling).toHaveTextContent("1");
  });

  it("starts and cancels a path search from the selected node", async () => {
    vi.spyOn(api, "fetchNode").mockResolvedValue(CURL);
    useGalaxyStore.setState({ selectedId: "curl" });
    render(<DetailPanel />);

    await userEvent.click(await screen.findByRole("button", { name: "Path to…" }));
    expect(useGalaxyStore.getState().pathFrom).toBe("curl");

    await userEvent.click(screen.getByRole("button", { name: "Cancel path search" }));
    expect(useGalaxyStore.getState().pathFrom).toBeNull();
  });
});
