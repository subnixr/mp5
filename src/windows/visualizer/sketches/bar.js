'use strict';

export default function (p, state) {
  function formatTime(s) {
    const total = Math.round(s * 1000);
    const mins = String(Math.floor(total / 60000)).padStart(2, '0');
    const secs = String(Math.floor(total / 1000) % 60).padStart(2, '0');
    const ms = String(total % 1000).padStart(3, '0');
    return `${mins}:${secs}.${ms}`;
  }

  function drawFreqBars(spectrum, level) {
    const spectrumH = 60;
    const midY = spectrumH / 2;
    const maxH = spectrumH / 2;
    const cols = Math.min(spectrum.length, p.width);
    const barW = p.width / cols;
    const gap = barW > 3 ? 1 : 0;
    const groupSize = spectrum.length / cols;
    p.noStroke();
    for (let i = 0; i < cols; i++) {
      const start = Math.floor(i * groupSize);
      const end = Math.floor((i + 1) * groupSize);
      let val = 0;
      for (let j = start; j < end; j++) val += spectrum[j];
      val /= end - start;
      const h = Math.min(maxH, Math.max(1, (val / 255) * maxH));
      p.fill(255, (0.3 + 0.6 * (val / 255)) * 255);
      p.rect(i * barW, midY - h, Math.max(1, barW - gap), h * 2);
    }
    const volH = 8;
    const volY = spectrumH + (16 - volH) / 2;
    p.fill(255, 128);
    p.noStroke();
    p.rect(0, volY, p.width * Math.min(1, level), volH, volH / 2);
  }

  function drawFreqSeek() {
    const spectrum = state.engine?.getSpectrum();
    if (!spectrum) {
      p.stroke(255, 89);
      p.strokeWeight(3);
      p.drawingContext.setLineDash([10, 7]);
      p.line(0, 32, p.width, 32);
      p.drawingContext.setLineDash([]);
      return;
    }
    const level = state.engine?.getVolumeLevel() ?? 0;
    drawFreqBars(spectrum, level);
  }

  function clampLabelX(x) {
    p.textFont('Hermit');
    p.textSize(16);
    const hw = p.textWidth('00:00.000') / 2;
    return Math.max(hw, Math.min(p.width - hw, x));
  }

  function drawPlayheadLabel(currentTime, playedX, seekY, barHalf) {
    p.noStroke();
    p.fill(255, 217);
    p.textFont('Hermit');
    p.textSize(16);
    p.textAlign(p.CENTER, p.BOTTOM);
    p.text(formatTime(currentTime), clampLabelX(playedX), seekY - barHalf - 2);
  }

  function drawHoverIndicator(seekY, dur, barHalf) {
    if (state.hoverX == null) return;
    const x = state.hoverX;
    p.stroke('#4dd0e1');
    p.strokeWeight(1);
    p.drawingContext.setLineDash([]);
    p.line(x, seekY - barHalf, x, seekY + barHalf);
    const t = (x / p.width) * dur;
    p.noStroke();
    p.fill('#4dd0e1');
    p.textFont('Hermit');
    p.textSize(16);
    p.textAlign(p.CENTER, p.BOTTOM);
    p.text(formatTime(t), clampLabelX(x), seekY - barHalf - 2);
  }

  function drawWaveformSeek(seekY) {
    const dur = state.engine?.getDuration();
    if (!dur) return;

    const peaks = state.engine?.getAudioSource().getPeaks(p.width);
    const pct = Math.min(1, Math.max(0, state.engine.getCurrentTime() / dur));
    const playedX = p.width * pct;
    const maxH = 54;
    const barHalf = maxH / 2;
    p.strokeWeight(1);
    p.drawingContext.setLineDash([]);
    const maxPeak = peaks.reduce((m, v) => Math.max(m, Math.abs(v || 0)), 0);
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * p.width;
      const h = Math.max(
        2,
        maxPeak > 0 ? (Math.abs(peaks[i] || 0) / maxPeak) * maxH : 0,
      );
      p.stroke(255, x < playedX ? 230 : 77);
      p.line(x, seekY - h / 2, x, seekY + h / 2);
    }
    drawPlayheadLabel(state.engine?.getCurrentTime(), playedX, seekY, barHalf);
    drawHoverIndicator(seekY, dur, barHalf);
  }

  p.setup = () => {
    const c = p.createCanvas(
      state.container.clientWidth,
      state.container.clientHeight,
    );

    c.elt.style.pointerEvents = 'none';
    c.elt.style.width = '';
    c.elt.style.height = '';

    state.resize = () => {
      p.resizeCanvas(state.container.clientWidth, state.container.clientHeight);
      c.elt.style.width = '';
      c.elt.style.height = '';
    };

    p.clear();
  };

  p.draw = () => {
    p.clear();

    const isMic = state.engine?.getMode() === 'mic';
    const isFreq = isMic || state.fileVizMode === 'freq';
    const targetH = isFreq ? 92 : 72;

    if (p.height !== targetH) {
      p.resizeCanvas(p.width, targetH);
      p.canvas.style.width = '';
      p.canvas.style.height = '';
    }

    if (isFreq) {
      drawFreqSeek();
    } else {
      // label (16px) + gap (2px) + barHalf (27px) = 45
      drawWaveformSeek(45);
    }
  };
}
