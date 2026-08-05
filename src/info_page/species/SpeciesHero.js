import React from 'react';
import { ImageGallery } from './ImageGallery';
import { AliasTooltip } from './AliasTooltip';
import { LocationChips } from './LocationChips';
import { CareLevelBadge } from '../../home/gallery/components/CareLevelBadge';
import { VitalStatRail } from './VitalStatRail';
import { titleCase } from './format';

export function SpeciesHero({ item, images }) {
  const tx = item.taxonomy || {};
  const nr = item.nativeRange || {};
  const waterLine = titleCase(item.waterType);
  const decor = (item.tank && item.tank.decorPreferences) || [];
  const sand = item.tank && item.tank.minSandDepthCm;
  return (
    <section className="species-hero">
      <div className="species-hero__fig">
        <ImageGallery images={images} alt={item.commonName} />
      </div>
      <div className="species-hero__text">
        <h1 className="species-sci">{item.scientificName}</h1>
        <h2 className="species-common">
          Common name: <AliasTooltip label={item.commonName} aliases={item.alsoKnownAs || []} />
        </h2>
        <div className="species-meta-line">
          {item.category}
          {(tx.family || tx.order) && <> · <i>{tx.family}</i>{tx.order ? ` / ${tx.order}` : ''}</>}
        </div>
        {waterLine && <div className="species-meta-line">{waterLine}</div>}
        <LocationChips regions={nr.regions} countries={nr.countries} depth={nr.depthRangeM} />
        {nr.biotope && (
          <div className="species-biotope-line">
            <span className="species-biotope-line__k">Biotope</span> {nr.biotope}
          </div>
        )}
        {item.careLevel && (
          <div className="species-care-row"><CareLevelBadge level={item.careLevel} /></div>
        )}
      </div>
      <aside className="species-hero__setup glass-panel species-panel">
        <p className="species-label">Aquarium setup</p>
        <VitalStatRail item={item} />
        {decor.length > 0 && (
          <div className="species-setup-decor">
            <p className="species-label">Decor</p>
            <p className="species-prose">
              {decor.join(', ')}.
              {sand != null && <> <b>Sand bed:</b> {sand} cm.</>}
            </p>
          </div>
        )}
      </aside>
    </section>
  );
}
