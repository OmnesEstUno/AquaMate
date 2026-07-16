import React, { useState, useEffect, useCallback } from 'react';

const OFFSET_X = 14;
const OFFSET_Y = 14;
const MAX_LEN = 140;

function firstSentence(text) {
  if (!text) return '';
  const period = text.indexOf('. ');
  const raw = period > 0 ? text.slice(0, period + 1) : text;
  return raw.length > MAX_LEN ? raw.slice(0, MAX_LEN - 1) + '…' : raw;
}

export function HoverTeaser({ summary, imageRef, suppressed }) {
  const [pos, setPos] = useState(null); // { x, y } in image-relative coords

  const onMove = useCallback((e) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    // Only visible while cursor is inside the image area
    if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) {
      setPos(null);
      return;
    }
    // Clamp: keep the teaser inside the image (rough width guess 220px, cap right/bottom)
    const teaserW = 220;
    const teaserH = 60;
    const clampedX = Math.min(localX + OFFSET_X, rect.width - teaserW - 4);
    const clampedY = Math.min(localY + OFFSET_Y, rect.height - teaserH - 4);
    setPos({ x: Math.max(4, clampedX), y: Math.max(4, clampedY) });
  }, [imageRef]);

  const onLeave = useCallback(() => setPos(null), []);

  useEffect(() => {
    const el = imageRef.current;
    if (!el) return undefined;
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [imageRef, onMove, onLeave]);

  if (!summary || suppressed || !pos) return null;
  return (
    <span
      className="gallery-teaser"
      style={{ left: pos.x, top: pos.y }}
      role="tooltip"
    >
      {firstSentence(summary)}
    </span>
  );
}
