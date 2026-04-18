import TitleScene from "./scenes/TitleScene.js";
import MainScene from "./scenes/MainScene.js";
import TalkScene from "./scenes/TalkScene.js";

document.addEventListener(
  "touchmove",
  (event) => {
    event.preventDefault();
  },
  { passive: false }
);

window.addEventListener("contextmenu", (event) => event.preventDefault());

const config = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#111217",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
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
  },
  scene: [TitleScene, MainScene, TalkScene],
};

window.cityApproachGame = new Phaser.Game(config);
