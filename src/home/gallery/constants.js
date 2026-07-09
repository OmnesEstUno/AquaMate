export const SORT_OPTIONS = [
  { value: 'random',    label: 'Random' },
  { value: 'az',        label: 'Common name A → Z' },
  { value: 'za',        label: 'Common name Z → A' },
  { value: 'size-asc',  label: 'Smallest first' },
  { value: 'size-desc', label: 'Largest first' },
  { value: 'care-asc',  label: 'Easiest first' },
  { value: 'care-desc', label: 'Hardest first' },
  { value: 'tank-asc',  label: 'Smallest tank first' },
  { value: 'tank-desc', label: 'Largest tank first' },
];

export const PRESETS = [
  { id: 'beginner-fw',   label: 'Beginner FW community',
    state: { taxa: ['fish'], waterType: ['freshwater'], careLevel: ['beginner'], temperament: ['peaceful'] } },
  { id: 'reef-inverts',  label: 'Reef-safe inverts',
    state: { taxa: ['crustacean', 'mollusc', 'echinoderm'], waterType: ['saltwater'], reefSafe: true } },
  { id: 'nano-tank',     label: 'Nano tank ≤ 40 L',
    state: { maxSize: 10, maxTankL: 40 } },
  { id: 'easy-planted',  label: 'Easy planted',
    state: { taxa: ['plant'], waterType: ['freshwater'], careLevel: ['beginner'] } },
  { id: 'intro-reef',    label: 'Introductory reef',
    state: { taxa: ['coral'], waterType: ['saltwater'], careLevel: ['beginner'] } },
];
