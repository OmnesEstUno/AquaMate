import React from 'react';

const chip = (cls) => (t) => <span key={t} className={`species-chip species-chip--${cls}`}>{t}</span>;

export function TankmatesTraits({ good = [], avoid = [], ratings = [], warnChips = [], traitChips = [] }) {
  return (
    <section className="species-section">
      <h3 className="species-section-h">Tankmates &amp; traits</h3>
      <div className="glass-panel species-panel">
        {good.length > 0 && <>
          <p className="species-label">Gets along with</p>
          <div className="species-chips">{good.map(chip('good'))}</div>
        </>}
        {avoid.length > 0 && <>
          <p className="species-label">Avoid</p>
          <div className="species-chips">{avoid.map(chip('avoid'))}</div>
        </>}
        {ratings.length > 0 && (
          <div className="species-kv">
            {ratings.map(([k, v]) => (
              <React.Fragment key={k}><div className="species-kv__k">{k}</div><div className="species-kv__v">{v}</div></React.Fragment>
            ))}
          </div>
        )}
        {(warnChips.length > 0 || traitChips.length > 0) && <>
          <p className="species-label">Traits &amp; flags</p>
          <div className="species-chips">{warnChips.map(chip('warn'))}{traitChips.map(chip('trait'))}</div>
        </>}
      </div>
    </section>
  );
}
