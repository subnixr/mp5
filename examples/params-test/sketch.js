export default function sketch(p, audio, params) {
  params.canvas(520, 640);

  // ── GROUP 1: one field per input type ─────────────────────────

  const num = params('num', 50, {
    type: 'number',
    label: 'Number',
    min: 0,
    max: 100,
    tip: 'Integer. min/max clamp on blur.\nArrow keys nudge by step.',
  });
  const numUnit = params('numUnit', 440, {
    type: 'number',
    label: 'Number (unit)',
    min: 20,
    max: 20000,
    unit: 'Hz',
    tip: 'unit: shows a badge. Click/right-click the badge to nudge ±step.',
  });
  const numDec = params('numDec', 0.75, {
    type: 'number',
    label: 'Number (decimals)',
    min: 0,
    max: 1,
    decimals: 2,
    unit: 'dB',
    tip: 'decimals: controls display precision and sets default step to 10^-decimals.',
  });
  const numStep = params('numStep', 120, {
    type: 'number',
    label: 'Number (step)',
    min: 40,
    max: 300,
    step: 0.5,
    unit: 'bpm',
    tip: 'step: 0.5 — arrow keys and unit-badge clicks use this step size.',
  });
  const txt = params('txt', 'hello', {
    type: 'text',
    label: 'Text',
    tip: 'Plain single-line text. Emits on every keystroke (input event).',
  });
  const area = params('area', 'line one\nline two', {
    type: 'textarea',
    label: 'Textarea',
    tip: 'Multi-line text. Emits on change (blur/enter).',
  });
  const chk = params('chk', true, {
    type: 'checkbox',
    label: 'Checkbox',
    tip: 'Default layout: label left, checkbox right.',
  });
  const chkLeft = params('chkLeft', false, {
    type: 'checkbox',
    label: 'Checkbox (left)',
    checkboxLeft: true,
    tip: 'checkboxLeft: true — checkbox rendered on the left side of the label.',
  });
  const sel = params('sel', 'circle', {
    type: 'select',
    label: 'Select',
    options: ['circle', 'rect', 'triangle', 'star'],
    tip: 'options: array of strings. Emits on change.',
  });
  const col = params('col', '#3366ff', {
    type: 'color',
    label: 'Color',
    tip: '#RRGGBB hex. Text field + color picker in sync.',
  });
  const colA = params('colA', '#ff440088', {
    type: 'color',
    label: 'Color (alpha)',
    transparency: true,
    tip: 'transparency: true — 8-digit #RRGGBBAA hex + alpha slider below the picker.',
  });
  const img = params('img', null, {
    type: 'image',
    label: 'Image',
    tip: 'Opens a file picker filtered to images. Preview icon opens the file.',
  });
  const file = params('file', null, {
    type: 'file',
    label: 'File',
    tip: 'Generic file picker — no filter. Value is the absolute path string or null.',
  });
  const timeTC = params('timeTC', 65.5, {
    type: 'time',
    label: 'Time (timecode)',
    max: 3600,
    tip: 'Timecode format [[HH:]MM:]SS[.mmm].\nFocus the field to open the scrub popup with a slider.',
  });
  const timeSec = params('timeSec', -10, {
    type: 'time',
    label: 'Time (seconds)',
    max: 3600,
    seconds: true,
    tip: 'seconds: true — raw decimal seconds. Supports negative values (offset from end).',
  });

  params.group(
    'inputs',
    'Inputs',
    { tip: 'One field per input type. Each has a tooltip (ⓘ icon).' },
    num,
    numUnit,
    numDec,
    numStep,
    txt,
    area,
    chk,
    chkLeft,
    sel,
    col,
    colA,
    img,
    file,
    timeTC,
    timeSec,
  );

  // ── GROUP 2: combo and grid ────────────────────────────────────

  // combo: inline row of controls, flex controls their width share
  const origin = params.combo(
    'origin',
    'Origin (combo)',
    { tip: 'combo: groups params into a single horizontal row.\nDefault flex: auto for all but last, 1 for last.' },
    params('ox', 260, { type: 'number', label: 'X', min: 0, max: 520 }),
    params('oy', 320, { type: 'number', label: 'Y', min: 0, max: 640 }),
  );

  const tagged = params.combo(
    'tagged',
    'Tagged (combo + flex)',
    { tip: 'Explicit flex values: flex:2 makes Tag twice as wide as Val, flex:"auto" shrinks to content.' },
    params('tg_label', 'main', { type: 'text', label: 'Tag', flex: 2 }),
    params('tg_val', 50, {
      type: 'number',
      label: 'Val',
      flex: 1,
      min: 0,
      max: 100,
    }),
    params('tg_on', true, { type: 'checkbox', label: 'On', flex: 'auto' }),
  );

  // grid: fixed column layout, span stretches across columns
  const cross = params.grid(
    'cross',
    2,
    { tip: 'grid: arranges params in a fixed column layout (columns: 2 here).' },
    params('cx', 260, { type: 'number', label: 'X', min: 0, max: 520 }),
    params('cy', 500, { type: 'number', label: 'Y', min: 0, max: 640 }),
    params('carm', 60, { type: 'number', label: 'Arm', min: 5, max: 200 }),
    params('cthk', 8, { type: 'number', label: 'Thick', min: 1, max: 60 }),
  );

  const palette = params.grid(
    'palette',
    3,
    { tip: 'span: a grid item can span multiple columns — pNote spans all 3.' },
    params('pR', 255, { type: 'number', label: 'R', min: 0, max: 255 }),
    params('pG', 80, { type: 'number', label: 'G', min: 0, max: 255 }),
    params('pB', 40, { type: 'number', label: 'B', min: 0, max: 255 }),
    params('pNote', 'warm orange', { type: 'text', label: 'Note', span: 3 }),
  );

  params.group(
    'composites',
    'Combo & Grid',
    { tip: 'combo: horizontal row of controls. grid: fixed column layout.\nBoth support tip and disabled options.' },
    origin, tagged, cross, palette,
  );

  // ── GROUP 3: repeaters ─────────────────────────────────────────

  // plain repeater: repeats a single field
  const sizes = params.repeater(
    'sizes',
    [30, 60, 90],
    { min: 1, max: 6 },
    params('sz', 40, {
      type: 'number',
      label: 'Size',
      min: 5,
      max: 200,
      tip: 'Plain repeater: each row is a single field.\nmin:1 prevents removing the last row, max:6 caps additions.',
    }),
  );

  // combo repeater: each row is a combo
  const dots = params.repeater(
    'dots',
    [
      { dx: 120, dy: 260, dr: 22 },
      { dx: 340, dy: 310, dr: 36 },
    ],
    { min: 1 },
    params.combo(
      'dot',
      'Dot',
      { tip: 'Combo repeater: each row is a horizontal combo. Drag handles to reorder rows.' },
      params('dx', 0, { type: 'number', label: 'X', flex: 1 }),
      params('dy', 0, { type: 'number', label: 'Y', flex: 1 }),
      params('dr', 15, {
        type: 'number',
        label: 'R',
        flex: 'auto',
        unit: 'px',
      }),
    ),
  );

  // grid repeater: each row is a grid
  const rects = params.repeater(
    'rects',
    [
      { rx: 60, ry: 80, rw: 100, rh: 50 },
      { rx: 300, ry: 180, rw: 80, rh: 80 },
    ],
    { min: 1, max: 4, label: 'Rects' },
    params.grid(
      'rect',
      2,
      { tip: 'Grid repeater: each row is a 2-column grid. min:1, max:4.' },
      params('rx', 60, { type: 'number', label: 'X', min: 0, max: 520 }),
      params('ry', 80, { type: 'number', label: 'Y', min: 0, max: 640 }),
      params('rw', 80, { type: 'number', label: 'W', min: 10, max: 400 }),
      params('rh', 40, { type: 'number', label: 'H', min: 10, max: 400 }),
    ),
  );

  params.group(
    'repeaters',
    'Repeaters',
    { tip: 'repeater: dynamic list of rows. Three variants: plain field, combo, grid.' },
    sizes, dots, rects,
  );

  // ── SETUP & DRAW ───────────────────────────────────────────────

  function drawShape(shape, x, y, s) {
    if (shape === 'circle') {
      p.circle(x, y, s * 2);
    } else if (shape === 'rect') {
      p.rectMode(p.CENTER);
      p.rect(x, y, s * 2, s * 2);
    } else if (shape === 'triangle') {
      p.triangle(x, y - s, x - s, y + s, x + s, y + s);
    } else {
      p.beginShape();
      for (let a = 0; a < 10; a++) {
        const r = a % 2 === 0 ? s : s * 0.4;
        const ang = (a / 10) * Math.PI * 2 - Math.PI / 2;
        p.vertex(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
      }
      p.endShape(p.CLOSE);
    }
  }

  p.setup = () => p.createCanvas(520, 640);

  p.draw = () => {
    p.background(0);
    p.textFont('monospace');

    const t = audio.currentTime();
    const ox = origin.ox.value;
    const oy = origin.oy.value;
    const c = p.color(col.value);

    // rects (grid repeater)
    p.noStroke();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i].value ?? {};
      if (r.rx == null) continue;
      p.fill(palette.pR.value, palette.pG.value, palette.pB.value, 90);
      p.rectMode(p.CORNER);
      p.rect(r.rx, r.ry, r.rw, r.rh);
    }

    // cross (grid)
    const arm = cross.carm.value;
    const thk = cross.cthk.value;
    p.fill(255, 220, 0, 140);
    p.noStroke();
    p.rectMode(p.CENTER);
    p.rect(cross.cx.value, cross.cy.value, arm * 2, thk);
    p.rect(cross.cx.value, cross.cy.value, thk, arm * 2);

    // concentric shapes at origin (plain repeater)
    if (chk.value) {
      p.noStroke();
      for (let i = sizes.length - 1; i >= 0; i--) {
        const s = sizes[i].value;
        const alpha = p.map(i, 0, Math.max(sizes.length - 1, 1), 255, 60);
        p.fill(p.red(c), p.green(c), p.blue(c), alpha);
        drawShape(sel.value, ox, oy, s);
      }
    }

    // dots (combo repeater) — color from colA (with alpha)
    const hex = colA.value;
    const ar = parseInt(hex.slice(1, 3), 16);
    const ag = parseInt(hex.slice(3, 5), 16);
    const ab = parseInt(hex.slice(5, 7), 16);
    const aa = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) : 255;
    p.strokeWeight(1.5);
    for (let i = 0; i < dots.length; i++) {
      const row = dots[i].value ?? {};
      if (row.dx == null) continue;
      p.fill(ar, ag, ab, aa);
      p.stroke(ar, ag, ab);
      p.circle(row.dx, row.dy, row.dr * 2);
      p.fill(255);
      p.noStroke();
      p.textSize(10);
      p.text(`${i}`, row.dx + row.dr + 2, row.dy + 4);
    }

    // tagged combo indicator
    if (tagged.tg_on.value) {
      p.noFill();
      p.stroke(100, 255, 180, 120);
      p.strokeWeight(1);
      p.circle(ox, oy, tagged.tg_val.value * 2);
      p.fill(100, 255, 180, 160);
      p.noStroke();
      p.textSize(10);
      p.text(tagged.tg_label.value, ox + tagged.tg_val.value + 4, oy + 4);
    }

    // info overlay
    p.noStroke();
    p.fill(255, 160);
    p.textSize(10);
    const lines = [
      `num:${num.value}  unit:${numUnit.value}Hz  dec:${numDec.value}  step:${numStep.value}`,
      `txt:"${txt.value}"  sel:${sel.value}  chk:${chk.value}  chkL:${chkLeft.value}`,
      `col:${col.value}  colA:${colA.value}`,
      `time:${timeTC.value ?? '—'}  sec:${timeSec.value ?? '—'}`,
      `origin:(${ox},${oy})  cross:(${cross.cx.value},${cross.cy.value}) arm:${arm}`,
      `sizes[${sizes.length}]  dots[${dots.length}]  rects[${rects.length}]`,
      `palette: rgb(${palette.pR.value},${palette.pG.value},${palette.pB.value}) "${palette.pNote.value}"`,
    ];
    for (let i = 0; i < lines.length; i++) {
      p.text(lines[i], 8, p.height - (lines.length - i) * 13);
    }
  };
}
