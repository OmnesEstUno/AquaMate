import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GalleryCard, buildImageChain } from '../GalleryCard';

// GalleryCard holds all the image-fallback logic and takes an onOpen prop, so
// it can be tested without react-router (whose v7 exports map the CRA Jest
// resolver can't load). GalleryGrid is a thin router-wired map over GalleryCard.

const candidate = (url) => ({ url, source: 'Wikimedia Commons', license: 'CC BY-SA 4.0' });
const renderCard = (item) => render(<GalleryCard item={item} onOpen={() => {}} />);

describe('buildImageChain', () => {
  test('image_url first, then de-duplicated candidate urls', () => {
    const chain = buildImageChain({
      image_url: 'https://a.jpg',
      media: { imageCandidates: [candidate('https://a.jpg'), candidate('https://b.jpg')] },
    });
    expect(chain).toEqual(['https://a.jpg', 'https://b.jpg']); // a.jpg not repeated
  });

  test('empty image_url is skipped; candidates still used', () => {
    expect(buildImageChain({ image_url: '', media: { imageCandidates: [candidate('https://c.jpg')] } }))
      .toEqual(['https://c.jpg']);
  });

  test('no image and no candidates yields an empty chain', () => {
    expect(buildImageChain({ image_url: '', media: { imageCandidates: [] } })).toEqual([]);
    expect(buildImageChain({ image_url: '' })).toEqual([]);
  });
});

describe('GalleryCard image fallback', () => {
  test('renders the resolved image_url, lazily', () => {
    renderCard({ id: '1', commonName: 'Neon Tetra', image_url: 'https://pub-x.r2.dev/neon.jpg' });
    const img = screen.getByAltText('Neon Tetra');
    expect(img.getAttribute('src')).toBe('https://pub-x.r2.dev/neon.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  test('falls back through candidates when the primary image errors', () => {
    renderCard({
      id: '2',
      commonName: 'Kuhli Loach',
      image_url: 'https://pub-x.r2.dev/broken.jpg',
      media: { imageCandidates: [candidate('https://commons/kuhli-a.jpg'), candidate('https://commons/kuhli-b.jpg')] },
    });
    const img = screen.getByAltText('Kuhli Loach');
    expect(img.getAttribute('src')).toBe('https://pub-x.r2.dev/broken.jpg');
    fireEvent.error(img); // primary 404s
    expect(img.getAttribute('src')).toBe('https://commons/kuhli-a.jpg');
    fireEvent.error(img); // first candidate also fails
    expect(img.getAttribute('src')).toBe('https://commons/kuhli-b.jpg');
  });

  test('renders a placeholder (no <img>, no empty src) when nothing is available', () => {
    renderCard({ id: '3', commonName: 'Rusty Gorgonian', image_url: '', media: { imageCandidates: [] } });
    expect(screen.queryByAltText('Rusty Gorgonian')).toBeNull();
    expect(screen.getByRole('img', { name: /No image available for Rusty Gorgonian/i })).toBeTruthy();
    expect(document.querySelector('img')).toBeNull(); // no empty-string-src <img> warning
  });

  test('shows the placeholder after every candidate has failed', () => {
    renderCard({
      id: '4',
      commonName: 'Sea Hare',
      image_url: 'https://commons/hare.jpg',
      media: { imageCandidates: [candidate('https://commons/hare.jpg')] },
    });
    fireEvent.error(screen.getByAltText('Sea Hare')); // only url exhausted
    expect(screen.queryByAltText('Sea Hare')).toBeNull();
    expect(screen.getByRole('img', { name: /No image available for Sea Hare/i })).toBeTruthy();
  });
});
