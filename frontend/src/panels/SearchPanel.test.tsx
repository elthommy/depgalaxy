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
});
