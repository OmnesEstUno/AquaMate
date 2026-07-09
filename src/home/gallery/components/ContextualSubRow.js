import React from 'react';

export function ContextualSubRow({ label, visible, children }) {
  return (
    <div className={`gallery-subrow ${visible ? 'is-visible' : 'is-hidden'}`}>
      <div className="gallery-subrow__label">{label}</div>
      <div className="gallery-subrow__body">{children}</div>
    </div>
  );
}
