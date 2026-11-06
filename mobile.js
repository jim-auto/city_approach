// Reset touch state when a gesture is interrupted by the OS or a tab switch.
export function bindTouchReset(scene, reset) {
  const cancel = () => reset.call(scene);
  const visibility = () => { if (document.hidden) cancel(); };
  const canvas = scene.game.canvas;
  canvas.addEventListener("touchcancel", cancel);
  canvas.addEventListener("pointercancel", cancel);
  window.addEventListener("blur", cancel);
  document.addEventListener("visibilitychange", visibility);
  scene.game.events.on("blur", cancel);
  scene.events.once("shutdown", () => {
    canvas.removeEventListener("touchcancel", cancel);
    canvas.removeEventListener("pointercancel", cancel);
    window.removeEventListener("blur", cancel);
    document.removeEventListener("visibilitychange", visibility);
    scene.game.events.off("blur", cancel);
  });
}
