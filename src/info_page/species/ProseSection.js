import React from 'react';

// Splits authored prose (which uses "\n\n" between paragraphs) into <p>s.
export function ProseSection({ title, text, children }) {
  if (!text && !children) return null;
  const paras = text ? String(text).split(/\n\n+/) : [];
  return (
    <section className="species-section">
      {title && <h3 className="species-section-h">{title}</h3>}
      <div className="glass-panel species-panel species-prose">
        {paras.map((p, i) => <p key={i}>{p}</p>)}
        {children}
      </div>
    </section>
  );
}
