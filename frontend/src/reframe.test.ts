import { describe, expect, it } from "vitest";
import { createReframeTracker } from "./reframe";

describe("createReframeTracker", () => {
  it("re-frames once when the path was framed while the layout moved", () => {
    const tracker = createReframeTracker();
    tracker.framed(true);
    expect(tracker.layoutSettled()).toBe(true);
    expect(tracker.layoutSettled()).toBe(false);
  });

  it("does nothing when the path was framed on a settled layout", () => {
    const tracker = createReframeTracker();
    tracker.framed(false);
    expect(tracker.layoutSettled()).toBe(false);
  });

  it("leaves the camera alone once the user moved it", () => {
    const tracker = createReframeTracker();
    tracker.framed(true);
    tracker.userMoved();
    expect(tracker.layoutSettled()).toBe(false);
  });

  it("forgets a cleared path", () => {
    const tracker = createReframeTracker();
    tracker.framed(true);
    tracker.reset();
    expect(tracker.layoutSettled()).toBe(false);
  });
});
