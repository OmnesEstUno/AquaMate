import React from 'react';
import { WaterGauges } from './WaterGauges';

export function SetupPanel({ item, taxon }) {
  const decor = (item.tank && item.tank.decorPreferences) || [];
  const sand = item.tank && item.tank.minSandDepthCm;
  return (
    <section className="species-section">
      <h3 className="species-section-h">Aquarium setup</h3>
      <div className="glass-panel species-panel">
        {decor.length > 0 && (
          <p className="species-prose species-setup-decor">
            <b>Decor:</b> {decor.join(', ')}.
            {sand != null && <> <b>Sand bed:</b> {sand} cm.</>}
          </p>
        )}
        <WaterGauges waterParameters={item.waterParameters} />
        {taxon.setup.length > 0 && (
          <div className="species-kv species-setup-kv">
            {taxon.setup.map(([k, v]) => (
              <React.Fragment key={k}><div className="species-kv__k">{k}</div><div className="species-kv__v">{v}</div></React.Fragment>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
