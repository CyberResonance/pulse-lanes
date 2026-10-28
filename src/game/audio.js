// Web Audio engine: schedules the generated backing track ahead of time and exposes a sample-accurate song clock.
import { backingEvents } from './chart.js'

const freq = (midi) => 440 * 2 ** ((midi - 69) / 12)

export class Engine {
  constructor(track, volume = 0.8) {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.master = this.ctx.createGain()
    this.master.gain.value = volume
    this.master.connect(this.ctx.destination)
    this.events = backingEvents(track)
    this.cursor = 0
    this.noise = this.makeNoise()
    this.startAt = 0
    this.timer = null
  }

  makeNoise() {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  /** Start the song after a short lead-in. */
  async start(leadIn = 1.5) {
    await this.ctx.resume()
    this.startAt = this.ctx.currentTime + leadIn
    this.timer = setInterval(() => this.schedule(), 25)
    this.schedule()
  }

  songTime() { return this.ctx.currentTime - this.startAt }
  pause() { return this.ctx.suspend() }
  resume() { return this.ctx.resume() }
  stop() { clearInterval(this.timer); this.ctx.close() }

  schedule() {
    const horizon = this.songTime() + 0.15
    while (this.cursor < this.events.length && this.events[this.cursor].time < horizon) {
      const e = this.events[this.cursor++]
      const at = Math.max(this.ctx.currentTime, this.startAt + e.time)
      this[e.type]?.(at, e)
    }
  }

  env(at, peak, attack, decay, node) {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
    node.connect(g).connect(this.master)
    return g
  }

  kick(at) {
    const o = this.ctx.createOscillator()
    o.frequency.setValueAtTime(140, at)
    o.frequency.exponentialRampToValueAtTime(42, at + 0.12)
    this.env(at, 0.9, 0.002, 0.22, o)
    o.start(at); o.stop(at + 0.3)
  }

  noiseHit(at, type, f, peak, decay) {
    const s = this.ctx.createBufferSource()
    s.buffer = this.noise
    const filt = this.ctx.createBiquadFilter()
    filt.type = type; filt.frequency.value = f
    s.connect(filt)
    this.env(at, peak, 0.001, decay, filt)
    s.start(at); s.stop(at + decay + 0.05)
  }

  snare(at) { this.noiseHit(at, 'bandpass', 1800, 0.35, 0.14) }
  hat(at) { this.noiseHit(at, 'highpass', 7000, 0.12, 0.04) }

  bass(at, e) {
    const o = this.ctx.createOscillator()
    o.type = 'sawtooth'; o.frequency.value = freq(e.note)
    const f = this.ctx.createBiquadFilter()
    f.type = 'lowpass'; f.frequency.value = 420
    o.connect(f)
    this.env(at, 0.35, 0.01, e.dur, f)
    o.start(at); o.stop(at + e.dur + 0.05)
  }

  pad(at, e) {
    for (const n of e.notes) {
      const o = this.ctx.createOscillator()
      o.type = 'triangle'; o.frequency.value = freq(n)
      this.env(at, 0.05, 0.4, e.dur - 0.4, o)
      o.start(at); o.stop(at + e.dur + 0.05)
    }
  }

  /** Melody note played when the player hits a note (the chart *is* the melody). */
  keysound(pitch, quality = 1) {
    const at = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    o.type = 'square'; o.frequency.value = freq(pitch)
    const f = this.ctx.createBiquadFilter()
    f.type = 'lowpass'; f.frequency.value = 2400
    o.connect(f)
    this.env(at, 0.12 * quality, 0.005, 0.25, f)
    o.start(at); o.stop(at + 0.3)
  }
}
