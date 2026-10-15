export const BEATS_PER_BAR = 8;
export const DEFAULT_BPM = 125;
export function validBpm(value) {
  // 배속을 적용하면 31.25처럼 소수가 될 수 있어 소수 둘째 자리까지 허용합니다.
  const bpm = value === '' || value === null ? NaN : Number(value);
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) throw Error('BPM을 20~300 사이로 입력해 주세요.');
  return Math.round(bpm * 100) / 100;
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
