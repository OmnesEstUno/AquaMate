import React from 'react';
import { ImageGallery } from './ImageGallery';
import { AliasTooltip } from './AliasTooltip';
import { LocationChips } from './LocationChips';
import { CareLevelBadge } from '../../home/gallery/components/CareLevelBadge';
import { titleCase } from './format';

export function SpeciesHero({ item, images }) {
  const tx = item.taxonomy || {};
  const nr = item.nativeRange || {};
  const waterLine = titleCase(item.waterType);
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
        {item.careLevel && (
          <div className="species-care-row"><CareLevelBadge level={item.careLevel} /></div>
        )}
      </div>
      <aside className="species-hero__habitat glass-panel species-panel">
        <p className="species-label">Habitat</p>
        {nr.habitat && <p className="species-prose species-habitat-text">{nr.habitat}</p>}
        {nr.biotope && (
          <div className="species-biotope">
            <b>Biotope</b>{nr.biotope}
          </div>
        )}
      </aside>
    </section>
  );
}
