import { useEffect, useState } from "react";
import { fetchFeeds, runFeed } from "../api";
import { MUTED, TEXT } from "../palette";
import { useGalaxyStore } from "../store";
import type { FeedInfo } from "../types";

/** Top-left, under the search box: pick a predefined feed and replace the galaxy. */
export default function FeedPanel() {
  const loadNewGraph = useGalaxyStore((s) => s.loadNewGraph);
  const [feeds, setFeeds] = useState<FeedInfo[]>([]);
  const [feedId, setFeedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFeeds()
      .then((list) => {
        setFeeds(list);
        setFeedId(list.find((f) => f.available)?.id ?? "");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (feeds.length === 0 && error === null) return null;

  const selected = feeds.find((f) => f.id === feedId);

  const load = () => {
    if (!selected || loading) return;
    if (!window.confirm(`Replace the current galaxy with '${selected.label}'?`)) return;
    setLoading(true);
    setError(null);
    runFeed(selected.id)
      .then(() => loadNewGraph())
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <div
      className="glass"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderRadius: 14,
        padding: "10px 14px",
      }}
    >
      <div className="section-title">Feed</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select
          value={feedId}
          onChange={(e) => setFeedId(e.target.value)}
          title={selected?.description}
          style={{
            flex: 1,
            background: "rgba(148,163,205,0.10)",
            border: "1px solid rgba(148,163,205,0.25)",
            borderRadius: 8,
            color: TEXT,
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 12,
            padding: "6px 8px",
            outline: "none",
          }}
        >
          {feeds.map((f) => (
            <option
              key={f.id}
              value={f.id}
              disabled={!f.available}
              title={f.description}
              // options ignore the select's translucent styling, so give them
              // an opaque dark background matching the glass panels
              style={{ background: "#151a2c", color: f.available ? TEXT : MUTED }}
            >
              {f.label}
              {f.available ? "" : " (unavailable)"}
            </option>
          ))}
        </select>
        <button
          onClick={load}
          disabled={loading || !selected?.available}
          className="ghost-button"
          style={{
            border: "1px solid rgba(148,163,205,0.25)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            color: loading ? MUTED : "#a5f3fc",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "loading…" : "Load"}
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: "#fca5a5" }}>{error}</div>}
    </div>
  );
}
