import { BrowserMultiFormatReader } from '@zxing/browser';

export async function start(video, onCode) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara no está disponible en este navegador.');
  const reader = new BrowserMultiFormatReader();
  let lastCode = '';
  let lastAt = 0;
  return reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } }, video, result => {
    if (!result) return;
    const code = result.getText().trim();
    if (!code || (code === lastCode && Date.now() - lastAt < 1800)) return;
    lastCode = code;
    lastAt = Date.now();
    navigator.vibrate?.(60);
    onCode(code);
  });
}
