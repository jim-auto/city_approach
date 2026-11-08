import TitleScene from "./scenes/TitleScene.js?v=20261108-proportion1";
import MainScene from "./scenes/MainScene.js?v=20261108-proportion1";
import EscortScene from "./scenes/EscortScene.js?v=20261108-proportion1";
import TalkScene from "./scenes/TalkScene.js?v=20261108-proportion1";

document.addEventListener(
  "touchmove",
  (event) => {
    // Let native dialogue buttons retain browser tap recognition when a finger
    // moves slightly. Their CSS already disables scrolling and zoom gestures.
    if (event.target.closest?.(".game-native-buttons")) return;
    if (event.cancelable) event.preventDefault();
  },
  { passive: false }
);

window.addEventListener("contextmenu", (event) => event.preventDefault());

const host = document.getElementById("game");
// A completed touch can otherwise generate a compatibility mouse click in the
// next scene. Cancel only cancelable touch starts; keep Phaser's touchcancel
// handler passive so OS gesture cancellation never calls preventDefault there.
// This must bubble after Phaser: Phaser ignores events already defaultPrevented.
host.addEventListener("touchstart", (event) => {
  if (event.cancelable) event.preventDefault();
}, { passive: false });

const config = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#111217",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: host.clientWidth,
    height: host.clientHeight,
  },
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
      fps: 60,
    },
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  input: {
    activePointers: 4,
    touch: { capture: false },
  },
  scene: [TitleScene, MainScene, TalkScene, EscortScene],
};

window.cityApproachGame = new Phaser.Game(config);

// Dynamic browser chrome and safe-area changes can resize the parent without
// changing innerHeight at the same time, especially on mobile Safari.
let resizeFrame;
function resizeGame() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const { clientWidth: width, clientHeight: height } = host;
    const game = window.cityApproachGame;
    if (width && height && game.isBooted) {
      // In RESIZE mode refresh derives the game size from parentSize. Update
      // those bounds first: WebKit delivers ResizeObserver before Phaser's step.
      const changed = game.scale.getParentBounds();
      if (changed || game.scale.width !== width || game.scale.height !== height) game.scale.refresh();
    }
  });
}
new ResizeObserver(resizeGame).observe(host);
window.visualViewport?.addEventListener("resize", resizeGame);
window.addEventListener("orientationchange", resizeGame);
