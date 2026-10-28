import { useEffect, useRef, useState } from 'react'
import { TRACKS, buildChart } from './game/chart.js'
import { newState, hit, sweep, accuracy, letter } from './game/judge.js'
import { Engine } from './game/audio.js'

const KEYS = ['d', 'f', 'j', 'k']
const LANE_COLORS = ['#0a93ce', '#edcb0b', '#edcb0b', '#0a93ce']
const RESULT_COLOR = { perfect: '#edcb0b', great: '#0a93ce', good: '#8a97ad', miss: '#e0455f' }

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage unavailable */ } },
}

function Menu({ onPlay }) {
  const [track, setTrack] = useState(store.get('pl.track', TRACKS[0].id))
  const [diff, setDiff] = useState(store.get('pl.diff', 'normal'))
  const [speed, setSpeed] = useState(store.get('pl.speed', 600))
  const [offset, setOffset] = useState(store.get('pl.offset', 0))
  const best = store.get('pl.best', {})
  function play() {
    store.set('pl.track', track); store.set('pl.diff', diff); store.set('pl.speed', speed); store.set('pl.offset', offset)
    onPlay({ track: TRACKS.find(t => t.id === track), diff, speed, offset })
  }
  return (
    <section className="card menu">
      <h2>Choose a track</h2>
      <div className="tracks">
        {TRACKS.map(t => {
          const b = best[`${t.id}:${diff}`]
          return (
            <button key={t.id} className={track === t.id ? 'on' : ''} onClick={() => setTrack(t.id)}>
              <strong>{t.title}</strong><span>{t.bpm} BPM</span>
              <small>{b ? `Best ${b.score.toLocaleString()} · ${b.letter}` : 'Not played yet'}</small>
            </button>
          )
        })}
      </div>
      <div className="row">
        {['easy', 'normal', 'hard'].map(d => <button key={d} className={diff === d ? 'on' : ''} onClick={() => setDiff(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}
      </div>
      <label>Scroll speed <input type="range" min={300} max={1100} step={50} value={speed} onChange={e => setSpeed(+e.target.value)} /> <b>{speed}</b></label>
      <label>Timing offset <input type="range" min={-120} max={120} step={5} value={offset} onChange={e => setOffset(+e.target.value)} /> <b>{offset} ms</b></label>
      <p className="muted">Hit the notes with <kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd>, or tap the lanes. <kbd>Esc</kbd> pauses. If you keep hitting late, raise the offset.</p>
      <button className="play" onClick={play}>Play ▶</button>
    </section>
  )
}

function Game({ cfg, onEnd }) {
  const canvas = useRef(null)
  const [paused, setPaused] = useState(false)
  const live = useRef(null)

  useEffect(() => {
    const chart = buildChart(cfg.track, cfg.diff)
    const state = newState(chart.notes)
    const engine = new Engine(cfg.track)
    const fx = { flashes: [0, 0, 0, 0], label: null, labelAt: 0, pressed: [false, false, false, false] }
    const off = cfg.offset / 1000
    let raf = 0, done = false
    live.current = { engine, paused: false }

    const press = (lane) => {
      if (live.current.paused) return
      fx.pressed[lane] = true
      fx.flashes[lane] = performance.now()
      const r = hit(state, lane, engine.songTime() - off)
      if (r) { fx.label = r.result; fx.labelAt = performance.now(); engine.keysound(r.pitch, r.result === 'good' ? 0.6 : 1) }
    }
    const release = (lane) => { fx.pressed[lane] = false }
    const onKey = (e) => {
      if (e.key === 'Escape') { if (e.type === 'keydown' && !e.repeat) togglePause(); return }
      const lane = KEYS.indexOf(e.key.toLowerCase())
      if (lane < 0 || e.repeat) return
      e.preventDefault()
      e.type === 'keydown' ? press(lane) : release(lane)
    }
    const onPointer = (e) => {
      const rect = canvas.current.getBoundingClientRect()
      const lane = Math.min(3, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * 4)))
      e.type === 'pointerdown' ? press(lane) : release(lane)
    }
    function togglePause() {
      live.current.paused = !live.current.paused
      setPaused(live.current.paused)
      live.current.paused ? engine.pause() : engine.resume()
    }
    live.current.toggle = togglePause

    const draw = () => {
      const c = canvas.current
      if (!c) return
      const dpr = window.devicePixelRatio || 1
      const W = c.clientWidth, H = c.clientHeight
      if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr }
      const g = c.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const t = engine.songTime() - off
      if (!live.current.paused) {
        const before = state.counts.miss
        sweep(state, t)
        if (state.counts.miss > before) { fx.label = 'miss'; fx.labelAt = performance.now() }
      }
      const laneW = W / 4, judgeY = H * 0.84
      g.clearRect(0, 0, W, H)
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.045)'
        g.fillRect(i * laneW, 0, laneW, H)
        const age = performance.now() - fx.flashes[i]
        if (age < 180 || fx.pressed[i]) {
          const grad = g.createLinearGradient(0, judgeY, 0, judgeY - 220)
          grad.addColorStop(0, LANE_COLORS[i] + '55'); grad.addColorStop(1, LANE_COLORS[i] + '00')
          g.fillStyle = grad; g.fillRect(i * laneW, judgeY - 220, laneW, 220)
        }
      }
      g.strokeStyle = '#e7ecf4'; g.lineWidth = 3
      g.beginPath(); g.moveTo(0, judgeY); g.lineTo(W, judgeY); g.stroke()
      g.font = '600 14px system-ui'; g.textAlign = 'center'; g.fillStyle = '#8a97ad'
      KEYS.forEach((k, i) => g.fillText(k.toUpperCase(), i * laneW + laneW / 2, judgeY + 28))
      for (let i = state.next; i < state.notes.length; i++) {
        const n = state.notes[i]
        const y = judgeY - (n.time - t) * cfg.speed
        if (y < -30) break
        if (n.result || y > H + 30) continue
        g.fillStyle = LANE_COLORS[n.lane]
        g.beginPath(); g.roundRect(n.lane * laneW + 8, y - 9, laneW - 16, 18, 9); g.fill()
      }
      const lAge = performance.now() - fx.labelAt
      if (fx.label && lAge < 450) {
        g.globalAlpha = 1 - lAge / 450
        g.font = '800 28px system-ui'; g.fillStyle = RESULT_COLOR[fx.label]
        g.fillText(fx.label.toUpperCase(), W / 2, H * 0.45)
        g.globalAlpha = 1
      }
      if (state.combo > 2) { g.font = '700 20px system-ui'; g.fillStyle = '#e7ecf4'; g.fillText(`${state.combo} combo`, W / 2, H * 0.52) }
      g.textAlign = 'left'; g.font = '600 16px system-ui'; g.fillStyle = '#e7ecf4'
      g.fillText(state.score.toLocaleString(), 12, 24)
      const c4 = state.counts, judged = c4.perfect + c4.great + c4.good + c4.miss
      const liveAcc = judged ? (c4.perfect * 300 + c4.great * 200 + c4.good * 100) / (judged * 300) : 1
      g.textAlign = 'right'; g.fillText(`${(liveAcc * 100).toFixed(1)}%`, W - 12, 24)
      g.fillStyle = '#1c2c47'; g.fillRect(0, H - 4, W, 4)
      g.fillStyle = '#0a93ce'; g.fillRect(0, H - 4, W * Math.max(0, Math.min(1, t / chart.length)), 4)
      if (t > chart.length + 0.5 && !done) {
        done = true
        onEnd({ ...state, accuracy: accuracy(state), letter: letter(state), track: cfg.track, diff: cfg.diff })
        return
      }
      raf = requestAnimationFrame(draw)
    }

    const onHide = () => { if (document.hidden && !live.current.paused) togglePause() }
    engine.start().then(() => { raf = requestAnimationFrame(draw) })
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey)
    const cv = canvas.current
    cv.addEventListener('pointerdown', onPointer); cv.addEventListener('pointerup', onPointer)
    return () => {
      cancelAnimationFrame(raf); engine.stop()
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey)
      cv.removeEventListener('pointerdown', onPointer); cv.removeEventListener('pointerup', onPointer)
    }
  }, [cfg, onEnd])

  return (
    <div className="stage">
      <canvas ref={canvas} className="lanes" aria-label="Rhythm game lanes" />
      {paused && (
        <div className="overlay">
          <h2>Paused</h2>
          <button onClick={() => live.current.toggle()}>Resume</button>
          <button className="ghost" onClick={() => onEnd(null)}>Quit</button>
        </div>
      )}
      <p className="muted center">{cfg.track.title} · {cfg.diff} · <button className="link" onClick={() => live.current?.toggle()}>Pause</button></p>
    </div>
  )
}

function Results({ r, onBack, onRetry }) {
  return (
    <section className="card results">
      <div className="big">{r.letter}</div>
      <h2>{r.track.title} · {r.diff}</h2>
      <p className="score">{r.score.toLocaleString()} points · {(r.accuracy * 100).toFixed(2)}% accuracy</p>
      {r.newBest && <p className="best">New best!</p>}
      <ul className="counts">
        {['perfect', 'great', 'good', 'miss'].map(k => <li key={k}><span style={{ color: RESULT_COLOR[k] }}>{k}</span><b>{r.counts[k]}</b></li>)}
        <li><span>max combo</span><b>{r.maxCombo}</b></li>
      </ul>
      <div className="row"><button onClick={onRetry}>Retry</button><button className="ghost" onClick={onBack}>Menu</button></div>
    </section>
  )
}

export default function App() {
  const [screen, setScreen] = useState({ name: 'menu' })
  const end = useRef(null)
  end.current = (r) => {
    if (!r) { setScreen({ name: 'menu' }); return }
    const best = store.get('pl.best', {})
    const key = `${r.track.id}:${r.diff}`
    const newBest = r.score > 0 && (!best[key] || r.score > best[key].score)
    if (newBest) { best[key] = { score: r.score, letter: r.letter }; store.set('pl.best', best) }
    setScreen(s => ({ name: 'results', r: { ...r, newBest }, cfg: s.cfg }))
  }
  const [onEnd] = useState(() => (r) => end.current(r))
  return (
    <main>
      <header><h1>Pulse <span>Lanes</span></h1><p className="muted">A four-lane rhythm game. Every track is composed in your browser from a seed.</p></header>
      {screen.name === 'menu' && <Menu onPlay={cfg => setScreen({ name: 'game', cfg })} />}
      {screen.name === 'game' && <Game cfg={screen.cfg} onEnd={onEnd} />}
      {screen.name === 'results' && <Results r={screen.r} onBack={() => setScreen({ name: 'menu' })} onRetry={() => setScreen({ name: 'game', cfg: { ...screen.cfg } })} />}
      <footer className="muted">Built by <a href="https://cyberresonance.io" target="_blank" rel="noreferrer">CyberResonance</a>.</footer>
    </main>
  )
}
