// Timing judgement, scoring and grades. Pure functions over a plain state object.

export const WINDOWS = { perfect: 0.045, great: 0.09, good: 0.135 }
const POINTS = { perfect: 300, great: 200, good: 100 }

export function newState(notes) {
  return { notes: notes.map(n => ({ ...n, result: null })), next: 0, score: 0, combo: 0, maxCombo: 0,
    counts: { perfect: 0, great: 0, good: 0, miss: 0 } }
}

export function grade(dt) {
  const a = Math.abs(dt)
  if (a <= WINDOWS.perfect) return 'perfect'
  if (a <= WINDOWS.great) return 'great'
  if (a <= WINDOWS.good) return 'good'
  return null
}

function record(state, note, result) {
  note.result = result
  state.counts[result]++
  if (result === 'miss') { state.combo = 0; return }
  state.combo++
  state.maxCombo = Math.max(state.maxCombo, state.combo)
  state.score += Math.round(POINTS[result] * (1 + Math.min(state.combo, 100) / 100))
}

/** A key press in `lane` at song time `t`. Returns the judged note (with result) or null for a ghost tap. */
export function hit(state, lane, t) {
  let best = null
  for (let i = state.next; i < state.notes.length; i++) {
    const n = state.notes[i]
    if (n.time - t > WINDOWS.good) break
    if (n.result || n.lane !== lane) continue
    if (Math.abs(n.time - t) <= WINDOWS.good && (!best || Math.abs(n.time - t) < Math.abs(best.time - t))) best = n
  }
  if (!best) return null
  const g = grade(best.time - t)
  record(state, best, g)
  return { ...best, offset: t - best.time }
}

/** Mark notes that scrolled past the window as missed. Returns how many were missed now. */
export function sweep(state, t) {
  let missed = 0
  while (state.next < state.notes.length) {
    const n = state.notes[state.next]
    if (n.result) { state.next++; continue }
    if (t - n.time > WINDOWS.good) { record(state, n, 'miss'); missed++; state.next++; continue }
    break
  }
  return missed
}

export function accuracy(state) {
  const total = state.notes.length
  if (!total) return 0
  const { perfect, great, good } = state.counts
  return (perfect * 300 + great * 200 + good * 100) / (total * 300)
}

export function letter(state) {
  const acc = accuracy(state)
  if (acc >= 0.95 && state.counts.miss === 0) return 'S'
  if (acc >= 0.9) return 'A'
  if (acc >= 0.8) return 'B'
  if (acc >= 0.7) return 'C'
  return 'D'
}
