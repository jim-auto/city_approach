// Keep the game's painted cards, but let the browser own taps, mouse clicks,
// and keyboard activation. This avoids engine-specific canvas touch handling.
export function createNativeButtons(scene, controls) {
  const layer = document.createElement('div');
  layer.className = 'game-native-buttons';
  layer.dataset.scene = scene.scene.key;
  document.body.append(layer);
  const entries = controls.map(({ key, object, label, enabled = () => true, activate }) => {
    const button = document.createElement('button');
    button.type = 'button';
    if (key) button.dataset.choice = key;
    button.className = 'game-native-button';
    button.addEventListener('pointerdown', event => event.stopPropagation());
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (!button.disabled && object.active && object.visible && enabled()) activate();
    });
    layer.append(button);
    return { object, label, enabled, button };
  });
  const sync = () => {
    const canvas = scene.game.canvas.getBoundingClientRect();
    Object.assign(layer.style, { left: `${canvas.left}px`, top: `${canvas.top}px`, width: `${canvas.width}px`, height: `${canvas.height}px` });
    for (const { object, label, enabled, button } of entries) {
      button.hidden = !object.active || !object.visible;
      button.disabled = !enabled();
      button.textContent = label();
      button.setAttribute('aria-label', label().replaceAll('\n', ' '));
      // All registered cards use top-left artwork; their canvas hit-area origin
      // and animation scale have no effect on the browser's activation rectangle.
      Object.assign(button.style, {
        left: `${100 * object.x / scene.scale.width}%`, top: `${100 * object.y / scene.scale.height}%`,
        width: `${100 * object.buttonWidth / scene.scale.width}%`, height: `${100 * object.buttonHeight / scene.scale.height}%`,
      });
    }
  };
  window.addEventListener('resize', sync);
  window.visualViewport?.addEventListener('resize', sync);
  scene.events.once('shutdown', () => {
    layer.remove();
    window.removeEventListener('resize', sync);
    window.visualViewport?.removeEventListener('resize', sync);
  });
  return { sync };
}
