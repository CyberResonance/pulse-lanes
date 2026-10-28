import { describe, it, expect } from 'vitest'
import { rng, buildChart, backingEvents, TRACKS, INTRO_BARS } from './chart.js'
import { newState, hit, sweep, grade, accuracy, letter, WINDOWS } from './judge.js'

describe('chart', () => {
  const track = TRACKS[1]
  it('rng is deterministic', () => {
    const a = rng(42), b = rng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('same track and difficulty gives the same chart', () => {
    expect(buildChart(track, 'hard')).toEqual(buildChart(track, 'hard'))
  })
  it('notes are sorted, inside the song and after the intro', () => {
    const { notes, length, beat } = buildChart(track, 'normal')
    expect(notes.length).toBeGreaterThan(50)
    for (let i = 1; i < notes.length; i++) expect(notes[i].time).toBeGreaterThanOrEqual(notes[i - 1].time)
    expect(notes[0].time).toBeGreaterThanOrEqual(INTRO_BARS * 4 * beat)
    expect(notes.at(-1).time).toBeLessThan(length)
    for (const n of notes) expect([0, 1, 2, 3]).toContain(n.lane)
  })
  it('harder difficulties have more notes', () => {
    const e = buildChart(track, 'easy').notes.length, n = buildChart(track, 'normal').notes.length, h = buildChart(track, 'hard').notes.length
    expect(e).toBeLessThan(n)
    expect(n).toBeLessThan(h)
  })
  it('easy never puts three notes in a row in one lane', () => {
    const { notes } = buildChart(track, 'easy')
    for (let i = 2; i < notes.length; i++) expect(notes[i].lane === notes[i - 1].lane && notes[i].lane === notes[i - 2].lane).toBe(false)
  })
  it('easy only uses beats', () => {
    const { notes, beat } = buildChart(track, 'easy')
    for (const n of notes) expect(Math.abs(n.time / beat - Math.round(n.time / beat))).toBeLessThan(1e-9)
  })
  it('rejects unknown difficulty', () => {
    expect(() => buildChart(track, 'insane')).toThrow()
  })
  it('backing track has a kick on every beat', () => {
    const ev = backingEvents(track)
    expect(ev.filter(e => e.type === 'kick')).toHaveLength(track.bars * 4)
  })
})

describe('judge', () => {
  const notes = [{ time: 1, lane: 0 }, { time: 1.5, lane: 1 }, { time: 2, lane: 0 }]
  it('grades by timing window', () => {
    expect(grade(0.01)).toBe('perfect')
    expect(grade(-0.08)).toBe('great')
    expect(grade(0.12)).toBe('good')
    expect(grade(0.2)).toBe(null)
  })
  it('hits the right lane and builds combo', () => {
    const s = newState(notes)
    expect(hit(s, 0, 1.01).result).toBe('perfect')
    expect(hit(s, 1, 1.56).result).toBe('great')
    expect(s.combo).toBe(2)
    expect(s.score).toBeGreaterThan(500)
  })
  it('ignores ghost taps and wrong lanes', () => {
    const s = newState(notes)
    expect(hit(s, 3, 1)).toBe(null)
    expect(hit(s, 0, 0.5)).toBe(null)
    expect(s.counts.miss).toBe(0)
  })
  it('a note can only be hit once', () => {
    const s = newState(notes)
    hit(s, 0, 1)
    expect(hit(s, 0, 1.02)).toBe(null)
  })
  it('sweep marks passed notes as missed and resets combo', () => {
    const s = newState(notes)
    hit(s, 0, 1)
    expect(sweep(s, 1.5 + WINDOWS.good + 0.01)).toBe(1)
    expect(s.combo).toBe(0)
    expect(s.counts.miss).toBe(1)
  })
  it('accuracy and letter grade', () => {
    const s = newState(notes)
    hit(s, 0, 1); hit(s, 1, 1.5); hit(s, 0, 2)
    expect(accuracy(s)).toBe(1)
    expect(letter(s)).toBe('S')
    const t = newState(notes)
    sweep(t, 10)
    expect(letter(t)).toBe('D')
  })
})
