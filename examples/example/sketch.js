const BAND_CFG = {
  bass: { band: [20, 80], agc: { n: 300 } },
  kickSnare: {
    band: [60, 300],
    transient: { w: 1 },
    // lower kappa: kicks are clean and distinct, don't need high spike multiplier
    dynamicThreshold: { alphaRise: 0.95, alphaFall: 0.95, kappa: 1.8 },
  },
  mid: {
    band: [500, 2000],
    dynamicThreshold: { alphaRise: 0.99, alphaFall: 0.95, kappa: 1.5 },
  },
  hats: {
    band: [4000, 16000],
    transient: { w: 1 },
    // faster alphaRise: no constant hat rolls to adapt to, higher kappa: avoid triggering on open hats
    dynamicThreshold: { alphaRise: 0.99, alphaFall: 0.95, kappa: 1.6 },
  },
};

// transient bands: AR envelope for punchy response
// continuous bands (bass, mid): smoothed value used directly in draw
const FX_CFG = {
  red: {
    band: 'kickSnare',
    threshold: 0.2,
    envelope: [0.01, 0.35, 'linear', 'easeOut'],
  },
  blue: {
    band: 'hats',
    threshold: 0.2,
    envelope: [0.01, 0.2, 'linear', 'easeOut'],
  },
};

export default function (p, audio, params) {
  let SH = 1;
  let SW = 1;
  let S = 1;
  let band = {};
  let smooth = {};
  let envfn = {};
  let env = {};
  let transfn = {};
  let agcfn = {};
  let dtfn = {};
  let fadeIn = 0;

  const {
    smoothness: pSmooth,
    volFloor: pVolFloor,
    fadeInDuration: pFadeInDuration,
  } = params.group('Animation', {
    smoothness: params('smoothness', 0.95, {
      type: 'number',
      label: 'Smoothness',
      min: 0,
      max: 1,
      decimals: 2,
    }),
    volFloor: params('volFloor', 0.1, {
      type: 'number',
      label: 'Vol floor',
      min: 0,
      max: 1,
      decimals: 2,
    }),
    fadeInDuration: params('fadeInDuration', 2, {
      type: 'number',
      label: 'Fade in (s)',
      min: 0,
      decimals: 1,
    }),
  });

  const bandParams = params.group(
    'Bands',
    Object.fromEntries(
      Object.entries(BAND_CFG).flatMap(([k, cfg]) => {
        const bandObj = Object.fromEntries([
          [
            `${k}Lo`,
            params(`${k}Lo`, cfg.band[0], { type: 'number', label: `${k} lo` }),
          ],
          [
            `${k}Hi`,
            params(`${k}Hi`, cfg.band[1], { type: 'number', label: `${k} hi` }),
          ],
          ...(cfg.dynamicThreshold
            ? [
                [
                  `${k}AlphaRise`,
                  params(`${k}AlphaRise`, cfg.dynamicThreshold.alphaRise, {
                    type: 'number',
                    label: `${k} alpha rise`,
                    min: 0,
                    max: 1,
                    decimals: 3,
                  }),
                ],
                [
                  `${k}AlphaFall`,
                  params(`${k}AlphaFall`, cfg.dynamicThreshold.alphaFall, {
                    type: 'number',
                    label: `${k} alpha fall`,
                    min: 0,
                    max: 1,
                    decimals: 3,
                  }),
                ],
                [
                  `${k}Kappa`,
                  params(`${k}Kappa`, cfg.dynamicThreshold.kappa, {
                    type: 'number',
                    label: `${k} kappa`,
                    min: 1,
                    max: 5,
                    decimals: 1,
                  }),
                ],
              ]
            : []),
          ...(cfg.agc
            ? [
                [
                  `${k}AgcN`,
                  params(`${k}AgcN`, cfg.agc.n, {
                    type: 'number',
                    label: `${k} AGC n`,
                    min: 10,
                    step: 10,
                  }),
                ],
              ]
            : []),
        ]);
        return [[k, params.group(k, bandObj)], ...Object.entries(bandObj)];
      }),
    ),
  );

  const fxParams = params.group(
    'Effects',
    Object.fromEntries(
      Object.entries(FX_CFG).map(([k, cfg]) => [
        `${k}Threshold`,
        params(`${k}Threshold`, cfg.threshold ?? 0, {
          type: 'number',
          label: `${k} threshold`,
          min: 0,
          max: 1,
          step: 0.01,
        }),
      ]),
    ),
  );

  function computeScale() {
    SH = p.height / 1080;
    SW = p.width / 1920;
    S = p.width / p.height;
  }

  function setupTransients() {
    Object.keys(BAND_CFG).forEach((k) => {
      const {
        transient: { w = 15 } = {},
        agc: agcCfg,
        dynamicThreshold: dtCfg,
      } = BAND_CFG[k];
      const lo = bandParams[`${k}Lo`].value;
      const hi = bandParams[`${k}Hi`].value;
      transfn[k] = audio.transient(lo, hi, w);
      if (agcCfg != null)
        agcfn[k] = audio.agc(0.9, bandParams[`${k}AgcN`].value);
      if (dtCfg != null)
        dtfn[k] = audio.dynamicThreshold(
          bandParams[`${k}AlphaRise`].value,
          bandParams[`${k}AlphaFall`].value,
          bandParams[`${k}Kappa`].value,
        );
    });
  }

  function setupEnvelopes() {
    Object.keys(FX_CFG).forEach((k) => {
      if (!FX_CFG[k].envelope) return;
      const isADSR = FX_CFG[k].envelope.length === 8;
      const envFactory = isADSR ? audio.envelopeADSR : audio.envelopeAR;
      const args = FX_CFG[k].envelope.map((v) =>
        typeof v === 'string' ? envFactory[v] : v,
      );
      envfn[k] = envFactory(...args);
    });
  }

  function computeBand() {
    const smoothness = pSmooth.value;
    band.vol = audio.getVolumeLevel();
    smooth.vol = p.lerp(smooth.vol ?? 0, band.vol, smoothness);

    Object.keys(BAND_CFG).forEach((k) => {
      const lo = bandParams[`${k}Lo`].value;
      const hi = bandParams[`${k}Hi`].value;
      let bv = audio.getBand(lo, hi);
      if (agcfn[k]) bv = agcfn[k](bv);
      band[k] = bv;
      smooth[k] = p.lerp(smooth[k] ?? 0, band[k], smoothness);
    });
  }

  function computeEnvelopes() {
    const volFloor = pVolFloor.value;
    Object.keys(FX_CFG).forEach((k) => {
      const { band: bandName, envelope } = FX_CFG[k];
      const threshold = fxParams[`${k}Threshold`].value;
      const volScale = p.map(band.vol, volFloor, 1, 0, 1, true);

      if (!envelope) {
        const s = smooth[bandName];
        const raw = p.map(s, threshold, 1, 0, 1, true);
        env[k] = raw * volScale;
        return;
      }

      let signal = transfn[bandName]();
      if (agcfn[bandName]) signal = agcfn[bandName](signal);
      if (dtfn[bandName]) signal = dtfn[bandName](signal);
      env[k] = envfn[k](signal, threshold) * volScale;
    });
  }

  function computeFadeIn() {
    const d = pFadeInDuration.value;
    fadeIn = audio.timeline(
      fadeIn,
      [
        [0, 0],
        [d, 1],
      ],
      1,
    );
  }

  function drawBackground() {
    p.background(0);
  }

  // bass → large glow blob behind everything
  function drawBassGlow() {
    const maxR = p.min(p.width, p.height) * 0.7;
    const minR = maxR * 0.2;
    const r = p.map(smooth.bass, 0, 0.5, minR, maxR, true);
    p.noStroke();
    p.fill(255, 255, 255, p.map(smooth.bass, 0, 0.5, 0, 60, true) * fadeIn);
    p.circle(p.width / 2, p.height / 2, r * 2);
  }

  // mid → horizontal sine wave across full width
  function drawMidWave() {
    const amp = p.map(smooth.mid, 0, 0.5, 0, p.height * 0.18, true);
    const freq = 3;
    const t = audio.currentTime();
    const cy = p.height / 2;
    const steps = 200;

    p.noFill();
    p.stroke(255, 200 * fadeIn);
    p.strokeWeight(2 * SH);
    p.beginShape();
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * p.width;
      const y = cy + amp * p.sin(p.TWO_PI * (i / steps) * freq - t * 3);
      p.vertex(x, y);
    }
    p.endShape();
  }

  // kickSnare (red, left) and hats (blue, right) — transient punch
  function drawCircles() {
    const baseR = 120 * SH;
    const maxExtra = 100 * SH;
    const cy = p.height / 2;

    p.noStroke();

    p.fill(220, 40, 40, 255 * fadeIn);
    p.circle(p.width / 3, cy, (baseR + maxExtra * env.red) * 2);

    p.fill(40, 100, 220, 255 * fadeIn);
    p.circle((p.width / 3) * 2, cy, (baseR + maxExtra * env.blue) * 2);
  }

  p.setup = function () {
    p.createCanvas(p.windowWidth, p.windowHeight);
    computeScale();
    setupTransients();
    setupEnvelopes();
  };

  p.windowResized = function () {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    computeScale();
  };

  p.draw = function () {
    computeBand();
    computeEnvelopes();
    computeFadeIn();

    drawBackground();
    drawBassGlow();
    drawMidWave();
    drawCircles();
  };
}
