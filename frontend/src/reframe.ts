// Path framing happens once, when the result arrives. On large graphs the
// layout may still be spreading out at that moment (no warmup), so the
// path drifts out of frame. This tracker decides when to frame it again.

export interface ReframeTracker {
  /** The path was just framed; `layoutMoving` tells whether nodes are still settling. */
  framed: (layoutMoving: boolean) => void;
  /** The user rotated, zoomed or panned: never take the camera back from them. */
  userMoved: () => void;
  /** The path was cleared or replaced. */
  reset: () => void;
  /** The layout settled: true if the path should be framed again (once). */
  layoutSettled: () => boolean;
}

/** Track whether a path framed mid-layout should be re-framed once the layout settles. */
export function createReframeTracker(): ReframeTracker {
  let pending = false;
  return {
    framed: (layoutMoving) => {
      pending = layoutMoving;
    },
    userMoved: () => {
      pending = false;
    },
    reset: () => {
      pending = false;
    },
    layoutSettled: () => {
      const reframe = pending;
      pending = false;
      return reframe;
    },
  };
}
