# V2 Card UX — Design Spec

> **Status:** Draft for review
> **Author:** OmnesEstUno + Claude
> **Date:** 2026-07-16
> **Branch:** `feature/v2-cards` (worktree `.worktrees/v2-cards`)
> **Follow-up:** Implementation plan at `docs/superpowers/plans/YYYY-MM-DD-v2-card-ux.md` once approved

## Goal

Enhance the gallery card with four small, information-dense elements that surface things a hobbyist wants to know before clicking through: **how hard is this to keep, is there a reason to think twice, what's it also called (when relevant), what's it about (on hover)**. Do this without changing the card's shape, size, hover animation, or fundamental identity. The card stays a photograph-first experience; the additions are quiet, layered helpers.

## Scope

### In V2 (this build)

Four card additions:

1. **Care-level badge** — colored pill top-right showing `careLevel` (beginner/intermediate/advanced/expert).
2. **Advisory pill** — colored pill top-left when `hobbyistAdvisory` is set. Four variants with distinct color + icon + short label.
3. **AKA subline** — small italic line above the common name when the current search matched via `alsoKnownAs`. Names the matched trade name so the user understands *why* this card is in the results.
4. **Hover teaser** — small tooltip that follows the cursor within the card's image area, showing the first sentence of `summary`. Skipped on touch devices in V2.

Also required (backend enablement):

5. **Search match-reason tracking** — `/api/gallery` response gains a per-item `matchedVia` field (`commonName` | `scientificName` | `alsoKnownAs`) when a `q` query is active. Enables the AKA subline to appear only for AKA-matched items.

### Explicitly out of scope for V2

- Advisory reason text on the card by default (only surfaces on pill hover)
- Mobile/touch fallback for the hover teaser
- Taxon chip (evaluated, dropped — image carries taxon identity)
- Any change to card dimensions, hover animation (`scale(1.1)`), or `.card-details` slide-up
- Any change to card colors beyond the new pills and subline
- Any change to gallery layout, filter bar, or grid behavior

### Deferred to V2.5 / V3

- **V2.5** — reef-safe backfill (heuristic + manual review on ~800 saltwater species)
- **V3** — "I'm feeling fishy" random-species button + species detail pages

## Data / API changes

### `/api/gallery` response — new per-item field

```json
{
  "items": [
    {
      "id": "…",
      "slug": "cardinal-tetra",
      "commonName": "Cardinal Tetra",
      "careLevel": "beginner",
      "hobbyistAdvisory": null,
      "alsoKnownAs": ["Red Neon Tetra", "Cardinal"],
      "summary": "The Cardinal Tetra is a small, schooling…",
      "media": { "primaryImage": "…" },
      "image_url": "https://pub-.../cardinal_tetra.jpg",

      "matchedVia": "alsoKnownAs"
    }
  ]
}
```

**`matchedVia` semantics:**

- Present ONLY when the request had a non-empty `q` filter.
- Value: `"commonName"` if `commonName` contained the substring; else `"scientificName"` if that contained it; else `"alsoKnownAs"` if any AKA entry contained it.
- The frontend uses this to decide whether to render the AKA subline. If `matchedVia === "alsoKnownAs"` AND `q` is non-empty, render the subline with the first `alsoKnownAs` entry that contains `q.toLowerCase()`.

**Not surfaced yet but easy to add later:** the specific `alsoKnownAs` string that matched. The frontend can derive this by re-substring-matching `q` against the item's `alsoKnownAs` array. Kept out of the server response for simplicity — the array is already there.

### Bundled index — no schema change

All fields the card renders already exist in the trimmed gallery index bundled with the Worker (`careLevel`, `hobbyistAdvisory`, `summary`, `alsoKnownAs`). No R2 fetches required for card rendering. Detail-page work (V3) will still need `/api/species/:slug` for full prose.

## Visual design

### Card layout

```
┌────────────────────────────────────┐
│ [Advisory]              [Care]     │  ← both pills float over image top corners
│                                    │
│                                    │
│         (species image)            │
│                                    │
│                                    │
│                          [teaser]  │  ← follows cursor on hover only
├────────────────────────────────────┤
│ also known as: red neon tetra      │  ← AKA subline (only when matchedVia="alsoKnownAs")
│ Cardinal Tetra               ♡     │  ← common name row (existing)
└────────────────────────────────────┘
```

Card dimensions, hover animation (`scale(1.1)`), and `.card-details` slide-up behavior are all preserved from V1.

### Care-level badge

**Position:** absolute, top-right (8px inset).
**Shape:** pill, `--radius-pill`.
**Size:** ~24px tall, padding 3px 9px.
**Font:** system-ui, weight 600, ~0.65em.
**Border:** none (distinguishes from advisory pills).

| Level | Fill | Text |
|---|---|---|
| beginner | `#1E88E5` (welcoming blue) | white |
| intermediate | `#2E7D32` (steady green) | white |
| advanced | `#F9A825` (amber caution) | `#1a1a1a` (dark, for contrast on amber) |
| expert | `#C62828` (high-alert red) | white |

**Null handling:** If `careLevel` is null, no badge renders.

### Advisory pill

**Position:** absolute, top-left (8px inset).
**Shape:** pill, `--radius-pill`.
**Size:** slightly smaller than care badge (~22px tall), padding 3px 8px 3px 6px.
**Font:** system-ui, weight 600, ~0.62em.
**Border:** 1.5px solid, lighter shade of the fill color. This border is a subtle visual grouping cue — bordered pill = advisory system, borderless = care-level system.
**Icon:** leading Unicode glyph, ~0.9em.

| `hobbyistAdvisory.level` | Label | Icon | Fill | Border |
|---|---|---|---|---|
| `specialist-only` | Specialist | ⚠ | `#E65100` | `#FFB74D` |
| `legally-restricted` | Restricted | ⚖ | `#424242` | `#9E9E9E` |
| `public-aquarium-only` | XL | ⚑ | `#7b1fa2` | `#CE93D8` |
| `pond-only` | Pond | ⚘ | `#01579B` | `#64B5F6` |

**Wording rationale:** avoid absolute-language (`Pond only` → `Pond`, `Public only` → `XL`). Users may adapt circumstances (room-sized tanks, etc.); the pill describes the constraint, not a prohibition. Full explanation lives in `hobbyistAdvisory.reason`, shown on pill hover.

**Null handling:** If `hobbyistAdvisory` is null, no pill renders.

**Corpus distribution (as of spec date):**
- `specialist-only`: 73 species
- `legally-restricted`: 26 species
- `public-aquarium-only`: 17 species
- `pond-only`: 2 species
- Total: 118 of 1,696 species (7%)

### Advisory pill hover — reason tooltip

**Trigger:** mouse enters the advisory pill's bounding box.
**Content:** `hobbyistAdvisory.reason` string.
**Position:** absolute, below the pill (top: ~32px), with a small caret pointing up at the pill.
**Styling:** matches image teaser (dark background, thin colored border, ~0.68em text, max-width ~200px).
**Interaction with image teaser:** while the advisory pill is hovered, the image teaser is suppressed. Only one tooltip visible at a time.
**Dismissal:** mouse leaves the pill.

### AKA subline

**Position:** inside `.card-info`, above the common-name row.
**Font:** system-ui, italic, ~0.62em.
**Color:** cyan-tinted — `rgba(0, 247, 255, 0.9)` on `rgba(0, 247, 255, 0.12)` background pill.
**Shape:** pill, `--radius-pill`, padding 2px 8px.
**Text:** `also known as: <matched-aka-entry>`.
**Alignment:** left (`align-self: flex-start`).
**Line-height:** compact so it doesn't push the card taller.

**Selection of the matched entry:** the frontend derives it — `item.alsoKnownAs.find(x => x.toLowerCase().includes(currentQuery.toLowerCase()))`. First match wins.

**Only renders when:**
- `q` filter is non-empty AND
- `matchedVia === "alsoKnownAs"` AND
- An `alsoKnownAs` entry actually contains `q` (safety check)

Otherwise it's absent. When the user clears the search, the subline disappears.

### Hover teaser (image area)

**Trigger:** mouse enters the card's image area.
**Content:** first sentence of `summary`, capped at ~140 characters (long summaries truncate with an ellipsis; the detail page will show the full text).
**Position:** absolute, follows the cursor within the image bounds, offset ~14px down-right so it doesn't obscure the pointer target.
**Boundary behavior:** teaser stays within the card's image bounds — if the cursor moves near the right edge, the teaser shifts left so it doesn't clip out of view.
**Styling:** dark background (`rgba(4, 49, 61, 0.98)`), 1px cyan-tinted border (`rgba(0, 247, 255, 0.35)`), `--radius-md`, box shadow, ~0.78em system-ui text.
**Z-index:** high — floats above adjacent cards.
**Dismissal:** mouse leaves the image bounds.
**Suppression:** hidden while the advisory pill is hovered.

**Touch fallback (V2):** none. Touch users get no teaser on cards; they see the full `summary` when they land on the detail page (which itself is V3, so no worse than V1's touch UX). Long-press or persistent-tap fallback is a follow-up if telemetry shows demand.

**Summary field availability:** every species in the corpus has `summary` populated per the schema. Fallback: if a species somehow has null `summary`, teaser doesn't render.

## Frontend architecture

### Where the code lives

New files (all under the existing gallery module):

- `src/home/gallery/components/CareLevelBadge.js`
- `src/home/gallery/components/AdvisoryPill.js`
- `src/home/gallery/components/AKAPill.js`
- `src/home/gallery/components/HoverTeaser.js`

Modified:

- `src/home/gallery/components/GalleryGrid.js` — composes the new elements into each card
- `src/backend/worker.js` — `matchedVia` computation in the `/api/gallery` handler
- `src/backend/gallery/filters.js` — helper `whichFieldMatched(item, q)` returning the field name
- `src/styles/gallery.css` — new pill/teaser rules using tokens where possible; new named colors added to `tokens.css` as `--care-*` and `--advisory-*` vars for maintainability

### Component contracts

**`<CareLevelBadge level={string|null} />`**
- Renders nothing when `level` is null or absent.
- Otherwise renders a pill with the mapped color + label.

**`<AdvisoryPill advisory={hobbyistAdvisoryObject|null} />`**
- Renders nothing when `advisory` is null or `advisory.level` is missing.
- Otherwise renders a pill with the mapped color/icon/label.
- Manages its own hover state to show/hide the reason tooltip.
- Publishes a `data-advisory-hovered` attribute on the card ancestor via a callback prop so the teaser can suppress itself.

**`<AKAPill query={string} alsoKnownAs={string[]|null} matchedVia={string|null} />`**
- Renders nothing unless `query.trim() !== ""` AND `matchedVia === "alsoKnownAs"` AND a matching entry exists.
- Otherwise renders a pill with `also known as: <matched-entry>`.

**`<HoverTeaser summary={string|null} cardImageRef={ref} suppressed={boolean} />`**
- Renders nothing when `summary` is null, suppressed is true, or the cursor isn't inside the image bounds.
- Manages mousemove within the image ref to update position.
- Clamps position to stay inside image bounds with the standard offset.

### GalleryGrid composition

```jsx
export function GalleryGrid({ items, query }) {
  const navigate = useNavigate();
  return (
    <div className="gallery">
      {items.map((item) => (
        <GalleryCard key={item.id} item={item} query={query} navigate={navigate} />
      ))}
    </div>
  );
}

function GalleryCard({ item, query, navigate }) {
  const [advisoryHovered, setAdvisoryHovered] = useState(false);
  const imgRef = useRef(null);

  return (
    <div
      className="card"
      onClick={() => navigate(`/info/${encodeURIComponent(item.commonName)}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="card__img-wrap" ref={imgRef}>
        <img src={item.image_url} alt={item.commonName} width="640" height="480" />
        <AdvisoryPill advisory={item.hobbyistAdvisory} onHoverChange={setAdvisoryHovered} />
        <CareLevelBadge level={item.careLevel} />
        <HoverTeaser summary={item.summary} imageRef={imgRef} suppressed={advisoryHovered} />
      </div>
      <div className="card-info">
        <AKAPill query={query} alsoKnownAs={item.alsoKnownAs} matchedVia={item.matchedVia} />
        <div className="card-info__row">
          <span>{item.commonName}</span>
        </div>
      </div>
    </div>
  );
}
```

`query` is threaded down from `useGalleryData` (already tracked in state).

## Backend architecture

### `matchedVia` computation

In `src/backend/gallery/filters.js`, add:

```js
const REEF_SAFE_ENUM = /* … existing … */;
function isReefSafe(item) { /* … existing … */ }

function whichFieldMatched(item, q) {
  if (!q || !q.trim()) return null;
  const needle = q.toLowerCase().trim();
  if ((item.commonName || '').toLowerCase().includes(needle)) return 'commonName';
  if ((item.scientificName || '').toLowerCase().includes(needle)) return 'scientificName';
  if ((item.alsoKnownAs || []).some(s => (s || '').toLowerCase().includes(needle))) {
    return 'alsoKnownAs';
  }
  return null;
}

module.exports = { matchesFilters, applyFilters, whichFieldMatched };
```

In `src/backend/worker.js`, inside the `/api/gallery` handler, after building the paginated `slice`:

```js
if (params.q && params.q.trim()) {
  slice.forEach(item => {
    item.matchedVia = whichFieldMatched(item, params.q);
  });
}
```

**Performance impact:** three lowercase substring checks per item on the paginated slice only (24-48 items). Sub-millisecond. No impact on facet computation.

**Consistency with the filter:** the filter itself uses `matchesFilters` which OR-s across all three fields. `whichFieldMatched` re-derives which one hit, in priority order (common → scientific → AKA). By construction, any item in the paginated slice will have at least one match, so `whichFieldMatched` never returns null when `q` is active.

## CSS tokens

Add to `src/styles/tokens.css`:

```css
/* Care level palette (borderless pills) */
--care-beginner:     #1E88E5;
--care-intermediate: #2E7D32;
--care-advanced:     #F9A825;
--care-advanced-fg:  #1a1a1a;   /* text override for amber contrast */
--care-expert:       #C62828;

/* Advisory palette (bordered pills, fill + lighter border tint) */
--advisory-specialist:        #E65100;
--advisory-specialist-border: #FFB74D;
--advisory-restricted:        #424242;
--advisory-restricted-border: #9E9E9E;
--advisory-xl:                #7b1fa2;
--advisory-xl-border:         #CE93D8;
--advisory-pond:              #01579B;
--advisory-pond-border:       #64B5F6;

/* AKA pill (cyan-tinted, on card) */
--aka-fg: rgba(0, 247, 255, 0.9);
--aka-bg: rgba(0, 247, 255, 0.12);
```

New rules in `src/styles/gallery.css` reference these tokens exclusively — no hardcoded hex.

## Testing

### Unit tests

**`whichFieldMatched(item, q)`** — matrix of field content and query strings:
- Match in commonName → returns `"commonName"`
- Match in scientificName only → returns `"scientificName"`
- Match in alsoKnownAs only → returns `"alsoKnownAs"`
- Match in multiple → returns highest-priority (commonName > scientificName > alsoKnownAs)
- Whitespace-only query → returns `null`
- Empty AKA array → doesn't crash
- Null commonName/scientificName → doesn't crash

**`<CareLevelBadge />`** — renders each of 4 levels with correct class, renders nothing for null.

**`<AdvisoryPill />`** — renders each of 4 levels, renders nothing for null, hover state toggles reason tooltip.

**`<AKAPill />`** — renders when all conditions met, silent otherwise. Handles missing AKA array, empty query, non-matching query.

**`<HoverTeaser />`** — position clamping at edges, suppression on advisory hover, silent on null summary.

### Integration tests

- `/api/gallery` with `q=neon` returns items where `matchedVia` reflects the actual matching field.
- `/api/gallery` without `q` returns items without a `matchedVia` field (or with `null`).
- Regression: existing `worker-gallery.test.js` tests still pass.

### Manual smoke tests

Run through the gallery with the following:
- Card without advisory and without search: only care badge visible.
- Card with each advisory level: correct color, icon, label; hover shows correct reason.
- Search `"neon"`: Cardinal Tetra shows AKA subline "also known as: red neon tetra"; Neon Tetra does NOT (matched via commonName).
- Search `"Neoniphon"`: Sammara Squirrelfish shows no AKA subline (matched via scientificName).
- Empty search: no AKA sublines anywhere.
- Hover across the image: teaser follows cursor, stays inside image bounds.
- Hover the advisory pill (Leopard Wrasse): reason tooltip appears; image teaser is suppressed.

## Non-goals / decisions made

- **Taxon chip dropped** — image already carries taxon identity; adds visual clutter without new information.
- **Advisory reason NOT shown on card by default** — surfaces on hover to keep the card quiet.
- **Neutral wording** for advisory labels (`Pond`, `XL`, not `Pond only`, `Public only`) — describes the challenge without declaring a prohibition.
- **Care badges borderless, advisory pills bordered** — the border becomes a subtle grouping cue distinguishing the two systems.
- **Mobile teaser skipped for V2** — hover-only affordance; touch users get the summary on detail pages (V3).
- **No `matchedVia` for range/enum filters** — only for text `q`. Range filters don't have a "matched value" concept.

## Follow-up

- Implementation plan at `docs/superpowers/plans/YYYY-MM-DD-v2-card-ux.md` — task decomposition, TDD-friendly steps.
- Post-merge: consider adding `--care-beginner` etc. as design-system tokens documented in the styles README (if such a doc exists).
- V2.5 will independently backfill reef-safe data; V2 UI has no dependency on that work.
