import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useGalleryState } from './hooks/useGalleryState';
import { useGalleryData } from './hooks/useGalleryData';
import { useSearch } from '../../search/search_provider';
import { FilterBar } from './components/FilterBar';
import { SortDropdown } from './components/SortDropdown';
import { ResultCount } from './components/ResultCount';
import { EmptyState } from './components/EmptyState';
import { GalleryGrid } from './components/GalleryGrid';

// ── Custom presets: localStorage with 7-day expiry ────────────────────────────
const CUSTOM_PRESETS_KEY = 'aquamate.customPresets.v1';
const CUSTOM_PRESET_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function loadCustomPresets() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const fresh = (parsed.presets || []).filter(p =>
      p && p.createdAt && (now - p.createdAt) < CUSTOM_PRESET_TTL_MS
    );
    return fresh;
  } catch {
    return [];
  }
}

function saveCustomPresets(presets) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify({ version: 1, presets }));
  } catch { /* quota exceeded etc. — non-fatal */ }
}

export function Gallery() {
  const {
    state,
    setTaxa, setWaterType, setCareLevel,
    setTemperament, setGrouping, setDietType,
    setCo2, setLighting, setSize, setMaxTankL,
    setReefSafe, setHideAdvisory, setSort, setPage,
    applyPreset, clearAll, removeFilter,
  } = useGalleryState();

  // Merge the header's search term into the request state — search narrows
  // the gallery itself rather than showing a separate results panel.
  const { searchTerm } = useSearch();
  const effectiveState = useMemo(
    () => ({ ...state, q: searchTerm }),
    [state, searchTerm]
  );

  // Search fires via context, bypassing useGalleryState's setters — so it doesn't
  // reset page. Without this, a user who has scrolled past page 1 and then starts
  // typing sees `totalMatching` update correctly but the grid goes empty (server
  // returns page N of a smaller result set that no longer has that page).
  useEffect(() => {
    setPage(1);
  }, [searchTerm, setPage]);

  const { items, totalMatching, totalPages, facetCounts, loading } = useGalleryData(effectiveState);

  // Sidebar starts collapsed — filters are one tap away, gallery gets the full width by default.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Custom presets (localStorage-backed, 7-day expiry)
  const [customPresets, setCustomPresets] = useState(() => loadCustomPresets());
  const [pendingPresetId, setPendingPresetId] = useState(null);

  // Persist on every change
  useEffect(() => {
    saveCustomPresets(customPresets);
  }, [customPresets]);

  const savePresetFromCurrent = useCallback(() => {
    const id = 'custom-' + Math.floor(Math.random() * 1e9);
    // Preset stores filter shape; seed and page reset on apply.
    const { seed: _s, page: _p, ...filterState } = state;
    setCustomPresets(prev => [
      ...prev,
      { id, label: '', state: filterState, createdAt: Date.now() },
    ]);
    setPendingPresetId(id);
  }, [state]);

  const commitPresetName = useCallback((id, label) => {
    setCustomPresets(prev => prev.map(p =>
      p.id === id ? { ...p, label: (label || '').trim() || 'Untitled' } : p
    ));
    setPendingPresetId(null);
  }, []);

  const deletePreset = useCallback((id) => {
    setCustomPresets(prev => prev.filter(p => p.id !== id));
    setPendingPresetId(prev => (prev === id ? null : prev));
  }, []);

  const actions = {
    setTaxa, setWaterType, setCareLevel,
    setTemperament, setGrouping, setDietType,
    setCo2, setLighting, setSize, setMaxTankL,
    setReefSafe, setHideAdvisory, applyPreset, clearAll, removeFilter,
    // Custom preset actions
    savePresetFromCurrent, commitPresetName, deletePreset,
    customPresets, pendingPresetId,
  };

  // Infinite scroll sentinel
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!sentinelRef.current || state.page >= totalPages || loading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && state.page < totalPages) {
        setPage(state.page + 1);
      }
    }, { rootMargin: '400px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [state.page, totalPages, loading, setPage]);

  return (
    <div className={`gallery-layout ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
      <aside className="gallery-sidebar">
        <button
          type="button"
          className="gallery-sidebar__toggle"
          onClick={() => setSidebarCollapsed(v => !v)}
          aria-label={sidebarCollapsed ? 'Show filters' : 'Hide filters'}
          title={sidebarCollapsed ? 'Show filters' : 'Hide filters'}
        >
          {sidebarCollapsed ? '☰' : '✕'}
        </button>
        {!sidebarCollapsed && (
          <FilterBar state={state} facetCounts={facetCounts} actions={actions} />
        )}
      </aside>

      <div className="gallery-main">
        <div className="gallery-toolbar">
          <ResultCount count={totalMatching} />
          <SortDropdown value={state.sort} onChange={setSort} />
        </div>

        {totalMatching === 0 && !loading ? (
          <EmptyState onClearAll={clearAll} />
        ) : (
          <>
            <GalleryGrid items={items} query={searchTerm} />
            {state.page < totalPages && <div ref={sentinelRef} style={{ height: '1px' }} />}
            {loading && <p className="gallery-loading">Loading…</p>}
          </>
        )}
      </div>
    </div>
  );
}
