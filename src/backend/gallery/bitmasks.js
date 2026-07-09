const {
  TAXA, WATER_TYPES, CARE_LEVELS,
  TEMPERAMENTS, GROUPINGS, DIET_TYPES,
  CO2_OPTIONS, LIGHTING_OPTIONS,
} = require('./constants');

function makeCodec(options) {
  const bitByName = Object.fromEntries(options.map((name, i) => [name, 1 << i]));
  const nameByBit = options.map((name, i) => ({ name, bit: 1 << i }));

  function encode(names) {
    if (!Array.isArray(names)) return 0;
    let mask = 0;
    for (const name of names) {
      if (bitByName[name]) mask |= bitByName[name];
    }
    return mask;
  }

  function decode(mask) {
    if (!Number.isInteger(mask) || mask <= 0) return [];
    return nameByBit.filter(({ bit }) => (mask & bit) === bit).map(({ name }) => name);
  }

  return { encode, decode };
}

const taxa = makeCodec(TAXA);
const waterType = makeCodec(WATER_TYPES);
const careLevel = makeCodec(CARE_LEVELS);
const temperament = makeCodec(TEMPERAMENTS);
const grouping = makeCodec(GROUPINGS);
const dietType = makeCodec(DIET_TYPES);
const co2 = makeCodec(CO2_OPTIONS);
const lighting = makeCodec(LIGHTING_OPTIONS);

module.exports = {
  encodeTaxa: taxa.encode,           decodeTaxa: taxa.decode,
  encodeWaterType: waterType.encode, decodeWaterType: waterType.decode,
  encodeCareLevel: careLevel.encode, decodeCareLevel: careLevel.decode,
  encodeTemperament: temperament.encode, decodeTemperament: temperament.decode,
  encodeGrouping: grouping.encode,   decodeGrouping: grouping.decode,
  encodeDietType: dietType.encode,   decodeDietType: dietType.decode,
  encodeCo2: co2.encode,             decodeCo2: co2.decode,
  encodeLighting: lighting.encode,   decodeLighting: lighting.decode,
};
