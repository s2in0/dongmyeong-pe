export const BEATS_PER_BAR = 8;
export const DEFAULT_BPM = 125;
export function validBpm(value) {
  const bpm = Number(value);
  if (!Number.isInteger(bpm) || bpm < 20 || bpm > 300) throw Error('BPM을 20~300 사이의 정수로 입력해 주세요.');
  return bpm;
}
export function beatMilliseconds(value) { return 60000 / validBpm(value); }
// Keep every old four-beat move in order, pairing adjacent lines into eight beats.
export function migrateBars(raw, normalize) {
  const empty = () => Array(BEATS_PER_BAR).fill(null);
  if (!Array.isArray(raw) || !raw.length || raw.length > 16 || !raw.every(row => Array.isArray(row) && [4, 8].includes(row.length))) return [empty()];
  if (raw.every(row => row.length === 8)) return raw.map(row => row.map(normalize));
  const moves = raw.flat().map(normalize), bars = [];
  for (let i = 0; i < moves.length; i += 8) bars.push([...moves.slice(i, i + 8), ...Array(Math.max(0, 8 - (moves.length - i))).fill(null)]);
  return bars;
}
