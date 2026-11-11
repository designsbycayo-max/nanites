import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../src/nanites.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
function mount({ reduced = false, fine = true, fail = false } = {}) {
  let effect, intersection, resize, id = 0, now = 0;
  const rafs = new Map();
  const target = (bounds) => ({ style: {}, events: new Map(), getBoundingClientRect: () => bounds,
    addEventListener(name, fn) { this.events.set(name, fn); }, removeEventListener(name) { this.events.delete(name); } });
  const link = target({ width: 900, height: 300, top: 0, left: 0 });
  const logo = Object.assign(target({ width: 900, height: 194, top: 53, left: 0 }), { complete: true, naturalWidth: 362 });
  const masks = [], dots = [], artwork = [];
  let clipped = false;
  const clips = [];
  const context = { clearRect() { masks.length = 0; dots.length = 0; artwork.length = 0; }, setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {},
    arc(x, y) { dots.push({ x, y }); }, fill() {}, stroke() {}, fillRect() {},
    save() { clips.push(clipped); }, restore() { clipped = clips.pop(); }, clip() { clipped = true; },
    drawImage(...args) { args.clipped = clipped; artwork.push(args); },
    createRadialGradient(x, y, inner, ox, oy, outer) { masks.push({ x, y, inner, outer }); return { addColorStop() {} }; } };
  const canvas = { style: {}, getContext: () => context };
  const motion = Object.assign(target({}), { matches: reduced });
  const hover = Object.assign(target({}), { matches: fine });
  const doc = Object.assign(target({}), { hidden: false, createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => {
    if (fail) throw new Error('Unavailable pixels');
    return { data: new Uint8Array(900 * 194 * 4).fill(255) };
  } }) }) });
  const refs = [link, logo, canvas];
  const exports = {};
  runInNewContext(code, { exports, require(name) {
    if (name === 'react') return { useRef: () => ({ current: refs.shift() }), useEffect: fn => { effect = fn; } };
    if (name === 'react/jsx-runtime') return { jsx() {}, jsxs() {} };
    return {};
  }, document: doc, window: { devicePixelRatio: 1, matchMedia: query => query.includes('reduced') ? motion : hover },
  performance: { now: () => now }, requestAnimationFrame: fn => { rafs.set(++id, fn); return id; }, cancelAnimationFrame: n => rafs.delete(n),
  IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} disconnect() {} },
  ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} disconnect() {} } });
  exports.Nanites({ src: '/sample.svg', alt: 'Sample', width: 900, height: 194 });
  const cleanup = effect();
  intersection([{ isIntersecting: true }]);
  return { logo, canvas, motion, rafs, cleanup, resize, masks, dots, artwork,
    enter: (type = 'mouse', x = 150, y = 150) => link.events.get('pointerenter')?.({ pointerType: type, clientX: x, clientY: y }),
    move: (x, y) => link.events.get('pointermove')?.({ pointerType: 'mouse', clientX: x, clientY: y }),
    leave: () => link.events.get('pointerleave')?.(),
    offscreen: () => intersection([{ isIntersecting: false }]),
    step(time) { now = time; const pending = [...rafs.values()]; rafs.clear(); pending.forEach(fn => fn(time)); } };
}
test('hover scatters once, restores the solid artwork, and can replay on re-entry', () => {
  const app = mount(); app.enter(); app.step(900);
  assert.equal(app.logo.style.opacity, '0'); assert.equal(app.canvas.style.opacity, '1');
  app.enter(); assert.equal(app.rafs.size, 1);
  app.step(3700); assert.equal(app.logo.style.opacity, ''); assert.equal(app.canvas.style.opacity, '0'); assert.equal(app.rafs.size, 0);
  app.enter(); assert.equal(app.rafs.size, 1); app.cleanup(); assert.equal(app.rafs.size, 0);
});
test('reduced motion, touch, unavailable pixels and coarse pointers preserve the solid logo', () => {
  for (const options of [{ reduced: true }, { fine: false }, { fail: true }]) {
    const app = mount(options); app.enter(); assert.equal(app.rafs.size, 0); assert.notEqual(app.logo.style.opacity, '0'); app.cleanup();
  }
  const app = mount(); app.enter('touch'); assert.equal(app.rafs.size, 0); app.cleanup();
});
test('offscreen, resize and a changed motion preference stop and restore immediately', () => {
  for (const action of [app => app.offscreen(), app => app.resize(), app => { app.motion.matches = true; app.motion.events.get('change')(); }]) {
    const app = mount(); app.enter(); app.step(900); action(app);
    assert.equal(app.rafs.size, 0); assert.equal(app.logo.style.opacity, ''); assert.equal(app.canvas.style.opacity, '0'); app.cleanup();
  }
});

test('artwork fragments move only near the pointer, with no masking layer', () => {
  const app = mount(); app.enter(); app.step(900);
  assert.ok(app.artwork.length > 1, 'the artwork is rendered as its own fragments');
  assert.equal(app.masks.length, 0, 'no radial cutout is drawn');
  assert.ok(app.dots.length > 0);
  assert.ok(app.dots.every(p => p.x < 400), 'no particles appear on the unhovered right side');
  const untouched = app.artwork.filter(args => args[1] > 400);
  assert.ok(untouched.length > 0);
  for (const args of untouched) {
    assert.ok(Math.abs(args[5] - args[1]) < 0.001, 'untouched fragments retain their x position');
    assert.ok(Math.abs(args[6] - args[2] - 53) < 0.001, 'untouched fragments retain their y position');
    assert.equal(args[7], args[3]);
    assert.equal(args[8], args[4]);
  }
  app.leave(); app.enter('mouse', 650, 150); app.step(1800);
  assert.ok(app.dots.some(p => p.x > 500));
  app.step(3700);
  assert.ok(app.dots.every(p => p.x > 450), 'the first patch reconnects independently');
  app.step(4600); assert.equal(app.canvas.style.opacity, '0'); app.cleanup();
});
test('hovering empty space outside the logo does not scatter it', () => {
  const app = mount(); app.enter('mouse', 150, -60); assert.equal(app.rafs.size, 0); app.cleanup();
});
test('fragments reach the logo before the final solid-image handoff', () => {
  const app = mount(); app.enter();
  for (let time = 0; time <= 3584; time += 16) app.step(time);
  app.step(3599);
  const largestOffset = Math.max(...app.artwork.filter(args => args.length === 9).map(args => Math.hypot(args[5] - args[1], args[6] - args[2] - 53)));
  assert.ok(largestOffset < 0.01, `handoff still has ${largestOffset.toFixed(3)}px of residual movement`);
  app.step(3601); assert.equal(app.canvas.style.opacity, '0'); app.cleanup();
});

test('moving artwork fragments are circularly clipped during separation and reunion', () => {
  const app = mount(); app.enter();
  for (let time = 0; time < 3500; time += 32) {
    app.step(time);
    for (const args of app.artwork.filter(args => args.length === 9)) {
      const travel = Math.hypot(args[5] + args[7] / 2 - args[1] - args[3] / 2,
        args[6] + args[8] / 2 - args[2] - args[4] / 2 - 53);
      if (travel > 0.1) assert.equal(args.clipped, true, 'moving source fragment must have a circular outline');
    }
  }
  app.step(3700); assert.equal(app.canvas.style.opacity, '0'); app.cleanup();
});

test('a fast sweep activates the whole cursor path between sparse pointer events', () => {
  const app = mount(); app.enter('mouse', 10, 150); app.move(890, 150); app.step(900);
  for (let x = 50; x < 900; x += 100) {
    assert.ok(app.artwork.some(args => args.length === 9 && args.clipped && Math.abs(args[1] - x) < 20 && Math.abs(args[2] + 53 - 150) < 20), `sweep skipped x=${x}`);
  }
  app.cleanup();
});
test('multiple quick passes keep activating new areas beyond 24 patches', () => {
  const app = mount(); app.enter('mouse', 10, 80);
  app.move(890, 80); app.move(890, 150); app.move(10, 150); app.move(10, 220); app.move(890, 220); app.step(900);
  for (let x = 50; x < 900; x += 100) {
    assert.ok(app.artwork.some(args => args.length === 9 && args.clipped && Math.abs(args[1] - x) < 20 && Math.abs(args[2] + 53 - 220) < 20), `later sweep skipped x=${x}`);
  }
  app.step(3700); assert.equal(app.canvas.style.opacity, '0'); app.cleanup();
});
