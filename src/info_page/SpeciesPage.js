import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import AMHeader from '../header';
import AMFooter from '../footer';
import { AdvisoryBanner } from './species/AdvisoryBanner';
import { SpeciesHero } from './species/SpeciesHero';
import { VitalStatRail } from './species/VitalStatRail';
import { ProseSection } from './species/ProseSection';
import { SetupPanel } from './species/SetupPanel';
import { TankmatesTraits } from './species/TankmatesTraits';
import { SourcesList } from './species/SourcesList';
import { taxonDisplay, breedingHeading } from './species/taxonFields';
import { buildSpeciesImages } from '../lib/speciesImages';
import '../styles/species-page.css';

const API_BASE = 'https://aquamate-worker.elliotjwarren.workers.dev';

export default function SpeciesPage() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState(false);
  const mainRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setItem(null); setError(false);
    fetch(`${API_BASE}/api/species/${encodeURIComponent(slug)}`)
      .then((r) => { if (!r.ok) throw new Error('http'); return r.json(); })
      .then((data) => { if (cancelled) return; if (data && data.success && data.item) setItem(data.item); else setError(true); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [slug]);

  // Reuse the real AMHeader wave partition, gallery-style: it starts expanded
  // (hero-mode waves) and collapses via `not-at-top` once the user scrolls. The
  // `species-header` class keeps the inner bar compact while the waves are expanded.
  useEffect(() => {
    const header = document.getElementById('header');
    const main = mainRef.current;
    if (!header) return undefined;
    header.classList.add('species-header');
    const onScroll = () => header.classList.toggle('not-at-top', (main ? main.scrollTop : 0) > 0);
    onScroll();
    if (main) main.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (main) main.removeEventListener('scroll', onScroll);
      header.classList.remove('species-header', 'not-at-top');
    };
  }, []);

  return (
    <div>
      <AMHeader />
      <main className="full-bleed-bg scroll-hidden species-main" ref={mainRef}>
        {error && <div className="species-status">We couldn’t load this species. It may not exist yet.</div>}
        {!error && !item && <div className="species-status">Loading…</div>}
        {item && <SpeciesBody item={item} />}
      </main>
      <AMFooter />
    </div>
  );
}

function SpeciesBody({ item }) {
  const images = buildSpeciesImages(item);
  const tx = taxonDisplay(item);
  const c = item.compatibility || {};
  return (
    <>
      <AdvisoryBanner advisory={item.hobbyistAdvisory} />
      <SpeciesHero item={item} images={images} />
      <div className="species-flow">
        <section className="glass-panel species-panel"><VitalStatRail item={item} /></section>

        <ProseSection title="Overview" text={item.summary}>
          {tx.warnChips.length > 0 && (
            <div className="species-callout">
              <span aria-hidden="true">⚠️</span>
              <span><b>Care-critical:</b> {tx.warnChips.join(' · ')}. Review the care guide before keeping this species.</span>
            </div>
          )}
        </ProseSection>

        <div className="species-two">
          <ProseSection title="Care guide" text={item.careNotes} />
          <ProseSection title={breedingHeading(item)} text={item.breedingNotes} />
        </div>

        {item.diet && item.diet.notes && <ProseSection title="Diet" text={item.diet.notes} />}

        <div className="species-two">
          <SetupPanel item={item} taxon={tx} />
          <TankmatesTraits good={c.goodWith} avoid={c.avoidWith} ratings={tx.ratings}
                           warnChips={tx.warnChips} traitChips={tx.traitChips} />
        </div>

        <SourcesList sources={item.sources} />
        <div className="species-flow__spacer" />
      </div>
    </>
  );
}
