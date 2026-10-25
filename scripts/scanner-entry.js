import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser';
import { createScanGate } from './scan-gate.js';

export async function start(video, onCode) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara no está disponible en este navegador.');
  const reader = new BrowserMultiFormatReader();
  const gate = createScanGate();
  return reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }, video, result => {
    const code = result?.getText().trim() || '';
    if (!gate.observe(code)) return;
    onCode({ text: code, format: BarcodeFormat[result.getBarcodeFormat()] });
  });
}
