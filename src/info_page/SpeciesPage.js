import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import AMHeader from '../header';
import AMFooter from '../footer';
import { AdvisoryBanner } from './species/AdvisoryBanner';
import { SpeciesHero } from './species/SpeciesHero';
import { Waves } from './species/Waves';
import { ProseSection } from './species/ProseSection';
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
  const waveRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setItem(null); setError(false);
    fetch(`${API_BASE}/api/species/${encodeURIComponent(slug)}`)
      .then((r) => { if (!r.ok) throw new Error('http'); return r.json(); })
      .then((data) => { if (cancelled) return; if (data && data.success && data.item) setItem(data.item); else setError(true); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [slug]);

  // The wave partition is a fixed backdrop BEHIND the content (the header can't do
  // this — it's a fixed top layer). It starts expanded (hero-mode) and collapses to
  // the compact band once scrolled. `species-header` hides the header's own waves.
  useEffect(() => {
    const header = document.getElementById('header');
    const main = mainRef.current;
    const wave = waveRef.current;
    if (header) header.classList.add('species-header');
    const onScroll = () => { if (wave) wave.classList.toggle('is-compact', (main ? main.scrollTop : 0) > 0); };
    onScroll();
    if (main) main.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (main) main.removeEventListener('scroll', onScroll);
      if (header) header.classList.remove('species-header');
    };
  }, []);

  return (
    <div>
      <AMHeader />
      <div className="species-wave-bg" ref={waveRef} aria-hidden="true"><Waves /></div>
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
  const habitat = item.nativeRange && item.nativeRange.habitat;
  const overview = [item.summary, habitat].filter(Boolean).join('\n\n');
  return (
    <>
      <AdvisoryBanner advisory={item.hobbyistAdvisory} />
      <SpeciesHero item={item} images={images} />
      <div className="species-flow">
        <ProseSection title="Overview" text={overview}>
          {tx.warnChips.length > 0 && (
            <div className="species-callout">
              <span aria-hidden="true">⚠️</span>
              <span><b>Care-critical:</b> {tx.warnChips.join(' · ')}. Review the care guide before keeping this species.</span>
            </div>
          )}
        </ProseSection>

        <ProseSection title="Care guide" text={item.careNotes} />
        <ProseSection title={breedingHeading(item)} text={item.breedingNotes} />

        {item.diet && item.diet.notes && <ProseSection title="Diet" text={item.diet.notes} />}

        <TankmatesTraits good={c.goodWith} avoid={c.avoidWith} ratings={tx.ratings}
                         warnChips={tx.warnChips} traitChips={tx.traitChips} />

        <SourcesList sources={item.sources} />
        <div className="species-flow__spacer" />
      </div>
    </>
  );
}
