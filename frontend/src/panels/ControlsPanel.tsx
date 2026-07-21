import { useMemo } from "react";
import type { FGMethods } from "../GalaxyCanvas";
import { MUTED, PACK_ACCENT, TEXT, withAlpha } from "../palette";
import { useGalaxyStore } from "../store";

/** Bottom-right: collapse-all toggle, rotation/zoom controls, live stats. */
export default function ControlsPanel({
  fgRef,
}: {
  fgRef: React.MutableRefObject<FGMethods | undefined>;
}) {
  const view = useGalaxyStore((s) => s.view);
  const collapsed = useGalaxyStore((s) => s.collapsed);
  const collapseAll = useGalaxyStore((s) => s.collapseAll);
  const expandAll = useGalaxyStore((s) => s.expandAll);
  const autoRotate = useGalaxyStore((s) => s.autoRotate);
  const setAutoRotate = useGalaxyStore((s) => s.setAutoRotate);

  const allCollapsed = useMemo(() => {
    const packs = (view?.nodes ?? []).filter((n) => n.is_pack);
    return packs.length > 0 && packs.every((p) => collapsed.includes(p.id));
  }, [view, collapsed]);

  const nodeCount = view?.nodes.length ?? 0;
  const edgeCount = view?.edges.length ?? 0;

  const zoomBy = (factor: number) => {
    const fg = fgRef.current;
    if (!fg) return;
    const p = fg.camera().position;
    fg.cameraPosition({ x: p.x * factor, y: p.y * factor, z: p.z * factor }, undefined, 300);
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        right: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 10,
        zIndex: 10,
      }}
    >
      <div
        className="glass"
        onClick={() => (allCollapsed ? expandAll() : collapseAll())}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          borderRadius: 12,
          padding: "10px 14px",
        }}
      >
        <span style={{ fontSize: 12, color: TEXT }}>Collapse all Packs</span>
        <span
          style={{
            position: "relative",
            width: 34,
            height: 18,
            borderRadius: 9,
            background: allCollapsed ? withAlpha(PACK_ACCENT, 0.6) : "rgba(148,163,205,0.25)",
            transition: "background 0.2s",
            flex: "none",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: allCollapsed ? 18 : 2,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: TEXT,
              transition: "left 0.2s",
              boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          />
        </span>
      </div>

      <div className="glass" style={{ display: "flex", flexDirection: "column", borderRadius: 12, overflow: "hidden" }}>
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          title={autoRotate ? "Pause rotation" : "Play rotation"}
          className="ghost-button"
          style={{ width: 42, height: 40, color: autoRotate ? TEXT : "#22d3ee", fontSize: 13 }}
        >
          {autoRotate ? "❚❚" : "▶"}
        </button>
        <button
          onClick={() => zoomBy(0.8)}
          title="Zoom in"
          className="ghost-button"
          style={{
            width: 42,
            height: 40,
            borderTop: "1px solid rgba(148,163,205,0.12)",
            fontSize: 17,
          }}
        >
          +
        </button>
        <button
          onClick={() => zoomBy(1.25)}
          title="Zoom out"
          className="ghost-button"
          style={{
            width: 42,
            height: 40,
            borderTop: "1px solid rgba(148,163,205,0.12)",
            fontSize: 17,
          }}
        >
          −
        </button>
        <button
          onClick={() => fgRef.current?.zoomToFit(800, 40)}
          title="Fit to view"
          className="ghost-button"
          style={{
            width: 42,
            height: 40,
            borderTop: "1px solid rgba(148,163,205,0.12)",
            color: MUTED,
            fontSize: 13,
          }}
        >
          ⤢
        </button>
      </div>

      <div className="mono" style={{ fontSize: 10, color: MUTED, paddingRight: 4 }}>
        {nodeCount.toLocaleString("en-US")} nodes · {edgeCount.toLocaleString("en-US")} edges ·{" "}
        <span style={{ color: "#4ade80", animation: "blink 2.4s infinite" }}>●</span> live
      </div>
    </div>
  );
}
