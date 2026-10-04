import { useRef } from "react";
import GalaxyCanvas from "./GalaxyCanvas";
import type { FGMethods } from "./GalaxyCanvas";
import ControlsPanel from "./panels/ControlsPanel";
import DetailPanel from "./panels/DetailPanel";
import FeedPanel from "./panels/FeedPanel";
import LegendPanel from "./panels/LegendPanel";
import PathPanel from "./panels/PathPanel";
import SearchPanel from "./panels/SearchPanel";
import { useGraphView } from "./useGraphView";
import { usePath } from "./usePath";
import "./ui.css";

export default function App() {
  useGraphView();
  usePath();
  const fgRef = useRef<FGMethods | undefined>(undefined);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <GalaxyCanvas fgRef={fgRef} />
      <div className="bg-tint" />
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          width: 320,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 10,
        }}
      >
        <SearchPanel />
        <FeedPanel />
      </div>
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          width: 326,
          // stop above the bottom-right controls (~306px tall incl. margin)
          maxHeight: "calc(100vh - 340px)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 10,
        }}
      >
        <PathPanel />
        <DetailPanel />
      </div>
      <LegendPanel />
      <ControlsPanel fgRef={fgRef} />
    </div>
  );
}
