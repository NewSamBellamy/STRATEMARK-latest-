/**
 * Turn the raw journey webm into a paced mp4: speed up ONLY the live-wait
 * windows (research, per-tab loads, dig, fact-check, report, opportunity, hunt)
 * so each is a few seconds; keep every exploration/scroll beat at real 1x.
 *
 *   node scripts/ramp.mjs [/tmp/journey]
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const OUT = process.argv[2] || '/tmp/journey';
const VID = `${OUT}/video`;
const TARGET_VISIBLE = 3.0; // seconds a compressed wait should occupy
const MIN_RATE = 3;
const MAX_RATE = 16;

const webm = fs.readdirSync(VID).find((f) => f.endsWith('.webm'));
if (!webm) throw new Error('no webm in ' + VID);
const input = `${VID}/${webm}`;
const { totalMs, marks } = JSON.parse(fs.readFileSync(`${OUT}/marks.json`, 'utf8'));

// true video duration (authoritative over wall-clock marks)
const dur = Number(
  execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input,
  ]).toString().trim(),
);
// marks are wall-clock ms from recording start; scale to the real video timeline.
const scale = dur / (totalMs / 1000);
const sec = (ms) => Math.max(0, Math.min(dur, (ms / 1000) * scale));

// pair wait-start/wait-end into windows
const windows = [];
const openByLabel = new Map();
for (const m of marks) {
  if (m.kind === 'wait-start') openByLabel.set(m.label, m.t);
  else if (m.kind === 'wait-end' && openByLabel.has(m.label)) {
    const start = sec(openByLabel.get(m.label));
    const end = sec(m.t);
    openByLabel.delete(m.label);
    if (end - start > 0.8) windows.push({ start, end, label: m.label });
  }
}
windows.sort((a, b) => a.start - b.start);
// merge overlaps
const merged = [];
for (const w of windows) {
  const last = merged[merged.length - 1];
  if (last && w.start <= last.end + 0.05) last.end = Math.max(last.end, w.end);
  else merged.push({ ...w });
}

// build an ordered segment list over [0,dur]; wait windows get a computed rate
const segs = [];
let cursor = 0;
for (const w of merged) {
  if (w.start > cursor + 0.05) segs.push({ start: cursor, end: w.start, rate: 1 });
  const d = w.end - w.start;
  const rate = Math.max(MIN_RATE, Math.min(MAX_RATE, Math.round(d / TARGET_VISIBLE)));
  segs.push({ start: w.start, end: w.end, rate });
  cursor = w.end;
}
if (cursor < dur - 0.05) segs.push({ start: cursor, end: dur, rate: 1 });

console.log(`video ${dur.toFixed(1)}s · ${merged.length} wait windows · ${segs.length} segments`);
let estimated = 0;
for (const s of segs) {
  estimated += (s.end - s.start) / s.rate;
  if (s.rate > 1) console.log(`  speed ${s.rate}x  ${s.start.toFixed(1)}–${s.end.toFixed(1)}s`);
}
console.log(`estimated output ≈ ${estimated.toFixed(1)}s`);

const parts = segs.map(
  (s, i) =>
    `[0:v]trim=start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)},setpts=(PTS-STARTPTS)/${s.rate},fps=30,scale=1440:900:flags=lanczos[v${i}]`,
);
const concat = segs.map((_, i) => `[v${i}]`).join('') + `concat=n=${segs.length}:v=1:a=0[out]`;
const filter = parts.join(';') + ';' + concat;
fs.writeFileSync(`${OUT}/filter.txt`, filter);

const mp4 = `${OUT}/journey.mp4`;
execFileSync(
  'ffmpeg',
  [
    '-y', '-i', input,
    '-filter_complex_script', `${OUT}/filter.txt`,
    '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    mp4,
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);
// poster from a 1x exploration frame near the end
const poster = `${OUT}/poster.png`;
execFileSync('ffmpeg', ['-y', '-ss', String(Math.max(0, dur - 6)), '-i', input, '-vframes', '1', poster], {
  stdio: 'ignore',
});
const outDur = Number(
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4])
    .toString().trim(),
);
console.log(`WROTE ${mp4} (${outDur.toFixed(1)}s), poster ${poster}`);
