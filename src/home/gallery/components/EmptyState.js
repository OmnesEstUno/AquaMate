import React from 'react';

export function EmptyState({ onClearAll }) {
  return (
    <div className="gallery-empty">
      <h2 className="gallery-empty__title">Oh no! All the fish have been scared off.</h2>
      <p className="gallery-empty__body">Try removing some filter options to lure them back in.</p>
      <button className="gallery-empty__clear" type="button" onClick={onClearAll}>
        Clear all filters
      </button>
    </div>
  );
}
