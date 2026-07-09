const {
  encodeTaxa, decodeTaxa,
  encodeWaterType, decodeWaterType,
  encodeCareLevel, decodeCareLevel,
  encodeTemperament, decodeTemperament,
  encodeGrouping, decodeGrouping,
  encodeDietType, decodeDietType,
  encodeCo2, decodeCo2,
  encodeLighting, decodeLighting,
} = require('../backend/gallery/bitmasks');

const DEFAULTS = { page: 1, sort: 'random' };
const KEY_RE = /^[a-z]+/;

// Match a known field key at the start of a token, preferring longer keys.
// This lets values like 'size-desc' work under the 'sr' key without the
// tokenizer greedily eating the value's leading letters.
function matchKnownKey(token, knownKeys) {
  const letters = token.match(KEY_RE)?.[0] ?? '';
  if (!letters) return null;
  for (let len = Math.min(letters.length, 2); len >= 1; len--) {
    const candidate = letters.slice(0, len);
    if (knownKeys.has(candidate)) return candidate;
  }
  return null;
}

const ENUM_FIELDS = [
  { key: 't',  state: 'taxa',        encode: encodeTaxa,        decode: decodeTaxa },
  { key: 'w',  state: 'waterType',   encode: encodeWaterType,   decode: decodeWaterType },
  { key: 'c',  state: 'careLevel',   encode: encodeCareLevel,   decode: decodeCareLevel },
  { key: 'tm', state: 'temperament', encode: encodeTemperament, decode: decodeTemperament },
  { key: 'g',  state: 'grouping',    encode: encodeGrouping,    decode: decodeGrouping },
  { key: 'd',  state: 'dietType',    encode: encodeDietType,    decode: decodeDietType },
  { key: 'co', state: 'co2',         encode: encodeCo2,         decode: decodeCo2 },
  { key: 'l',  state: 'lighting',    encode: encodeLighting,    decode: decodeLighting },
];

const INT_FIELDS = [
  { key: 'mn', state: 'minSize' },
  { key: 'mx', state: 'maxSize' },
  { key: 'tk', state: 'maxTankL' },
];

const BOOL_FIELDS = [
  { key: 'rs', state: 'reefSafe' },
  { key: 'hd', state: 'hideAdvisory' },
];

const STRING_FIELDS = [
  { key: 'sr', state: 'sort', skipIf: v => v === 'random' },
];

const SEED_FIELD = { key: 'sd', state: 'seed' };
const PAGE_FIELD = { key: 'p', state: 'page', skipIf: v => v === 1 };

const INT_LOOKUP = [...INT_FIELDS, SEED_FIELD, PAGE_FIELD];

const KNOWN_KEYS = new Set([
  ...ENUM_FIELDS.map(f => f.key),
  ...INT_LOOKUP.map(f => f.key),
  ...BOOL_FIELDS.map(f => f.key),
  ...STRING_FIELDS.map(f => f.key),
]);

function encodeState(state) {
  const parts = [];
  for (const f of ENUM_FIELDS) {
    if (state[f.state]?.length) {
      const mask = f.encode(state[f.state]);
      if (mask > 0) parts.push(f.key + mask);
    }
  }
  for (const f of INT_FIELDS) {
    const v = state[f.state];
    if (v == null) continue;
    if (f.skipIf && f.skipIf(v)) continue;
    parts.push(f.key + v);
  }
  for (const f of BOOL_FIELDS) {
    if (state[f.state] === true) parts.push(f.key + '1');
  }
  for (const f of STRING_FIELDS) {
    const v = state[f.state];
    if (v == null) continue;
    if (f.skipIf && f.skipIf(v)) continue;
    parts.push(f.key + v);
  }
  // seed comes after strings/bools, before page
  {
    const v = state[SEED_FIELD.state];
    if (v != null) parts.push(SEED_FIELD.key + v);
  }
  {
    const v = state[PAGE_FIELD.state];
    if (v != null && !PAGE_FIELD.skipIf(v)) parts.push(PAGE_FIELD.key + v);
  }
  return parts.join('.');
}

function decodeState(str) {
  const state = { ...DEFAULTS };
  if (!str) return state;
  for (const token of str.split('.')) {
    const key = matchKnownKey(token, KNOWN_KEYS);
    if (!key) continue;
    const rawVal = token.slice(key.length);

    const enumField = ENUM_FIELDS.find(f => f.key === key);
    if (enumField) {
      state[enumField.state] = enumField.decode(parseInt(rawVal, 10));
      continue;
    }
    const intField = INT_LOOKUP.find(f => f.key === key);
    if (intField) {
      const n = parseInt(rawVal, 10);
      if (!Number.isNaN(n)) state[intField.state] = n;
      continue;
    }
    const boolField = BOOL_FIELDS.find(f => f.key === key);
    if (boolField) {
      state[boolField.state] = rawVal === '1';
      continue;
    }
    const stringField = STRING_FIELDS.find(f => f.key === key);
    if (stringField) {
      state[stringField.state] = rawVal;
      continue;
    }
    // unknown key — ignore per spec
  }
  return state;
}

module.exports = { encodeState, decodeState };
