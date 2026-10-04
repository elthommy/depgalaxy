import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useGalaxyStore } from "../store";
import { sampleView } from "../test/fixtures";
import SearchPanel from "./SearchPanel";

describe("SearchPanel", () => {
  it("suggests matching nodes and focuses the clicked one", async () => {
    useGalaxyStore.setState({ view: sampleView() });
    render(<SearchPanel />);
    const input = screen.getByPlaceholderText(/search nodes/i);

    await userEvent.type(input, "LIB");
    expect(screen.getByText("libssl")).toBeInTheDocument();
    expect(screen.getByText("libz")).toBeInTheDocument();
    expect(screen.queryByText("curl")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("libz"));
    expect(useGalaxyStore.getState().selectedId).toBe("libz");
    expect(input).toHaveValue("");
  });

  it("focuses the field on Ctrl-K", async () => {
    render(<SearchPanel />);
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(screen.getByPlaceholderText(/search nodes/i)).toHaveFocus();
  });

  describe("while picking a path destination", () => {
    it("prompts for the destination and focuses the field", () => {
      useGalaxyStore.setState({ view: sampleView(), pathFrom: "curl" });
      render(<SearchPanel />);
      const input = screen.getByPlaceholderText("Path from curl to…");
      expect(input).toHaveFocus();
      expect(screen.getByText(/click a node in the galaxy/)).toBeInTheDocument();
    });

    it("picks the clicked suggestion as destination instead of focusing it", async () => {
      useGalaxyStore.setState({ view: sampleView(), pathFrom: "curl" });
      render(<SearchPanel />);

      await userEvent.type(screen.getByPlaceholderText("Path from curl to…"), "libz");
      await userEvent.click(screen.getByText("libz"));
      const state = useGalaxyStore.getState();
      expect(state.pathEnds).toEqual({ source: "curl", target: "libz" });
      expect(state.focus).toBeNull();
      expect(screen.getByPlaceholderText(/search nodes/i)).toHaveValue("");
    });

    it("does not suggest the source itself", async () => {
      useGalaxyStore.setState({ view: sampleView(), pathFrom: "libz" });
      render(<SearchPanel />);
      await userEvent.type(screen.getByPlaceholderText("Path from libz to…"), "lib");
      expect(screen.getByText("libssl")).toBeInTheDocument();
      expect(screen.queryByText("libz")).not.toBeInTheDocument();
    });

    it("cancels on Escape", async () => {
      useGalaxyStore.setState({ view: sampleView(), pathFrom: "curl" });
      render(<SearchPanel />);
      await userEvent.keyboard("{Escape}");
      expect(useGalaxyStore.getState().pathFrom).toBeNull();
      expect(screen.getByPlaceholderText(/search nodes/i)).not.toHaveFocus();
    });
  });
});
