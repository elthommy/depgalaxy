import { useMemo } from "react";
import { DYNAMIC_EDGE, MUTED, PACK_ACCENT, STATIC_EDGE, kindColor, withAlpha } from "../palette";
import { useGalaxyStore } from "../store";

const FULL_DEPTH = 6; // slider max = "full graph" (no depth limit)

/** Bottom-left: node-kind / edge / pack legend + depth filter slider. */
export default function LegendPanel() {
  const view = useGalaxyStore((s) => s.view);
  const depth = useGalaxyStore((s) => s.depth);
  const setDepth = useGalaxyStore((s) => s.setDepth);
  const root = useGalaxyStore((s) => s.root);
  const setRoot = useGalaxyStore((s) => s.setRoot);
  const selectedId = useGalaxyStore((s) => s.selectedId);

  const kinds = useMemo(() => {
    const seen = new Set<string>();
    for (const n of view?.nodes ?? []) {
      if (!n.is_pack) seen.add(n.kind);
    }
    return [...seen].sort().slice(0, 6);
  }, [view]);

  const rootLabel = useMemo(
    () => view?.nodes.find((n) => n.id === root)?.label ?? root,
    [view, root],
  );

  const selectedLabel = useMemo(
    () => view?.nodes.find((n) => n.id === selectedId)?.label ?? selectedId,
    [view, selectedId],
  );

  const sliderValue = depth === null ? FULL_DEPTH : Math.min(depth, FULL_DEPTH);

  return (
    <div
      className="glass"
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        width: 264,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        borderRadius: 16,
        padding: 16,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="section-title">Node kinds</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "7px 12px",
            fontSize: 12,
          }}
        >
          {kinds.map((kind) => (
            <div key={kind} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: kindColor(kind),
                  boxShadow: `0 0 8px ${kindColor(kind)}`,
                }}
              />
              {kind}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="section-title">Edges · depends_on</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 26,
                borderTop: `2px solid ${DYNAMIC_EDGE}`,
                boxShadow: `0 0 6px ${withAlpha(DYNAMIC_EDGE, 0.7)}`,
              }}
            />
            dynamic link
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 26,
                borderTop: `2px dashed ${STATIC_EDGE}`,
                boxShadow: `0 0 6px ${withAlpha(STATIC_EDGE, 0.5)}`,
              }}
            />
            static link
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="section-title">Packs</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: `radial-gradient(circle, #fff 0%, ${PACK_ACCENT} 45%, transparent 75%)`,
                flex: "none",
                margin: "0 7px",
              }}
            />
            collapsed · orb
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${withAlpha(PACK_ACCENT, 0.5)}, transparent 70%)`,
                flex: "none",
                margin: "0 2px",
              }}
            />
            expanded · nebula
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          borderTop: "1px solid rgba(148,163,205,0.12)",
          paddingTop: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="section-title">Depth filter</div>
          <div className="mono" style={{ fontSize: 11, color: DYNAMIC_EDGE }}>
            {depth === null ? "full graph" : `${depth} level${depth === 1 ? "" : "s"}`}
          </div>
        </div>
        <input
          type="range"
          min={1}
          max={FULL_DEPTH}
          step={1}
          value={sliderValue}
          onChange={(e) => {
            const v = Number(e.target.value);
            setDepth(v === FULL_DEPTH ? null : v);
          }}
          style={{ width: "100%", accentColor: DYNAMIC_EDGE, height: 14, cursor: "pointer" }}
        />
        <div
          className="mono"
          style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: MUTED }}
        >
          <span>direct</span>
          <span>full graph</span>
        </div>
        {root !== null ? (
          <div style={{ fontSize: 11, color: MUTED, display: "flex", alignItems: "center", gap: 6 }}>
            <span>
              root: <span style={{ color: "#a5f3fc" }}>{rootLabel}</span>
            </span>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setRoot(null);
              }}
            >
              ✕ clear
            </a>
          </div>
        ) : depth !== null && selectedId !== null ? (
          <div style={{ fontSize: 11, color: MUTED }}>
            relative to: <span style={{ color: "#a5f3fc" }}>{selectedLabel}</span>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: MUTED }}>scope: global · top-level nodes</div>
        )}
      </div>
    </div>
  );
}
