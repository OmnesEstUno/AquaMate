import React from 'react';
import { MultiSelectFilter } from './MultiSelectFilter';
import { RangeSlider } from './RangeSlider';
import { ContextualSubRow } from './ContextualSubRow';
import { PresetChips } from './PresetChips';
import { ActiveFilterPills } from './ActiveFilterPills';
import {
  TAXA, WATER_TYPES, CARE_LEVELS,
  TEMPERAMENTS, GROUPINGS, DIET_TYPES,
  CO2_OPTIONS, LIGHTING_OPTIONS, FAUNA_TAXA,
} from '../../../backend/gallery/constants';

const humanize = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');

export function FilterBar({ state, facetCounts, actions }) {
  const taxaSet = new Set(state.taxa || []);
  const hasSaltwater = state.waterType?.includes('saltwater');
  const hasPlantOrMacro = taxaSet.has('plant') || taxaSet.has('macroalgae') || !state.taxa;
  const hasFauna = !state.taxa || state.taxa.some(t => FAUNA_TAXA.has(t));

  return (
    <div className="gallery-filterbar">
      <div className="gallery-universal">
        <MultiSelectFilter
          label="Taxon" options={TAXA} selected={state.taxa || []}
          counts={facetCounts.taxa} onChange={actions.setTaxa} labelFor={humanize}
        />
        <MultiSelectFilter
          label="Water type" options={WATER_TYPES} selected={state.waterType || []}
          counts={facetCounts.waterType} onChange={actions.setWaterType} labelFor={humanize}
        />
        <MultiSelectFilter
          label="Care level" options={CARE_LEVELS} selected={state.careLevel || []}
          counts={facetCounts.careLevel} onChange={actions.setCareLevel} labelFor={humanize}
        />
        <RangeSlider
          label="Adult size" min={1} max={250} step={1} mode="dual"
          value={{ min: state.minSize ?? 1, max: state.maxSize ?? 250 }}
          onChange={actions.setSize} formatValue={(n) => `${n} cm`}
        />
        <RangeSlider
          label="Max tank size (yours)" min={5} max={2000} step={5} mode="single-max"
          value={{ max: state.maxTankL ?? 2000 }}
          onChange={({ max }) => actions.setMaxTankL(max)} formatValue={(n) => `${n} L`}
        />
      </div>

      <PresetChips onApply={actions.applyPreset} />

      <ContextualSubRow label="Saltwater filters" visible={hasSaltwater}>
        <label className="gallery-check">
          <input type="checkbox" checked={!!state.reefSafe} onChange={(e) => actions.setReefSafe(e.target.checked)} />
          Reef-safe only
        </label>
        <label className="gallery-check">
          <input type="checkbox" checked={!!state.hideAdvisory} onChange={(e) => actions.setHideAdvisory(e.target.checked)} />
          Hide specialist-only
        </label>
      </ContextualSubRow>

      <ContextualSubRow label="Plant & macroalgae filters" visible={hasPlantOrMacro}>
        <MultiSelectFilter
          label="CO₂" options={CO2_OPTIONS} selected={state.co2 || []}
          counts={facetCounts.co2} onChange={actions.setCo2} labelFor={humanize}
        />
        <MultiSelectFilter
          label="Lighting" options={LIGHTING_OPTIONS} selected={state.lighting || []}
          counts={facetCounts.lighting} onChange={actions.setLighting} labelFor={humanize}
        />
      </ContextualSubRow>

      <ContextualSubRow label="Fish-oriented filters" visible={hasFauna}>
        <MultiSelectFilter
          label="Temperament" options={TEMPERAMENTS} selected={state.temperament || []}
          counts={facetCounts.temperament} onChange={actions.setTemperament} labelFor={humanize}
        />
        <MultiSelectFilter
          label="Grouping" options={GROUPINGS} selected={state.grouping || []}
          counts={facetCounts.grouping} onChange={actions.setGrouping} labelFor={humanize}
        />
        <MultiSelectFilter
          label="Diet" options={DIET_TYPES} selected={state.dietType || []}
          counts={facetCounts.dietType} onChange={actions.setDietType} labelFor={humanize}
        />
      </ContextualSubRow>

      <ActiveFilterPills
        state={state}
        onRemove={actions.removeFilter}
        onClearAll={actions.clearAll}
      />
    </div>
  );
}
