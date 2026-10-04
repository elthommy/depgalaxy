import { useEffect, useState } from "react";
import { fetchNode } from "../api";
import {
  DYNAMIC_EDGE,
  LINK_STYLES,
  MUTED,
  PACK_ACCENT,
  PACK_ACCENT_LIGHT,
  TEXT,
  kindColor,
  withAlpha,
} from "../palette";
import { useGalaxyStore } from "../store";
import type { DepRef, NodeDetails } from "../types";

const SHOWN_ROWS = 6;

function KindBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color,
        border: `1px solid ${withAlpha(color, 0.4)}`,
        borderRadius: 5,
        padding: "2px 7px",
        background: withAlpha(color, 0.08),
      }}
    >
      {label}
    </span>
  );
}

function StatTile({
  value,
  label,
  color,
}: {
  value: number | string;
  label: string;
  color?: string;
}) {
  return (
    <div style={{ background: "rgba(148,163,205,0.07)", borderRadius: 10, padding: "10px 12px" }}>
      <div className="mono" style={{ fontSize: 17, color: color ?? TEXT }}>
        {typeof value === "number" ? value.toLocaleString("en-US") : value}
      </div>
      <div style={{ fontSize: 10, color: MUTED, letterSpacing: "0.06em", marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

/** Proportional split bar over the link_type breakdown, styled per LINK_STYLES. */
function LinkTypeBar({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.keys(LINK_STYLES)
    .filter((t) => (counts[t] ?? 0) > 0)
    .map((t) => ({ type: t, style: LINK_STYLES[t], count: counts[t] }));
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  if (total === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="section-title">{title}</div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 2 }}>
        {entries.map(({ type, style, count }) => (
          <div
            key={type}
            style={{
              width: `${(count / total) * 100}%`,
              background: style.dashed
                ? `repeating-linear-gradient(90deg, ${style.color} 0 5px, transparent 5px 9px)`
                : style.color,
              boxShadow: style.dashed ? "none" : `0 0 8px ${withAlpha(style.color, 0.6)}`,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 14px",
          fontSize: 11,
          color: MUTED,
        }}
      >
        {entries.map(({ type, style, count }) => (
          <span key={type}>
            <span style={{ color: style.color }}>{style.dashed ? "◌" : "●"}</span>{" "}
            {style.label.split(" ")[0]} · {count}
          </span>
        ))}
      </div>
    </div>
  );
}

function DepRow({ dep, edgeStub }: { dep: DepRef; edgeStub: boolean }) {
  const focusNode = useGalaxyStore((s) => s.focusNode);
  const color = kindColor(dep.kind);
  const linkStyle = dep.link_type !== null ? LINK_STYLES[dep.link_type] : undefined;
  return (
    <div
      className="hover-row"
      onClick={() => focusNode(dep.id)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px" }}
    >
      {edgeStub && (
        <span
          style={{
            width: 20,
            borderTop: linkStyle
              ? `2px ${linkStyle.dashed ? "dashed" : "solid"} ${linkStyle.color}`
              : "2px solid rgba(148,163,205,0.4)",
            boxShadow: linkStyle
              ? `0 0 6px ${withAlpha(linkStyle.color, linkStyle.dashed ? 0.5 : 0.7)}`
              : "none",
            flex: "none",
          }}
        />
      )}
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
      <span style={{ flex: 1, fontSize: 13 }}>{dep.label}</span>
      <span className="mono" style={{ fontSize: 9, color: MUTED, textTransform: "uppercase" }}>
        {dep.kind}
      </span>
    </div>
  );
}

function DepList({
  title,
  deps,
  edgeStub,
}: {
  title: string;
  deps: DepRef[];
  edgeStub: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (deps.length === 0) return null;
  const shown = expanded ? deps : deps.slice(0, SHOWN_ROWS);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="section-title">
        {title} · {deps.length}
      </div>
      {shown.map((d) => (
        <DepRow key={d.id} dep={d} edgeStub={edgeStub} />
      ))}
      {deps.length > SHOWN_ROWS && (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setExpanded(!expanded);
          }}
          style={{ fontSize: 12, padding: "2px 8px" }}
        >
          {expanded ? "− show less" : `+ ${deps.length - SHOWN_ROWS} more`}
        </a>
      )}
    </div>
  );
}

function ActionButton({
  label,
  accent,
  onClick,
}: {
  label: string;
  accent: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        cursor: "pointer",
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 12,
        padding: "9px 0",
        borderRadius: 9,
        border: accent
          ? `1px solid ${withAlpha(PACK_ACCENT, 0.4)}`
          : "1px solid rgba(148,163,205,0.25)",
        background: accent ? withAlpha(PACK_ACCENT, 0.1) : "transparent",
        color: accent ? PACK_ACCENT_LIGHT : TEXT,
      }}
    >
      {label}
    </button>
  );
}

/** Right column: detail panel fed by /node/{id}, Node and Pack variants. */
export default function DetailPanel() {
  const selectedId = useGalaxyStore((s) => s.selectedId);
  const select = useGalaxyStore((s) => s.select);
  const focusNode = useGalaxyStore((s) => s.focusNode);
  const collapsed = useGalaxyStore((s) => s.collapsed);
  const togglePack = useGalaxyStore((s) => s.togglePack);
  const root = useGalaxyStore((s) => s.root);
  const setRoot = useGalaxyStore((s) => s.setRoot);
  const pathFrom = useGalaxyStore((s) => s.pathFrom);
  const startPathPick = useGalaxyStore((s) => s.startPathPick);
  const cancelPathPick = useGalaxyStore((s) => s.cancelPathPick);
  const [details, setDetails] = useState<NodeDetails | null>(null);

  useEffect(() => {
    if (selectedId === null) {
      setDetails(null);
      return;
    }
    let cancelled = false;
    fetchNode(selectedId)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch(() => {
        if (!cancelled) setDetails(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (selectedId === null || details === null) return null;

  const isPack = details.is_pack;
  const accent = isPack ? PACK_ACCENT : kindColor(details.kind);
  const isCollapsed = collapsed.includes(details.id);
  const isRoot = root === details.id;
  const isPicking = pathFrom === details.id;
  const version = typeof details.attrs.version === "string" ? details.attrs.version : null;

  // conflicts are not dependencies — pull them into their own list
  const deps = details.deps.filter((d) => d.link_type !== "conflicts");
  const reverseDeps = details.reverse_deps.filter((d) => d.link_type !== "conflicts");
  const conflicts = [
    ...new Map(
      [...details.deps, ...details.reverse_deps]
        .filter((d) => d.link_type === "conflicts")
        .map((d) => [d.id, d]),
    ).values(),
  ];

  return (
    <div
      className="glass"
      style={{
        // shrinks inside the right column so its body scrolls
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(148,163,205,0.10)",
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: MUTED, textTransform: "uppercase" }}>
          Selection
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", background: "rgba(148,163,205,0.10)", borderRadius: 8, padding: 2 }}>
            <button
              style={{
                border: "none",
                cursor: "default",
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 6,
                background: !isPack ? "rgba(34,211,238,0.18)" : "transparent",
                color: !isPack ? "#a5f3fc" : MUTED,
              }}
            >
              Node
            </button>
            <button
              onClick={() => {
                if (!isPack && details.parent) focusNode(details.parent.id);
              }}
              title={!isPack && details.parent ? `Open pack ${details.parent.label}` : undefined}
              style={{
                border: "none",
                cursor: !isPack && details.parent ? "pointer" : "default",
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 6,
                background: isPack ? withAlpha(PACK_ACCENT, 0.18) : "transparent",
                color: isPack ? PACK_ACCENT_LIGHT : MUTED,
              }}
            >
              Pack
            </button>
          </div>
          <button
            onClick={() => select(null)}
            title="Close panel"
            className="ghost-button"
            style={{ color: MUTED, fontSize: 14, padding: 4, background: "transparent" }}
          >
            ✕
          </button>
        </div>
      </div>

      <div
        style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <KindBadge label={isPack ? "Pack" : details.kind} color={accent} />
            {isPack ? (
              <span style={{ fontSize: 10, color: PACK_ACCENT, letterSpacing: "0.08em" }}>
                {isCollapsed ? "● collapsed · orb view" : "◍ expanded · nebula view"}
              </span>
            ) : (
              version && (
                <span className="mono" style={{ fontSize: 11, color: MUTED }}>
                  v{version}
                </span>
              )
            )}
          </div>
          <div style={{ fontSize: 21, fontWeight: 500, letterSpacing: "0.01em" }}>
            {details.label}
          </div>
          <div style={{ fontSize: 12, color: MUTED }}>
            {details.kind}
            {details.parent ? (
              <>
                {" · "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    focusNode(details.parent!.id);
                  }}
                >
                  {details.parent.label}
                </a>{" "}
                pack
              </>
            ) : (
              isPack && " · root-level pack"
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {isPack ? (
            <>
              <StatTile value={details.members.length} label="MEMBERS" color={PACK_ACCENT} />
              <StatTile value={details.edges_in} label="EDGES IN" />
              <StatTile value={details.edges_out} label="EDGES OUT" />
            </>
          ) : (
            <>
              <StatTile value={reverseDeps.length} label="DEPENDENTS" color={DYNAMIC_EDGE} />
              <StatTile value={deps.length} label="DEPS" />
              <StatTile value={details.hops_deep ?? "—"} label="HOPS DEEP" />
            </>
          )}
        </div>

        <LinkTypeBar
          title={isPack ? "Aggregated edge attributes" : "Edge attributes"}
          counts={details.edge_attrs.link_type ?? {}}
        />

        {isPack && (
          <DepList
            title="Contained members"
            deps={details.members.map((m) => ({ ...m, link_type: null }))}
            edgeStub={false}
          />
        )}
        <DepList title="Direct dependencies" deps={deps} edgeStub={true} />
        <DepList title="Reverse dependencies" deps={reverseDeps} edgeStub={false} />
        <DepList title="Conflicts" deps={conflicts} edgeStub={true} />

        {isPack && (
          <div style={{ display: "flex", gap: 8 }}>
            <ActionButton
              label={isCollapsed ? "Expand nebula" : "Collapse to orb"}
              accent={true}
              onClick={() => togglePack(details.id)}
            />
            <ActionButton
              label={isRoot ? "Clear isolation" : "Isolate subtree"}
              accent={false}
              onClick={() => setRoot(isRoot ? null : details.id)}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <ActionButton
            label={isPicking ? "Cancel path search" : "Path to…"}
            accent={false}
            onClick={() => (isPicking ? cancelPathPick() : startPathPick(details.id))}
          />
        </div>
      </div>
    </div>
  );
}
