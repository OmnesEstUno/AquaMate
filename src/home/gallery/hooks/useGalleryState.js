import { useState, useCallback, useEffect } from 'react';
import { encodeState, decodeState } from '../../../state/gallery-url';
import { FAUNA_TAXA } from '../../../backend/gallery/constants';

// Cascade rules: which filters clear when their parent condition becomes false.
function applyCascade(next) {
  const s = { ...next };
  const hasSaltwater = s.waterType?.includes('saltwater');
  if (!hasSaltwater) delete s.reefSafe;

  const hasPlantOrMacro = s.taxa?.some(t => t === 'plant' || t === 'macroalgae');
  if (s.taxa?.length && !hasPlantOrMacro) {
    delete s.co2;
  }
  const hasPlantMacroOrCoral = s.taxa?.some(t => t === 'plant' || t === 'macroalgae' || t === 'coral');
  if (s.taxa?.length && !hasPlantMacroOrCoral) {
    delete s.lighting;
  }
  const hasFauna = s.taxa?.some(t => FAUNA_TAXA.has(t));
  if (s.taxa?.length && !hasFauna) {
    delete s.temperament;
    delete s.grouping;
    delete s.dietType;
  }
  return s;
}

function seedFromLocation() {
  if (typeof window === 'undefined') {
    return { seed: 1, page: 1, sort: 'random' };
  }
  const params = new URLSearchParams(window.location.search);
  const f = params.get('f');
  if (f) {
    const decoded = decodeState(f);
    if (decoded.seed) return decoded;
    return { ...decoded, seed: Math.floor(Math.random() * 2 ** 31) };
  }
  return { ...decodeState(''), seed: Math.floor(Math.random() * 2 ** 31) };
}

export function useGalleryState({ initial } = {}) {
  const [state, setState] = useState(() => {
    if (initial) return { seed: 1, page: 1, sort: 'random', ...initial };
    return seedFromLocation();
  });

  // Sync state → URL. Fires on every state change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const encoded = encodeState(state);
    const newUrl = encoded ? `?f=${encoded}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [state]);

  const update = useCallback((partial) => {
    setState(prev => applyCascade({ ...prev, ...partial, page: 1 }));
  }, []);

  const setTaxa = useCallback((taxa) => update({ taxa: taxa.length ? taxa : undefined }), [update]);
  const setWaterType = useCallback((waterType) => update({ waterType: waterType.length ? waterType : undefined }), [update]);
  const setCareLevel = useCallback((careLevel) => update({ careLevel: careLevel.length ? careLevel : undefined }), [update]);
  const setTemperament = useCallback((v) => update({ temperament: v.length ? v : undefined }), [update]);
  const setGrouping = useCallback((v) => update({ grouping: v.length ? v : undefined }), [update]);
  const setDietType = useCallback((v) => update({ dietType: v.length ? v : undefined }), [update]);
  const setCo2 = useCallback((v) => update({ co2: v.length ? v : undefined }), [update]);
  const setLighting = useCallback((v) => update({ lighting: v.length ? v : undefined }), [update]);
  const setSize = useCallback(({ min, max }) => update({ minSize: min, maxSize: max }), [update]);
  const setMaxTankL = useCallback((v) => update({ maxTankL: v }), [update]);
  const setReefSafe = useCallback((v) => update({ reefSafe: v || undefined }), [update]);
  const setHideAdvisory = useCallback((v) => update({ hideAdvisory: v || undefined }), [update]);
  const setSort = useCallback((sort) => update({ sort }), [update]);
  const setPage = useCallback((page) => setState(prev => ({ ...prev, page })), []);

  const applyPreset = useCallback((preset) => {
    setState(prev => ({ ...preset, seed: prev.seed, page: 1, sort: prev.sort || 'random' }));
  }, []);

  const clearAll = useCallback(() => {
    setState(prev => ({ seed: prev.seed, page: 1, sort: 'random' }));
  }, []);

  const removeFilter = useCallback((key) => {
    setState(prev => {
      const next = { ...prev };
      delete next[key];
      return applyCascade({ ...next, page: 1 });
    });
  }, []);

  return {
    state,
    setTaxa, setWaterType, setCareLevel,
    setTemperament, setGrouping, setDietType,
    setCo2, setLighting,
    setSize, setMaxTankL,
    setReefSafe, setHideAdvisory,
    setSort, setPage,
    applyPreset, clearAll, removeFilter,
  };
}
