export default function (p, audio) {
  p.setup = function () {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.textAlign(p.CENTER, p.CENTER);
  };

  p.windowResized = function () {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  p.draw = function () {
    const vol = audio.getVolumeLevel();
    const t = audio.currentTime();

    p.background(0);

    const sz = p.map(vol, 0, 1, p.height * 0.2, p.height * 0.4);
    p.textSize(sz);
    p.noStroke();
    p.fill(255, p.map(vol, 0, 1, 180, 255));

    p.text(Math.floor(t), p.width / 2, p.height / 2);
  };
}
