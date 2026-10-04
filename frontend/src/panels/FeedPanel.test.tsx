import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { useGalaxyStore } from "../store";
import type { FeedInfo } from "../types";
import FeedPanel from "./FeedPanel";

const FEEDS: FeedInfo[] = [
  { id: "pacman-core", label: "pacman core", description: "", kind: "pacman", available: false },
  { id: "demo", label: "Demo galaxy", description: "", kind: "demo", available: true },
];

describe("FeedPanel", () => {
  it("preselects the first available feed and marks the others", async () => {
    vi.spyOn(api, "fetchFeeds").mockResolvedValue(FEEDS);
    render(<FeedPanel />);
    expect(await screen.findByRole("combobox")).toHaveValue("demo");
    expect(screen.getByText("pacman core (unavailable)")).toBeDisabled();
  });

  it("runs the feed after confirmation and reloads the graph", async () => {
    vi.spyOn(api, "fetchFeeds").mockResolvedValue(FEEDS);
    const runFeed = vi.spyOn(api, "runFeed").mockResolvedValue({ nodes: 3, edges: 2, packs: 0 });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<FeedPanel />);

    await userEvent.click(await screen.findByRole("button", { name: "Load" }));
    expect(runFeed).toHaveBeenCalledWith("demo");
    await vi.waitFor(() => expect(useGalaxyStore.getState().graphEpoch).toBe(1));
  });

  it("does nothing when the confirmation is declined", async () => {
    vi.spyOn(api, "fetchFeeds").mockResolvedValue(FEEDS);
    const runFeed = vi.spyOn(api, "runFeed");
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<FeedPanel />);

    await userEvent.click(await screen.findByRole("button", { name: "Load" }));
    expect(runFeed).not.toHaveBeenCalled();
  });

  it("shows the error when feeds cannot be listed", async () => {
    vi.spyOn(api, "fetchFeeds").mockRejectedValue(new Error("500: boom"));
    render(<FeedPanel />);
    expect(await screen.findByText("500: boom")).toBeInTheDocument();
  });
});
