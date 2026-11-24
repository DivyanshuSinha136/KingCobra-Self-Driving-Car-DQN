// Unit tests for the DOM-free helpers in web/app.js.   Run: node tests/web/pure.test.js
'use strict';
const assert = require('assert');
const P = require('../../web/app.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ok  ', name); };

t('wrapAngle keeps angles in (-pi, pi]', () => {
  assert.ok(Math.abs(P.wrapAngle(3 * Math.PI) - Math.PI) < 1e-9);
  assert.ok(Math.abs(P.wrapAngle(-3.5)) < Math.PI);
  assert.strictEqual(P.wrapAngle(0), 0);
});
t('lerpAngle takes the short way round', () => {
  const a = P.lerpAngle(3.0, -3.0, 0.5);            // 3.0 and -3.0 are 0.28 rad apart across +-pi
  assert.ok(Math.abs(Math.abs(a) - Math.PI) < 0.01, 'got ' + a);
  assert.strictEqual(P.lerpAngle(0.2, 0.6, 0), 0.2);
});
t('lerpPose interpolates and tolerates a missing previous pose', () => {
  const m = P.lerpPose({ x: 0, y: 0, theta: 0 }, { x: 10, y: 4, theta: 1 }, 0.5);
  assert.deepStrictEqual([m.x, m.y, m.theta], [5, 2, 0.5]);
  assert.deepStrictEqual(P.lerpPose(null, { x: 1, y: 2, theta: 3 }, 0.3), { x: 1, y: 2, theta: 3 });
});
t('fitTransform centres the bounds and flips y', () => {
  const T = P.fitTransform({ minx: -50, maxx: 50, miny: -25, maxy: 25 }, 400, 300, 20);
  assert.ok(Math.abs(T.s - 3.6) < 1e-9);
  const c = P.toScreen(T, 0, 0);
  assert.ok(Math.abs(c[0] - 200) < 1e-9 && Math.abs(c[1] - 150) < 1e-9);
  assert.ok(P.toScreen(T, 0, 10)[1] < P.toScreen(T, 0, 0)[1]);    // up in the world is up on screen
});
t('boundsOf', () => assert.deepStrictEqual(P.boundsOf([[1, 5], [-2, 3], [4, -1]]), { minx: -2, maxx: 4, miny: -1, maxy: 5 }));
t('decodeAction: steer * 4 + pedal', () => {
  assert.deepStrictEqual(P.decodeAction(0), { steer: 0, pedal: 0 });
  assert.deepStrictEqual(P.decodeAction(7), { steer: 1, pedal: 3 });
  assert.deepStrictEqual(P.decodeAction(11), { steer: 2, pedal: 3 });
});
t('controlsFromKeys: gas, brake/reverse, steering, handbrake', () => {
  assert.deepStrictEqual(P.controlsFromKeys(new Set()), { steer: 0, pedal: 1 });
  assert.deepStrictEqual(P.controlsFromKeys(new Set(['gas', 'left'])), { steer: 1, pedal: 0 });
  assert.deepStrictEqual(P.controlsFromKeys(new Set(['brake', 'right'])), { steer: -1, pedal: 2 });
  assert.deepStrictEqual(P.controlsFromKeys(new Set(['left', 'right'])), { steer: 0, pedal: 1 });
  assert.strictEqual(P.controlsFromKeys(new Set(['gas', 'hand'])).pedal, 3);     // the handbrake wins
});
t('keyName maps arrows, WASD and space', () => {
  assert.strictEqual(P.keyName('ArrowUp'), 'gas'); assert.strictEqual(P.keyName('s'), 'brake');
  assert.strictEqual(P.keyName('A'), 'left'); assert.strictEqual(P.keyName('ArrowRight'), 'right');
  assert.strictEqual(P.keyName(' '), 'hand'); assert.strictEqual(P.keyName('x'), null);
});
t('qAlphas scale between 0.05 and 0.75', () => {
  const a = P.qAlphas([1, 3, 2]);
  assert.ok(Math.abs(a[0] - 0.05) < 1e-9 && Math.abs(a[1] - 0.75) < 1e-9 && Math.abs(a[2] - 0.4) < 1e-9);
  assert.deepStrictEqual(P.qAlphas([0, 0]), [0.25, 0.25]);
});
t('describeEnd covers every cause', () => {
  for (const c of ['lap', 'wrecked', 'stuck', 'reverse', 'timeout', 'other']) assert.ok(P.describeEnd(c).title);
  assert.strictEqual(P.describeEnd('lap').cls, 'is-win');
});
t('niceCeil / nearestRow / fmt / units', () => {
  assert.strictEqual(P.niceCeil(41), 50); assert.strictEqual(P.niceCeil(0), 1);
  const h = [{ episode: 20 }, { episode: 40 }, { episode: 60 }];
  assert.strictEqual(P.nearestRow(h, 0.55, 60), 1);          // 0.55 * 60 = 33 -> nearest is episode 40
  assert.strictEqual(P.nearestRow([], 0.5, 60), -1);
  assert.strictEqual(P.fmt(3.14159, 2), '3.14'); assert.strictEqual(P.fmt(null), '—');
  assert.strictEqual(P.fmtSeconds(30), '30 s'); assert.strictEqual(P.fmtSeconds(120), '2.0 min');
  assert.ok(Math.abs(P.kmh(10) - 36) < 1e-9); assert.ok(Math.abs(P.deg(Math.PI) - 180) < 1e-9);
});
console.log(`${n} passed`);
