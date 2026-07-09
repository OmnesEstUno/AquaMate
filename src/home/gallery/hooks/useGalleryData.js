import { useState, useEffect, useRef } from 'react';

const API_BASE = 'https://aquamate-worker.elliotjwarren.workers.dev';

// Build the /api/gallery query string from filter state.
function stateToQuery(state) {
  const q = new URLSearchParams();
  const list = (arr) => arr?.length ? arr.join(',') : null;
  const put = (k, v) => { if (v != null) q.set(k, String(v)); };
  put('taxa', list(state.taxa));
  put('waterType', list(state.waterType));
  put('careLevel', list(state.careLevel));
  put('temperament', list(state.temperament));
  put('grouping', list(state.grouping));
  put('dietType', list(state.dietType));
  put('co2', list(state.co2));
  put('lighting', list(state.lighting));
  put('minSize', state.minSize);
  put('maxSize', state.maxSize);
  put('maxTankL', state.maxTankL);
  put('reefSafe', state.reefSafe ? '1' : null);
  put('hideAdvisory', state.hideAdvisory ? '1' : null);
  put('seed', state.seed);
  put('sort', state.sort);
  put('page', state.page);
  return q.toString();
}

export function useGalleryData(state) {
  const [items, setItems] = useState([]);
  const [totalMatching, setTotalMatching] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [facetCounts, setFacetCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track the "filter identity" (everything except page) so we know when to reset vs append.
  const filterKey = JSON.stringify({ ...state, page: undefined });
  const prevFilterKey = useRef(filterKey);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/gallery?${stateToQuery(state)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data.success) return;
        const filtersChanged = prevFilterKey.current !== filterKey;
        prevFilterKey.current = filterKey;
        if (state.page === 1 || filtersChanged) {
          setItems(data.items);
        } else {
          setItems(prev => [...prev, ...data.items]);
        }
        setTotalMatching(data.totalMatching);
        setTotalPages(data.totalPages);
        setFacetCounts(data.facetCounts || {});
        setError(null);
      })
      .catch(e => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [filterKey, state.page]);

  return { items, totalMatching, totalPages, facetCounts, loading, error };
}
