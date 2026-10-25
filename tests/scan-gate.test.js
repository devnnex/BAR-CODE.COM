import test from 'node:test';
import assert from 'node:assert/strict';
import { createScanGate } from '../scripts/scan-gate.js';

test('el mismo código se cuenta una vez aunque siga visible durante mucho tiempo', () => {
  const gate = createScanGate();
  assert.equal(gate.observe('7701234567890', 0), true);
  for (let time = 200; time <= 10000; time += 200) {
    assert.equal(gate.observe('7701234567890', time), false);
  }
});

test('fallos breves del lector no duplican; retirar y volver a mostrar el código sí', () => {
  const gate = createScanGate();
  assert.equal(gate.observe('7701234567890', 0), true);
  gate.observe('', 200);
  gate.observe('', 400);
  assert.equal(gate.observe('7701234567890', 600), false);
  gate.observe('', 800);
  gate.observe('', 1300);
  gate.observe('', 2100);
  assert.equal(gate.observe('7701234567890', 2300), true);
  assert.equal(gate.observe('7701234567890', 2500), false);
  assert.equal(gate.observe('7709876543210', 2700), true);
});
