import React from 'react';

export function Waves() {
  return (
    <svg className="species-waves" xmlns="http://www.w3.org/2000/svg"
         viewBox="0 24 150 44" preserveAspectRatio="none" shapeRendering="auto" aria-hidden="true">
      <defs>
        <path id="species-gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
      </defs>
      <g className="species-parallax">
        <use xlinkHref="#species-gentle-wave" x="48" y="0" fill="rgba(9,73,93,0.35)" />
        <use xlinkHref="#species-gentle-wave" x="48" y="3" fill="rgba(9,73,93,0.5)" />
        <use xlinkHref="#species-gentle-wave" x="48" y="5" fill="rgba(9,73,93,0.7)" />
        <use xlinkHref="#species-gentle-wave" x="48" y="7" fill="rgba(9,73,93,0.95)" />
      </g>
    </svg>
  );
}
