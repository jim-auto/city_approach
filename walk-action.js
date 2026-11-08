import { sfx } from './sfx.js?v=20261108-action2';

const SPOTS = [360, 510, 910, 1120, 1530, 1760, 2220, 2440];
const JUMP_SECONDS = .82;

// A forgiving bonus game: movement and conversation still decide the ending.
export class WalkAction {
  constructor(scene) {
    this.scene = scene;
    this.held = new Set();
    this.jumpTime = null;
    this.jumpOffset = 0;
    this.assisted = false;
    this.fever = 0;
    this.fevers = 0;
    this.slow = 0;
    this.combo = 0;
    this.collected = 0;
    this.bonus = 0;
    this.jumps = 0;
    this.assists = 0;
    this.cleared = 0;
    this.splashes = 0;
    this.trailTime = 0;
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.hearts = [];
    this.puddles = SPOTS.map(x => {
      const art = scene.add.graphics().setDepth(1);
      art.fillStyle(0x172e49, .7).fillEllipse(0, 4, 68, 14)
        .fillStyle(0x4faad2, .85).fillEllipse(0, 0, 60, 10)
        .lineStyle(2, 0xc1f6ff, .8).lineBetween(-20, -1, -4, -2).lineBetween(6, 2, 20, 1);
      [-44, 0, 44].forEach((dx, index) => {
        const heart = scene.add.graphics().setDepth(14);
        heart.fillStyle(index === 1 ? 0xffd879 : 0xff82bc).fillCircle(-5, -3, 6).fillCircle(5, -3, 6)
          .fillTriangle(-11, -1, 11, -1, 0, 12).fillStyle(0xffffff, .9).fillCircle(-6, -5, 2);
        this.hearts.push({ x: x + dx, raised: index === 1, art: heart, taken: false });
      });
      return { x, art, resolved: false };
    });
    this.status = scene.add.text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#ffdbad' })
      .setDepth(41).setScrollFactor(0);
    this.button = scene.add.text(0, 0, 'ジャンプ', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffffff', align: 'center',
      backgroundColor: '#72517e', fixedWidth: 88, fixedHeight: 56,
      padding: { left: 0, right: 0, top: 16, bottom: 0 },
    }).setOrigin(.5).setScrollFactor(0).setDepth(45).setInteractive();
    scene.jumpButton = this.button;
    this.button.on('pointerdown', (pointer, _x, _y, event) => {
      event?.stopPropagation();
      if (!this.canAct()) return;
      this.held.add(pointer.id);
      this.jump();
    });
    this.keys = scene.input.keyboard?.addKeys('SPACE,W');
    scene.input.keyboard?.addCapture(['SPACE', 'UP', 'W']);
  }

  canAct() { return !this.scene.finished && !this.scene.currentQuestion; }
  get jumpHeight() { return this.scene.compact ? 52 : 88; }
  get speed() { return (this.fever > 0 ? 1.35 : 1) * (this.slow > 0 ? .65 : 1); }

  jump(assisted = false) {
    if (!this.canAct() || (this.jumpTime !== null && (!this.assisted || assisted))) return false;
    // A tap during the small automatic hop immediately turns it into a full jump.
    this.jumpTime = this.jumpTime === null ? 0 : Math.asin(Math.min(1, this.jumpOffset / this.jumpHeight)) / Math.PI * JUMP_SECONDS;
    this.assisted = assisted;
    if (assisted) this.assists++; else { this.jumps++; sfx.play('jump'); }
    return true;
  }

  release(id) { this.held.delete(id); }
  resetInput() {
    this.held.clear();
    this.jumpTime = null;
    this.jumpOffset = 0;
    this.scene.player.y = this.scene.partner.y = this.scene.groundY;
  }

  layout() {
    const s = this.scene;
    this.button.setPosition(s.scale.width / 2, s.scale.height - 48);
    this.status.setPosition(20, s.compact ? 52 : 63).setFontSize(s.compact ? 11 : 12);
    this.puddles.forEach(p => p.art.setPosition(p.x, s.groundY + 2));
    this.hearts.forEach(h => h.art.setPosition(h.x, s.groundY - 28 - (h.raised ? this.jumpHeight * .85 : 0)));
    this.refreshStatus();
  }

  refreshStatus() {
    const text = this.fever > 0
      ? `FEVER! ${this.fever.toFixed(1)}秒　♥ ${this.collected} / +${this.bonus}点`
      : `♥ ${this.collected} / +${this.bonus}点　あと${3 - this.combo}個で加速`;
    if (this.status.text !== text) this.status.setText(text);
    const color = this.fever > 0 ? '#ab4d75' : '#72517e';
    if (this.button.style.backgroundColor !== color) this.button.setBackgroundColor(color);
  }

  update(dt, move) {
    if (!this.canAct()) return;
    this.fever = Math.max(0, this.fever - dt);
    this.slow = Math.max(0, this.slow - dt);
    if ((this.held.size || this.keys?.SPACE.isDown || this.keys?.W.isDown || this.scene.cursors?.up.isDown) && (this.jumpTime === null || this.assisted)) this.jump();
    // Walking alone clears puddles with a small hop. Big bonus hearts need a real jump.
    const ahead = this.puddles.find(p => !p.resolved && p.x - this.scene.player.x > 0 && p.x - this.scene.player.x < 58);
    if (move > 0 && ahead && this.jumpTime === null) this.jump(true);
    if (this.jumpTime !== null) {
      this.jumpTime += dt;
      const progress = Math.min(1, this.jumpTime / (this.assisted ? .48 : JUMP_SECONDS));
      this.jumpOffset = Math.sin(progress * Math.PI) * this.jumpHeight * (this.assisted ? .28 : 1);
      if (progress >= 1) { this.jumpTime = null; this.jumpOffset = 0; }
    }
    this.refreshStatus();
    if (this.fever > 0 && move && !this.reduced) {
      this.trailTime += dt;
      if (this.trailTime > .12) {
        this.trailTime = 0;
        const dot = this.scene.add.circle(this.scene.player.x - 20, this.scene.groundY - 16 - this.jumpOffset, 5, 0xffc4e0, .8).setDepth(8);
        this.scene.tweens.add({ targets: dot, alpha: 0, scale: .15, duration: 350, onComplete: () => dot.destroy() });
      }
    }
  }

  resolve(move) {
    if (!this.canAct()) return;
    const s = this.scene;
    for (const heart of this.hearts) {
      if (heart.taken || Math.abs(heart.x - s.player.x) > 38 || (heart.raised && this.jumpOffset < this.jumpHeight * .42)) continue;
      heart.taken = true;
      heart.art.setVisible(false);
      this.collected++;
      this.combo++;
      this.bonus += 5;
      s.score += 5;
      sfx.play('collect');
      if (this.combo === 3) {
        this.combo = 0;
        this.fever = 3.5;
        this.fevers++;
        this.bonus += 10;
        s.score += 10;
        this.feedback('FEVER! +10', '#ffe091', 3);
        sfx.play('fever');
      } else this.feedback('♥ +5', '#ffbde0', 2);
    }
    this.refreshStatus();
    if (!move) return;
    for (const puddle of this.puddles) {
      if (puddle.resolved || Math.abs(puddle.x - s.player.x) > 18) continue;
      puddle.resolved = true;
      if (this.jumpOffset >= 5) {
        this.cleared++;
        if (!this.assisted) this.feedback('ナイスジャンプ！', '#a1f7ea');
      } else {
        this.splashes++;
        this.slow = .45;
        this.feedback('水はね！ すぐ復帰', '#b6e8ff');
        sfx.play('splash');
      }
    }
  }

  feedback(text, color, priority = 1) {
    const s = this.scene;
    if (this.feedbackLabel?.active) {
      if (this.feedbackPriority > priority && s.time.now - this.feedbackAt < 600) return;
      s.tweens.killTweensOf(this.feedbackLabel);
      this.feedbackLabel.destroy();
    }
    this.feedbackPriority = priority;
    this.feedbackAt = s.time.now;
    const label = s.add.text(s.player.x, Math.max(112, s.groundY - s.player.displayHeight - this.jumpOffset - 12), text,
      { fontFamily: 'system-ui, sans-serif', fontSize: '16px', fontStyle: 'bold', color, stroke: '#27213c', strokeThickness: 4 })
      .setOrigin(.5).setDepth(18);
    this.feedbackLabel = label;
    s.tweens.add({ targets: label, y: label.y - (this.reduced ? 0 : 24), alpha: 0, duration: 700, onComplete: () => label.destroy() });
  }
}
