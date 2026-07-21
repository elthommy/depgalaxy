import { useEffect, useMemo, useRef, useState } from "react";
import { MUTED, PACK_ACCENT_LIGHT, TEXT, kindColor } from "../palette";
import { useGalaxyStore } from "../store";

/** Top-left: STELLARDEPS wordmark + search with client-side autocomplete. */
export default function SearchPanel() {
  const view = useGalaxyStore((s) => s.view);
  const focusNode = useGalaxyStore((s) => s.focusNode);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K focuses the search field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!view || q === "") return [];
    return view.nodes.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 6);
  }, [view, query]);

  return (
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
      <div className="glass" style={{ borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px" }}>
          <svg width="15" height="15" viewBox="0 0 15 15" style={{ flex: "none", opacity: 0.6 }}>
            <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke={TEXT} strokeWidth="1.4" />
            <line x1="10" y1="10" x2="13.5" y2="13.5" stroke={TEXT} strokeWidth="1.4" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes, packs, services…"
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
        {suggestions.length > 0 && (
          <div style={{ borderTop: "1px solid rgba(148,163,205,0.12)", padding: 6 }}>
            {suggestions.map((s) => {
              const color = s.is_pack ? PACK_ACCENT_LIGHT : kindColor(s.kind);
              return (
                <div
                  key={s.id}
                  className="hover-row"
                  onClick={() => {
                    focusNode(s.id);
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
