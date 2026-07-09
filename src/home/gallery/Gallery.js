import React, { useEffect, useRef, useState } from 'react';
import { useGalleryState } from './hooks/useGalleryState';
import { useGalleryData } from './hooks/useGalleryData';
import { FilterBar } from './components/FilterBar';
import { SortDropdown } from './components/SortDropdown';
import { ResultCount } from './components/ResultCount';
import { EmptyState } from './components/EmptyState';
import { GalleryGrid } from './components/GalleryGrid';

export function Gallery() {
  const {
    state,
    setTaxa, setWaterType, setCareLevel,
    setTemperament, setGrouping, setDietType,
    setCo2, setLighting, setSize, setMaxTankL,
    setReefSafe, setHideAdvisory, setSort, setPage,
    applyPreset, clearAll, removeFilter,
  } = useGalleryState();

  const { items, totalMatching, totalPages, facetCounts, loading } = useGalleryData(state);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const actions = {
    setTaxa, setWaterType, setCareLevel,
    setTemperament, setGrouping, setDietType,
    setCo2, setLighting, setSize, setMaxTankL,
    setReefSafe, setHideAdvisory, applyPreset, clearAll, removeFilter,
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
            <GalleryGrid items={items} />
            {state.page < totalPages && <div ref={sentinelRef} style={{ height: '1px' }} />}
            {loading && <p className="gallery-loading">Loading…</p>}
          </>
        )}
      </div>
    </div>
  );
}
