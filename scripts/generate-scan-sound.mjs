import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sampleRate = 44100;
const seconds = 0.19;
const samples = Math.round(sampleRate * seconds);
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i += 1) {
  const t = i / sampleRate;
  const rise = Math.min(1, t / 0.008);
  const fade = Math.min(1, (seconds - t) / 0.035);
  const envelope = rise * fade * Math.exp(-t * 8);
  const frequency = t < 0.075 ? 880 : 1174.66;
  const tone = Math.sin(2 * Math.PI * frequency * t) + 0.18 * Math.sin(4 * Math.PI * frequency * t);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, tone * envelope * 0.28)) * 32767), 44 + i * 2);
}
await writeFile(fileURLToPath(new URL('../scan-success.wav', import.meta.url)), wav);
