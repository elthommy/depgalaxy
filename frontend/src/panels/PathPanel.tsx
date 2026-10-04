import { useState } from "react";
import { DYNAMIC_EDGE, MUTED, TEXT, kindColor } from "../palette";
import { useGalaxyStore } from "../store";
import type { NodeRef, PathResult } from "../types";

const SHOWN_PATHS = 3;
const MAX_SHOWN_COUNT = 1000;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** "3 hops · 2 shortest paths", the count capped at "1,000+". */
function summary(path: PathResult): string {
  const n = path.path_count;
  const count =
    n > MAX_SHOWN_COUNT
      ? `${MAX_SHOWN_COUNT.toLocaleString("en-US")}+ shortest paths`
      : `${n.toLocaleString("en-US")} shortest path${n === 1 ? "" : "s"}`;
  return `${plural(path.hops ?? 0, "hop")} · ${count}`;
}

function HopChip({ hop }: { hop: NodeRef }) {
  const focusNode = useGalaxyStore((s) => s.focusNode);
  const color = kindColor(hop.kind);
  return (
    <span
      className="hover-row"
      onClick={() => focusNode(hop.id)}
      title={`${hop.label} · ${hop.kind}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 6px" }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}`,
          flex: "none",
        }}
      />
      {hop.label}
    </span>
  );
}

function PathRow({ hops }: { hops: NodeRef[] }) {
  return (
    <div
      data-testid="path-row"
      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, fontSize: 12 }}
    >
      {hops.map((hop, i) => (
        <span key={hop.id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
          {i > 0 && <span style={{ color: DYNAMIC_EDGE }}>→</span>}
          <HopChip hop={hop} />
        </span>
      ))}
    </div>
  );
}

/** Hint shown when nodes on the path are hidden by the depth filter or isolation. */
function HiddenHint({ path }: { path: PathResult }) {
  const view = useGalaxyStore((s) => s.view);
  const depth = useGalaxyStore((s) => s.depth);
  const root = useGalaxyStore((s) => s.root);
  const setDepth = useGalaxyStore((s) => s.setDepth);
  const setRoot = useGalaxyStore((s) => s.setRoot);
  if (!view || (depth === null && root === null)) return null;
  const visible = new Set(view.nodes.map((n) => n.id));
  const hidden = path.highlight_nodes.filter((id) => !visible.has(id)).length;
  if (hidden === 0) return null;
  return (
    <div style={{ fontSize: 11, color: MUTED }}>
      {plural(hidden, "node")} on the path hidden by the{" "}
      {root !== null ? "isolation" : "depth filter"} ·{" "}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setDepth(null);
          setRoot(null);
        }}
      >
        show full graph
      </a>
    </div>
  );
}

function PathBody({ path, label }: { path: PathResult; label: (id: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  if (path.direction === null) {
    return (
      <div style={{ fontSize: 12, color: MUTED }}>
        No dependency path between {label(path.source)} and {label(path.target)}.
      </div>
    );
  }
  const shown = expanded ? path.paths : path.paths.slice(0, SHOWN_PATHS);
  return (
    <>
      <div className="mono" style={{ fontSize: 12, color: DYNAMIC_EDGE }}>
        {summary(path)}
      </div>
      {path.direction === "reverse" && (
        <div style={{ fontSize: 11, color: MUTED }}>
          reverse: {label(path.target)} depends on {label(path.source)}
        </div>
      )}
      {shown.map((hops, i) => (
        <PathRow key={i} hops={hops} />
      ))}
      {path.paths.length > SHOWN_PATHS && (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setExpanded(!expanded);
          }}
          style={{ fontSize: 12 }}
        >
          {expanded ? "− show less" : `+ ${path.paths.length - SHOWN_PATHS} more`}
        </a>
      )}
      {expanded && path.truncated && (
        <div style={{ fontSize: 11, color: MUTED }}>
          showing the first {path.paths.length}; all of them are highlighted
        </div>
      )}
      <HiddenHint path={path} />
    </>
  );
}

/** Right column, above the Selection panel: result of the current path search. */
export default function PathPanel() {
  const pathEnds = useGalaxyStore((s) => s.pathEnds);
  const path = useGalaxyStore((s) => s.path);
  const pathError = useGalaxyStore((s) => s.pathError);
  const view = useGalaxyStore((s) => s.view);
  const clearPath = useGalaxyStore((s) => s.clearPath);
  if (pathEnds === null) return null;

  const label = (id: string) => view?.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <div
      className="glass"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderRadius: 16,
        padding: "12px 16px",
        maxHeight: "40vh",
        overflowY: "auto",
        flex: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="section-title">Path</div>
        <button
          onClick={clearPath}
          title="Clear path"
          className="ghost-button"
          style={{ color: MUTED, fontSize: 14, padding: 4, background: "transparent" }}
        >
          ✕
        </button>
      </div>
      <div style={{ fontSize: 14, color: TEXT }}>
        {label(pathEnds.source)} <span style={{ color: DYNAMIC_EDGE }}>⇢</span>{" "}
        {label(pathEnds.target)}
      </div>
      {pathError !== null ? (
        <div style={{ fontSize: 11, color: "#fca5a5" }}>{pathError}</div>
      ) : path === null ? (
        <div style={{ fontSize: 12, color: MUTED }}>searching…</div>
      ) : (
        <PathBody path={path} label={label} />
      )}
    </div>
  );
}
