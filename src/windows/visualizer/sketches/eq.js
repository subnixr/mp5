'use strict';

// 10 octaves
// const EQ_BANDS = [
//   { label: '31Hz', low: 20, high: 45 },
//   { label: '63Hz', low: 45, high: 90 },
//   { label: '125Hz', low: 90, high: 180 },
//   { label: '250Hz', low: 180, high: 350 },
//   { label: '500Hz', low: 350, high: 700 },
//   { label: '1kHz', low: 700, high: 1400 },
//   { label: '2kHz', low: 1400, high: 2800 },
//   { label: '4kHz', low: 2800, high: 5600 },
//   { label: '8kHz', low: 5600, high: 11000 },
//   { label: '16kHz', low: 11000, high: 20000 },
// ];

// 31 octaves
const EQ_BANDS = [
  { label: '20Hz', low: 16, high: 22 },
  { label: '25Hz', low: 22, high: 28 },
  { label: '31.5Hz', low: 28, high: 35 },
  { label: '40Hz', low: 35, high: 44 },
  { label: '50Hz', low: 44, high: 56 },
  { label: '63Hz', low: 56, high: 71 },
  { label: '80Hz', low: 71, high: 89 },
  { label: '100Hz', low: 89, high: 112 },
  { label: '125Hz', low: 112, high: 141 },
  { label: '160Hz', low: 141, high: 178 },
  { label: '200Hz', low: 178, high: 224 },
  { label: '250Hz', low: 224, high: 282 },
  { label: '315Hz', low: 282, high: 355 },
  { label: '400Hz', low: 355, high: 447 },
  { label: '500Hz', low: 447, high: 562 },
  { label: '630Hz', low: 562, high: 708 },
  { label: '800Hz', low: 708, high: 891 },
  { label: '1kHz', low: 891, high: 1122 },
  { label: '1.25kHz', low: 1122, high: 1413 },
  { label: '1.6kHz', low: 1413, high: 1778 },
  { label: '2kHz', low: 1778, high: 2239 },
  { label: '2.5kHz', low: 2239, high: 2818 },
  { label: '3.15kHz', low: 2818, high: 3548 },
  { label: '4kHz', low: 3548, high: 4467 },
  { label: '5kHz', low: 4467, high: 5623 },
  { label: '6.3kHz', low: 5623, high: 7079 },
  { label: '8kHz', low: 7079, high: 8913 },
  { label: '10kHz', low: 8913, high: 11220 },
  { label: '12.5kHz', low: 11220, high: 14130 },
  { label: '16kHz', low: 14130, high: 17780 },
  { label: '20kHz', low: 17780, high: 22000 },
];

export default function (p, audio) {
  const BG = 0;

  p.setup = function () {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.textFont('monospace');
  };

  p.windowResized = function () {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  p.draw = function () {
    p.background(BG);

    const vol = audio.getVolumeLevel();

    const LABEL_TOP_H = 18;
    const LABEL_BOT_H = 18;
    const CONTROLS_H = 96;
    const PADDING_X = 16;
    const GAP = 8;
    const AMP_BAR_W = 20;
    const AMP_GAP = 32;

    const ampX = PADDING_X;
    const chartX = PADDING_X + AMP_BAR_W + AMP_GAP;
    const chartY = LABEL_TOP_H + 4;
    const chartW = p.width - chartX - PADDING_X;
    const chartH = p.height - chartY - CONTROLS_H - LABEL_BOT_H;

    const numBands = EQ_BANDS.length;

    // Integer-aligned column positions to avoid float accumulation on last bar
    function bandPos(i) {
      return chartX + Math.round((i * (chartW + GAP)) / numBands);
    }

    function drawBand(colX, colW, v, label) {
      const cx = colX + colW / 2;
      const barH = v * chartH;
      const barY = chartY + chartH - barH;

      p.noStroke();
      p.fill(28, 28, 28);
      p.rect(colX, chartY, colW, chartH - barH);

      p.fill(p.map(v, 0, 1, 0, 255), p.map(v, 0, 1, 255, 80), 40);
      p.rect(colX, barY, colW, barH);

      p.noStroke();
      p.fill(255);
      p.textSize(10);
      p.textAlign(p.CENTER, p.BOTTOM);
      p.text(label, cx, chartY - 4);
      p.textAlign(p.CENTER, p.TOP);
      p.text(label, cx, chartY + chartH + 4);
    }

    function drawVolBar(x, w, v) {
      const barH = v * chartH;
      const barY = chartY + chartH - barH;
      const cx = x + w / 2;

      // empty (dark) portion above the fill
      p.noStroke();
      p.fill(28, 28, 28);
      p.rect(x, chartY, w, chartH - barH);

      // filled portion — same green→red gradient as EQ bands
      p.fill(p.map(v, 0, 1, 0, 255), p.map(v, 0, 1, 255, 80), 40);
      p.rect(x, barY, w, barH);

      // "VOL" label above the bar
      p.noStroke();
      p.fill(120);
      p.textSize(10);
      p.textAlign(p.CENTER, p.BOTTOM);
      p.text('VOL', cx, chartY - 4);
    }

    // Gridlines at 0.25 / 0.5 / 0.75
    for (let g = 0.25; g < 1; g += 0.25) {
      const y = chartY + chartH - g * chartH;
      p.stroke(255);
      p.strokeWeight(1);
      p.line(chartX, y, chartX + chartW, y);
      p.noStroke();
      p.fill(255);
      p.textSize(11);
      p.textAlign(p.RIGHT, p.BOTTOM);
      p.text(Math.round(g * 100), chartX - 4, y);
    }

    // Bars
    for (let i = 0; i < numBands; i++) {
      const band = EQ_BANDS[i];
      const v = audio.getBand(band.low, band.high) || 0;
      const colX = bandPos(i);
      const colW = bandPos(i + 1) - colX - GAP;
      drawBand(colX, colW, v, band.label);
    }

    // Amplitude bar — left
    drawVolBar(ampX, AMP_BAR_W, p.constrain(vol, 0, 1));

    // Axes
    p.stroke(60);
    p.strokeWeight(1);
    p.line(chartX, chartY, chartX, chartY + chartH);
  };
}
