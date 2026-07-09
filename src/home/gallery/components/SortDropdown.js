import React from 'react';
import { SORT_OPTIONS } from '../constants';

export function SortDropdown({ value, onChange }) {
  return (
    <select className="gallery-sort" value={value} onChange={(e) => onChange(e.target.value)}>
      {SORT_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
