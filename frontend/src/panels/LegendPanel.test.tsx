import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGalaxyStore } from "../store";
import { sampleView } from "../test/fixtures";
import LegendPanel from "./LegendPanel";

describe("LegendPanel", () => {
  it("lists node kinds and link types present in the view", () => {
    useGalaxyStore.setState({ view: sampleView() });
    render(<LegendPanel />);
    expect(screen.getByText("library")).toBeInTheDocument();
    expect(screen.getByText("binary")).toBeInTheDocument();
    // packs are not a node kind
    expect(screen.queryByText("pack")).not.toBeInTheDocument();
    expect(screen.getByText("dynamic link")).toBeInTheDocument();
    expect(screen.getByText("static link")).toBeInTheDocument();
    expect(screen.queryByText("conflicts")).not.toBeInTheDocument();
  });

  it("maps the depth slider to the store, max meaning full graph", () => {
    render(<LegendPanel />);
    const slider = screen.getByRole("slider");

    fireEvent.change(slider, { target: { value: "2" } });
    expect(useGalaxyStore.getState().depth).toBe(2);
    expect(screen.getByText("2 levels")).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "6" } });
    expect(useGalaxyStore.getState().depth).toBeNull();
  });
});
