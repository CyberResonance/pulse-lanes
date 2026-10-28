// Deterministic chart + music generation. The same seed always gives the same notes and the same song.

export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const TRACKS = [
  { id: 'neon-drift', title: 'Neon Drift', bpm: 100, bars: 24, seed: 1107, root: 57 },   // A minor
  { id: 'signal-rush', title: 'Signal Rush', bpm: 128, bars: 32, seed: 2048, root: 62 }, // D minor
  { id: 'overclock', title: 'Overclock', bpm: 150, bars: 40, seed: 4096, root: 60 },     // C minor
]

export const DIFFICULTY = {
  easy: { step: 1, onBeat: 0.75, offBeat: 0, chord: 0, maxRepeat: 2 },
  normal: { step: 0.5, onBeat: 0.85, offBeat: 0.45, chord: 0.06, maxRepeat: 2 },
  hard: { step: 0.25, onBeat: 0.95, offBeat: 0.6, chord: 0.12, maxRepeat: 3 },
}

// i - VI - III - VII in natural minor, as semitone offsets from the root.
const PROGRESSION = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]]
export const INTRO_BARS = 1

/** Build notes for a track. Returns { notes, length, beat } with times in seconds from song start. */
export function buildChart(track, difficulty = 'normal') {
  const d = DIFFICULTY[difficulty]
  if (!d) throw new Error(`Unknown difficulty: ${difficulty}`)
  const r = rng(track.seed * 31 + Object.keys(DIFFICULTY).indexOf(difficulty))
  const beat = 60 / track.bpm
  const notes = []
  let lastLane = -1, repeat = 0
  for (let bar = INTRO_BARS; bar < track.bars; bar++) {
    const chord = PROGRESSION[bar % 4]
    const breakBar = bar % 8 === 7 // lighter bar every 8 bars to breathe
    for (let pos = 0; pos < 4; pos += d.step) {
      const onBeat = Number.isInteger(pos)
      let p = onBeat ? d.onBeat : d.offBeat
      if (breakBar) p *= 0.4
      if (r() >= p) continue
      let lane = Math.floor(r() * 4)
      if (lane === lastLane && ++repeat >= d.maxRepeat) { lane = (lane + 1 + Math.floor(r() * 3)) % 4; repeat = 0 } else if (lane !== lastLane) repeat = 0
      lastLane = lane
      const time = (bar * 4 + pos) * beat
      notes.push({ time, lane, pitch: pitchFor(track.root, chord, lane) })
      if (onBeat && pos === 0 && r() < d.chord) {
        const other = (lane + 2) % 4
        notes.push({ time, lane: other, pitch: pitchFor(track.root, chord, other) })
      }
    }
  }
  notes.sort((a, b) => a.time - b.time || a.lane - b.lane)
  return { notes, length: track.bars * 4 * beat, beat }
}

export function pitchFor(root, chord, lane) {
  return root + 12 + (lane < 3 ? chord[lane] : chord[0] + 12)
}

/** Backing track events (drums, bass, pads) for the scheduler. */
export function backingEvents(track) {
  const beat = 60 / track.bpm
  const ev = []
  for (let bar = 0; bar < track.bars; bar++) {
    const chord = PROGRESSION[bar % 4]
    const t0 = bar * 4 * beat
    ev.push({ time: t0, type: 'pad', notes: chord.map(c => track.root + c), dur: 4 * beat })
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * beat
      ev.push({ time: t, type: 'kick' })
      if (b === 1 || b === 3) ev.push({ time: t, type: 'snare' })
      ev.push({ time: t + beat / 2, type: 'hat' })
      if (b % 2 === 0) ev.push({ time: t, type: 'bass', note: track.root - 12 + chord[0], dur: beat * 1.5 })
    }
  }
  return ev.sort((a, b) => a.time - b.time)
}
