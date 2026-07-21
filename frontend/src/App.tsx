import { useRef } from "react";
import GalaxyCanvas from "./GalaxyCanvas";
import type { FGMethods } from "./GalaxyCanvas";
import ControlsPanel from "./panels/ControlsPanel";
import DetailPanel from "./panels/DetailPanel";
import LegendPanel from "./panels/LegendPanel";
import SearchPanel from "./panels/SearchPanel";
import { useGraphView } from "./useGraphView";
import "./ui.css";

export default function App() {
  useGraphView();
  const fgRef = useRef<FGMethods | undefined>(undefined);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <GalaxyCanvas fgRef={fgRef} />
      <div className="bg-tint" />
      <SearchPanel />
      <DetailPanel />
      <LegendPanel />
      <ControlsPanel fgRef={fgRef} />
    </div>
  );
}
