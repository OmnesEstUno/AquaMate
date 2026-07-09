import { renderHook, act } from '@testing-library/react';
import { useGalleryState } from '../useGalleryState';

describe('useGalleryState — cascade', () => {
  test('deselecting saltwater clears reefSafe', () => {
    const { result } = renderHook(() => useGalleryState({ initial: { waterType: ['saltwater'], reefSafe: true } }));
    expect(result.current.state.reefSafe).toBe(true);

    act(() => result.current.setWaterType([]));
    expect(result.current.state.reefSafe).toBeUndefined();
  });

  test('removing all plant/macroalgae taxa clears co2 and lighting', () => {
    const { result } = renderHook(() => useGalleryState({ initial: { taxa: ['plant'], co2: ['recommended'], lighting: ['high'] } }));
    act(() => result.current.setTaxa(['fish']));
    expect(result.current.state.co2).toBeUndefined();
    expect(result.current.state.lighting).toBeUndefined();
  });

  test('removing all fauna taxa clears temperament/grouping/diet', () => {
    const { result } = renderHook(() => useGalleryState({ initial: { taxa: ['fish'], temperament: ['peaceful'] } }));
    act(() => result.current.setTaxa(['plant']));
    expect(result.current.state.temperament).toBeUndefined();
  });

  test('changing a filter resets page to 1', () => {
    const { result } = renderHook(() => useGalleryState({ initial: { page: 5 } }));
    act(() => result.current.setTaxa(['fish']));
    expect(result.current.state.page).toBe(1);
  });

  test('applyPreset replaces the entire state (except seed)', () => {
    const { result } = renderHook(() => useGalleryState({ initial: { seed: 999, taxa: ['fish'], careLevel: ['expert'] } }));
    act(() => result.current.applyPreset({ taxa: ['plant'], waterType: ['freshwater'], careLevel: ['beginner'] }));
    expect(result.current.state.seed).toBe(999);
    expect(result.current.state.taxa).toEqual(['plant']);
    expect(result.current.state.careLevel).toEqual(['beginner']);
  });
});
