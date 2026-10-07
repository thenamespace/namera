export function finishHeroEntrance(element: Pick<HTMLElement, "getAnimations">) {
  // Finish rather than cancel: removing/reapplying the CSS animation restarts it on blur.
  // Only the wrapper's entrance is finished, not animations inside its interactive controls.
  for (const animation of element.getAnimations()) {
    if (animation.playState === "running" || animation.playState === "paused") animation.finish();
  }
}
