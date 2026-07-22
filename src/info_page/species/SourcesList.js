import React from 'react';

function SourceItem({ role, s }) {
  return (
    <div className="species-src-item">
      <b>{role}:</b> {s.name}{s.url ? <> — <a href={s.url} target="_blank" rel="noreferrer">{s.url}</a></> : null}
      {s.accessedDate ? ` · ${s.accessedDate}` : ''}
    </div>
  );
}

export function SourcesList({ sources }) {
  if (!sources || (!sources.primary && !(sources.additional || []).length)) return null;
  const additional = sources.additional || [];
  const count = (sources.primary ? 1 : 0) + additional.length;
  return (
    <section className="species-section">
      <div className="glass-panel species-panel">
        <details className="species-src">
          <summary>Sources &amp; citations ({count})</summary>
          {sources.primary && <SourceItem role="Primary" s={sources.primary} />}
          {additional.map((s, i) => <SourceItem key={i} role="Additional" s={s} />)}
        </details>
      </div>
    </section>
  );
}
