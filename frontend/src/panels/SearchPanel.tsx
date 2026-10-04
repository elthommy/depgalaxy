import { useEffect, useMemo, useRef, useState } from "react";
import { DYNAMIC_EDGE, MUTED, PACK_ACCENT_LIGHT, TEXT, kindColor, withAlpha } from "../palette";
import { useGalaxyStore } from "../store";

/**
 * Top-left: STELLARDEPS wordmark + search with client-side autocomplete.
 * While a path search is in progress, picking a suggestion sets the path destination.
 */
export default function SearchPanel() {
  const view = useGalaxyStore((s) => s.view);
  const focusNode = useGalaxyStore((s) => s.focusNode);
  const pathFrom = useGalaxyStore((s) => s.pathFrom);
  const pickPathTarget = useGalaxyStore((s) => s.pickPathTarget);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K focuses the search field; Esc cancels a path search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && useGalaxyStore.getState().pathFrom !== null) {
        useGalaxyStore.getState().cancelPathPick();
        setQuery("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // a path search starts with an empty, focused field
  useEffect(() => {
    if (pathFrom === null) return;
    setQuery("");
    inputRef.current?.focus();
  }, [pathFrom]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!view || q === "") return [];
    return view.nodes
      .filter((n) => n.id !== pathFrom && n.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [view, query, pathFrom]);

  const fromLabel = view?.nodes.find((n) => n.id === pathFrom)?.label ?? pathFrom;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 4px" }}>
        <div style={{ fontWeight: 600, letterSpacing: "0.22em", fontSize: 14, color: TEXT }}>
          STELLARDEPS
        </div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            color: MUTED,
            textTransform: "uppercase",
          }}
        >
          dependency galaxy
        </div>
      </div>
      <div
        className="glass"
        style={{
          borderRadius: 14,
          overflow: "hidden",
          ...(pathFrom !== null && { borderColor: withAlpha(DYNAMIC_EDGE, 0.6) }),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px" }}>
          <svg width="15" height="15" viewBox="0 0 15 15" style={{ flex: "none", opacity: 0.6 }}>
            <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke={TEXT} strokeWidth="1.4" />
            <line x1="10" y1="10" x2="13.5" y2="13.5" stroke={TEXT} strokeWidth="1.4" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              pathFrom !== null ? `Path from ${fromLabel} to…` : "Search nodes, packs, services…"
            }
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: TEXT,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 14,
              fontWeight: 300,
              letterSpacing: "0.02em",
            }}
          />
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: MUTED,
              border: "1px solid rgba(148,163,205,0.25)",
              borderRadius: 5,
              padding: "2px 6px",
            }}
          >
            ⌘K
          </span>
        </div>
        {pathFrom !== null && suggestions.length === 0 && (
          <div
            style={{
              borderTop: "1px solid rgba(148,163,205,0.12)",
              padding: "8px 14px",
              fontSize: 11,
              color: MUTED,
            }}
          >
            search or click a node in the galaxy · Esc to cancel
          </div>
        )}
        {suggestions.length > 0 && (
          <div style={{ borderTop: "1px solid rgba(148,163,205,0.12)", padding: 6 }}>
            {suggestions.map((s) => {
              const color = s.is_pack ? PACK_ACCENT_LIGHT : kindColor(s.kind);
              return (
                <div
                  key={s.id}
                  className="hover-row"
                  onClick={() => {
                    if (pathFrom !== null) pickPathTarget(s.id);
                    else focusNode(s.id);
                    setQuery("");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 9,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: s.is_pack ? 2 : "50%",
                      background: color,
                      boxShadow: `0 0 8px ${color}`,
                      flex: "none",
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 400 }}>{s.label}</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: MUTED,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {s.is_pack ? "pack" : s.kind}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
