/** Pitch classes, names and the material every game draws from. MIDI 60 = C4. */

export type Naming = "sharp" | "flat" | "solfege";

const NAMES: Record<Naming, string[]> = {
  sharp: ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"],
  flat: ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"],
  // Fixed do: the names stick to the pitch, which is the point of absolute pitch.
  solfege: ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"],
};

export const pcName = (pc: number, naming: Naming) => NAMES[naming][((pc % 12) + 12) % 12];
export const pcOf = (midi: number) => ((midi % 12) + 12) % 12;
export const isBlack = (pc: number) => [1, 3, 6, 8, 10].includes(pc);
export const midiOf = (pc: number, octave: number) => 12 * (octave + 1) + pc;

/** "Ds4" → 63, the file naming of the sample sets. */
export function parseNote(name: string): number {
  const m = /^([A-G])(s?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as "C"];
  return midiOf(base + (m[2] ? 1 : 0), Number(m[3]));
}

export const rand = (n: number) => Math.floor(Math.random() * n);
export const pick = <T>(xs: readonly T[]): T => xs[rand(xs.length)];
export function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

export type Item = { id: string; name: string };

/** Ordered easiest first: games unlock them in this order. */
export const INTERVALS: (Item & { semis: number })[] = [
  { id: "P8", name: "Octave", semis: 12 },
  { id: "P5", name: "Perfect 5th", semis: 7 },
  { id: "M3", name: "Major 3rd", semis: 4 },
  { id: "P4", name: "Perfect 4th", semis: 5 },
  { id: "m3", name: "Minor 3rd", semis: 3 },
  { id: "M2", name: "Major 2nd", semis: 2 },
  { id: "M6", name: "Major 6th", semis: 9 },
  { id: "m7", name: "Minor 7th", semis: 10 },
  { id: "m2", name: "Minor 2nd", semis: 1 },
  { id: "m6", name: "Minor 6th", semis: 8 },
  { id: "M7", name: "Major 7th", semis: 11 },
  { id: "TT", name: "Tritone", semis: 6 },
];

export const CHORDS: (Item & { tones: number[] })[] = [
  { id: "maj", name: "Major", tones: [0, 4, 7] },
  { id: "min", name: "Minor", tones: [0, 3, 7] },
  { id: "dim", name: "Diminished", tones: [0, 3, 6] },
  { id: "aug", name: "Augmented", tones: [0, 4, 8] },
  { id: "dom7", name: "Dominant 7", tones: [0, 4, 7, 10] },
  { id: "maj7", name: "Major 7", tones: [0, 4, 7, 11] },
  { id: "min7", name: "Minor 7", tones: [0, 3, 7, 10] },
  { id: "sus4", name: "Sus 4", tones: [0, 5, 7] },
  { id: "sus2", name: "Sus 2", tones: [0, 2, 7] },
  { id: "hdim7", name: "Half-dim 7", tones: [0, 3, 6, 10] },
  { id: "dim7", name: "Dim 7", tones: [0, 3, 6, 9] },
  { id: "mmaj7", name: "Minor-maj 7", tones: [0, 3, 7, 11] },
];

export const SCALES: (Item & { steps: number[] })[] = [
  { id: "major", name: "Major", steps: [0, 2, 4, 5, 7, 9, 11, 12] },
  { id: "minor", name: "Natural minor", steps: [0, 2, 3, 5, 7, 8, 10, 12] },
  { id: "majpent", name: "Major pent.", steps: [0, 2, 4, 7, 9, 12] },
  { id: "minpent", name: "Minor pent.", steps: [0, 3, 5, 7, 10, 12] },
  { id: "harm", name: "Harmonic minor", steps: [0, 2, 3, 5, 7, 8, 11, 12] },
  { id: "dorian", name: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10, 12] },
  { id: "mixo", name: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10, 12] },
  { id: "blues", name: "Blues", steps: [0, 3, 5, 6, 7, 10, 12] },
  { id: "lydian", name: "Lydian", steps: [0, 2, 4, 6, 7, 9, 11, 12] },
  { id: "phryg", name: "Phrygian", steps: [0, 1, 3, 5, 7, 8, 10, 12] },
  { id: "melo", name: "Melodic minor", steps: [0, 2, 3, 5, 7, 9, 11, 12] },
  { id: "whole", name: "Whole tone", steps: [0, 2, 4, 6, 8, 10, 12] },
  { id: "locrian", name: "Locrian", steps: [0, 1, 3, 5, 6, 8, 10, 12] },
  { id: "chrom", name: "Chromatic", steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
];

/** Diatonic chords of a major key: root offset and quality. */
const DEGREES: Record<string, [number, number[]]> = {
  I: [0, [0, 4, 7]],
  ii: [2, [0, 3, 7]],
  iii: [4, [0, 3, 7]],
  IV: [5, [0, 4, 7]],
  V: [7, [0, 4, 7]],
  V7: [7, [0, 4, 7, 10]],
  vi: [9, [0, 3, 7]],
  "♭VII": [10, [0, 4, 7]],
};

export const PROGRESSIONS: (Item & { chords: string[] })[] = [
  { id: "1451", name: "I IV V I", chords: ["I", "IV", "V", "I"] },
  { id: "1564", name: "I V vi IV", chords: ["I", "V", "vi", "IV"] },
  { id: "1645", name: "I vi IV V", chords: ["I", "vi", "IV", "V"] },
  { id: "251", name: "ii V I", chords: ["I", "ii", "V7", "I"] },
  { id: "6415", name: "vi IV I V", chords: ["vi", "IV", "I", "V"] },
  { id: "1465", name: "I IV vi V", chords: ["I", "IV", "vi", "V"] },
  { id: "1625", name: "I vi ii V", chords: ["I", "vi", "ii", "V"] },
  { id: "1b741", name: "I ♭VII IV I", chords: ["I", "♭VII", "IV", "I"] },
  { id: "1345", name: "I iii IV V", chords: ["I", "iii", "IV", "V"] },
];

/** Closest-moving voicings for a run of chords, bass an octave under. Notes are MIDI. */
export function voiceProgression(tonic: number, chords: string[]): number[][] {
  let prev: number[] | null = null;
  return chords.map((deg) => {
    const [root, tones] = DEGREES[deg];
    const pcs = tones.map((t) => pcOf(tonic + root + t));
    let best: number[] = [];
    let bestCost = Infinity;
    for (let inv = 0; inv < pcs.length; inv++) {
      const order = pcs.slice(inv).concat(pcs.slice(0, inv));
      // Stack upwards, lowest note between A♯3 and A4.
      const notes: number[] = [];
      let n = 58;
      for (const pc of order) {
        while (pcOf(n) !== pc) n++;
        notes.push(n);
        n++;
      }
      const cost = prev
        ? notes.reduce((s, x) => s + Math.min(...prev!.map((p) => Math.abs(p - x))), 0)
        : Math.abs(notes[0] - 64);
      if (cost < bestCost) [best, bestCost] = [notes, cost];
    }
    prev = best;
    const bass = 36 + pcOf(tonic + root);
    return [bass < 40 ? bass + 12 : bass, ...best];
  });
}

/** A cadence that pins a key down: I IV V7 I, or i iv V7 i. */
export function cadence(tonic: number, minor: boolean): number[][] {
  if (!minor) return voiceProgression(tonic, ["I", "IV", "V7", "I"]);
  return voiceProgression(tonic, ["I", "IV", "V7", "I"]).map((chord, i) =>
    // Flatten the third of i and iv.
    i === 2 ? chord : chord.map((n) => (pcOf(n - tonic) === (i === 1 ? 9 : 4) ? n - 1 : n)),
  );
}
