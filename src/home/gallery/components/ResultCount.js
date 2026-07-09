import React from 'react';

export function ResultCount({ count }) {
  return (
    <div className="gallery-count">
      Showing <strong>{count.toLocaleString()}</strong> {count === 1 ? 'species' : 'species'}
    </div>
  );
}
