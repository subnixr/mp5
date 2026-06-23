export default function sketch(p, audio, params) {
  params.canvas(520, 640);

  // basic types
  const num = params('num', 42, {
    type: 'number',
    label: 'Number',
    min: 0,
    max: 100,
  });
  const freq = params('freq', 440, {
    type: 'number',
    label: 'Frequency',
    min: 20,
    max: 20000,
    unit: 'Hz',
  });
  const gain = params('gain', 0.75, {
    type: 'number',
    label: 'Gain',
    min: 0,
    max: 1,
    decimals: 2,
    unit: 'dB',
  });
  const bpm = params('bpm', 120, {
    type: 'number',
    label: 'BPM',
    min: 40,
    max: 300,
    step: 0.5,
    unit: 'bpm',
  });
  const txt = params('txt', 'hello', { type: 'text', label: 'Text' });
  const col = params('col', '#ff4400', { type: 'color', label: 'Color' });
  const chk = params('chk', true, { type: 'checkbox', label: 'Checkbox' });
  const sel = params('sel', 'circle', {
    type: 'select',
    label: 'Shape',
    options: ['circle', 'rect', 'triangle'],
  });

  // image
  const img = params('img', null, { type: 'image', label: 'Image' });

  // repeater
  const sizes = params.repeater(
    'size',
    [30, 60, 90],
    params('size', 30, { type: 'number', label: 'Size', min: 5, max: 200 }),
    { min: 1, max: 5 },
  );

  // combo (standalone)
  const origin = params.combo(
    'origin',
    'Origin',
    params('ox', 260, { type: 'number', label: 'X', flex: 1 }),
    params('oy', 320, { type: 'number', label: 'Y', flex: 1 }),
  );

  // grid
  const cross = params.grid(
    'cross',
    2,
    params('cx', 260, { type: 'number', label: 'X', min: 0, max: 520 }),
    params('cy', 500, { type: 'number', label: 'Y', min: 0, max: 640 }),
    params('carm', 40, { type: 'number', label: 'Arm', min: 5, max: 150 }),
    params('cthk', 10, { type: 'number', label: 'Thick', min: 1, max: 60 }),
  );

  // disabled — truthy check: hide sizes repeater when chk is unchecked... actually let's do dedicated controls
  const showDots = params('showDots', true, {
    type: 'checkbox',
    label: 'Show dots',
  });
  const dotOpacity = params('dotOpacity', 180, {
    type: 'number',
    label: 'Dot opacity',
    min: 0,
    max: 255,
    disabled: { param: showDots, is: false },
  });

  // disabled on a group — hide cross controls when mode is 'simple'
  const mode = params('mode', 'full', {
    type: 'select',
    label: 'Mode',
    options: ['simple', 'full'],
  });
  params.group(
    'crossGroup',
    'Cross',
    { disabled: { param: mode, is: 'simple' } },
    params('gcx', 260, { type: 'number', label: 'X', min: 0, max: 520 }),
    params('gcy', 500, { type: 'number', label: 'Y', min: 0, max: 640 }),
    params('gcarm', 40, { type: 'number', label: 'Arm', min: 5, max: 150 }),
    params('gcthk', 10, { type: 'number', label: 'Thick', min: 1, max: 60 }),
  );

  // combo + repeater
  const dots = params.repeater(
    'dot',
    [
      { dx: 100, dy: 250, dr: 20 },
      { dx: 300, dy: 300, dr: 35 },
      { dx: 200, dy: 450, dr: 15 },
    ],
    params.combo(
      'dot',
      'Dot',
      params('dx', 0, { type: 'number', label: 'X', flex: 1 }),
      params('dy', 0, { type: 'number', label: 'Y', flex: 1 }),
      params('dr', 12, {
        type: 'number',
        label: 'R',
        flex: 'auto',
        unit: 'px',
      }),
    ),
    { min: 1 },
  );

  p.setup = () => p.createCanvas(520, 640);

  p.draw = () => {
    p.background(0);
    p.noStroke();

    const ox = origin.ox.value;
    const oy = origin.oy.value;
    const shape = sel.value;
    const size = num.value;
    const c = p.color(col.value);
    const visible = chk.value;

    // concentric shapes from sizes repeater
    if (visible) {
      for (let i = sizes.length - 1; i >= 0; i--) {
        const s = sizes[i].value;
        const alpha = p.map(i, 0, Math.max(sizes.length - 1, 1), 255, 60);
        p.fill(p.red(c), p.green(c), p.blue(c), alpha);
        if (shape === 'circle') {
          p.circle(ox, oy, s * 2);
        } else if (shape === 'rect') {
          p.rectMode(p.CENTER);
          p.rect(ox, oy, s * 2, s * 2);
        } else {
          p.triangle(ox, oy - s, ox - s, oy + s, ox + s, oy + s);
        }
      }
    }

    // num outline
    p.noFill();
    p.stroke(255, 60);
    p.strokeWeight(1);
    p.circle(ox, oy, size * 2);

    // dots (combo + repeater)
    p.stroke(80, 200, 255);
    p.strokeWeight(1.5);
    for (let i = 0; i < dots.length; i++) {
      if (!showDots.value) break;
      const row = dots[i].value ?? {};
      if (row.dx == null) continue;
      p.fill(80, 200, 255, dotOpacity.value);
      p.circle(row.dx, row.dy, row.dr * 2);
      p.fill(255);
      p.noStroke();
      p.textSize(11);
      p.text(`${i}`, row.dx + row.dr + 2, row.dy + 4);
      p.stroke(80, 200, 255);
      p.strokeWeight(1.5);
    }

    // cross (grid)
    const arm = cross.carm.value;
    const thk = cross.cthk.value;
    p.fill(255, 220, 0, 180);
    p.noStroke();
    p.rectMode(p.CENTER);
    p.rect(cross.cx.value, cross.cy.value, arm * 2, thk);
    p.rect(cross.cx.value, cross.cy.value, thk, arm * 2);

    // info overlay
    p.fill(255);
    p.noStroke();
    p.textSize(13);
    p.text(
      `num:${num.value}  freq:${freq.value}  gain:${gain.value}  bpm:${bpm.value}`,
      10,
      20,
    );
    p.text(
      `txt:"${txt.value}"  col:${col.value}  chk:${chk.value}  sel:${sel.value}`,
      10,
      38,
    );
    p.text(`img:${img.value ?? '(none)'}`, 10, 56);
    p.text(`origin: ${ox}, ${oy}`, 10, 74);
    p.text(
      `sizes: [${[...Array(sizes.length)].map((_, i) => sizes[i].value).join(', ')}]`,
      10,
      92,
    );
    p.text(
      `dots: ${dots.length}  cross: ${cross.cx.value},${cross.cy.value} arm:${arm} thk:${thk}`,
      10,
      110,
    );
  };
}
