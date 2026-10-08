import { describe, expect, it, vi } from "vitest";

import { finishHeroEntrance } from "../../../src/components/marketing/hero-entrance";

describe("hero entrance focus", () => {
  it("finishes an entrance once without cancelling or replaying it on repeated focus", () => {
    const animation = {
      playState: "running",
      finish: vi.fn(() => {
        animation.playState = "finished";
      }),
      cancel: vi.fn(),
      play: vi.fn(),
    };
    const element = { getAnimations: () => [animation as Animation] };

    finishHeroEntrance(element);
    finishHeroEntrance(element);

    expect(animation.finish).toHaveBeenCalledTimes(1);
    expect(animation.cancel).not.toHaveBeenCalled();
    expect(animation.play).not.toHaveBeenCalled();
  });

  it("finishes a paused entrance so its focused controls are visible", () => {
    const animation = { playState: "paused", finish: vi.fn() };
    finishHeroEntrance({ getAnimations: () => [animation as unknown as Animation] });
    expect(animation.finish).toHaveBeenCalledOnce();
  });

  it("does nothing when reduced motion leaves no entrance animation", () => {
    expect(() => finishHeroEntrance({ getAnimations: () => [] })).not.toThrow();
  });
});
