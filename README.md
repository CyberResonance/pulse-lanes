# Pulse Lanes

A four-lane rhythm game for the browser. Notes fall down four lanes, and you hit them on the line with **D F J K** or by tapping the screen.

There are no audio files. Every track, from the drums and bass to the chords, is composed in the browser from a seed with the Web Audio API.
The notes you hit are the melody: a hit plays its note, and a miss leaves a gap in the tune.

## Features

- **3 tracks:** Neon Drift (100 BPM), Signal Rush (128 BPM), Overclock (150 BPM). The same seed always gives the same chart, so scores are comparable.
- **3 difficulties:**
  - Easy: quarter notes;
  - Normal: eighth notes and occasional chords;
  - Hard: sixteenth notes and more chords.

  A lighter "breathing" bar comes every 8 bars, and the generator never stacks too many notes in one lane.
- **Fair timing:**
  - judgement uses the audio clock, not frame timing;
  - windows: Perfect ±45 ms, Great ±90 ms, Good ±135 ms;
  - extra taps are never punished.
- **Scoring:** points with a combo bonus, accuracy, max combo, and an S/A/B/C/D grade. Best scores per track and difficulty are saved in your browser.
- **Settings:** scroll speed and a timing offset (−120 to +120 ms) for keyboards or headphones with latency.
- **Pause:** <kbd>Esc</kbd> pauses, and switching to another tab pauses automatically.
- **Touch:** works on phones and tablets.

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Build a static version that you can host anywhere:

```bash
npm run build
```

## Tests

```bash
npm test
```

14 Vitest tests cover:
- the seeded generator and chart determinism;
- note ordering and bounds;
- note density rising with difficulty;
- the no-triple-repeat and beats-only rules on Easy;
- the backing track;
- timing windows, combos, ghost taps, double hits, missed-note sweeping, accuracy and grades.

## How it works

| File | Role |
|---|---|
| `src/game/chart.js` | seeded random generator, chart builder, chord progression (i–VI–III–VII) and backing-track events |
| `src/game/judge.js` | pure functions for hits, misses, scoring and grades |
| `src/game/audio.js` | Web Audio engine: look-ahead scheduler (25 ms tick, 150 ms horizon), synthesised drums, bass, pads and hit sounds |
| `src/App.jsx` | menu, canvas renderer, input and results |

## License

MIT, see [LICENSE](LICENSE). Built by [CyberResonance](https://cyberresonance.io).
