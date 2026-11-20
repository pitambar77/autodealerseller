import { SPEC_FIELDS, SPEC_KEYS, specMatches } from '../data/specFields';
import { isFeatured } from './featured';
import { num, tzsShort } from './format';

// Spec filters use the spec field key as the URL parameter (?payloadT=10, ?engineCc=126-250, ?driveType=4WD).
// `cc` and `payload` are older names kept so saved links still work.
const LEGACY = { cc: 'engineCc', payload: 'payloadT' };
export const FILTER_KEYS = ['q', 'make', 'model', 'minPrice', 'maxPrice', 'minYear', 'maxYear', 'maxKm', 'fuel', 'transmission', 'city', 'condition', 'body', ...SPEC_KEYS.filter((k) => SPEC_FIELDS[k].filter), ...Object.keys(LEGACY)];

export function applyFilters(list, f) {
  const q = (f.q || '').trim().toLowerCase();
  const fuels = f.fuel ? f.fuel.split(',') : [];
  return list.filter((v) => {
    if (q && !`${v.year} ${v.make} ${v.model} ${v.variant} ${v.city} ${v.bodyType}`.toLowerCase().includes(q)) return false;
    if (f.make && v.make !== f.make) return false;
    if (f.model && v.model !== f.model) return false;
    if (f.minPrice && v.price < Number(f.minPrice)) return false;
    if (f.maxPrice && v.price > Number(f.maxPrice)) return false;
    if (f.minYear && v.year < Number(f.minYear)) return false;
    if (f.maxYear && v.year > Number(f.maxYear)) return false;
    if (f.maxKm && v.mileage > Number(f.maxKm)) return false;
    if (fuels.length && !fuels.includes(v.fuel)) return false;
    if (f.transmission && v.transmission !== f.transmission) return false;
    if (f.city && v.city !== f.city) return false;
    if (f.condition && v.condition !== f.condition) return false;
    if (f.body && v.bodyType !== f.body) return false;
    for (const [k, val] of Object.entries(f)) {
      const key = LEGACY[k] || k;
      if (val && SPEC_FIELDS[key]?.filter && !specMatches(key, val, v)) return false;
    }
    return true;
  });
}

/** True while a listing has a running discount or special offer (same rule as the offer ribbon). */
export const isOnOffer = (v) => !!v?.offer && (!v.offer.endsAt || new Date(v.offer.endsAt) > new Date());

/**
 * Display priority on the vehicle pages (always applied, whichever sort the buyer picks):
 *   0 featured and on offer · 1 featured · 2 on offer (discount or special offer) · 3 everything else.
 * The chosen sort orders the vehicles inside each group.
 */
export const priorityGroup = (v) => {
  const featured = isFeatured(v);
  const offer = isOnOffer(v);
  return featured && offer ? 0 : featured ? 1 : offer ? 2 : 3;
};
export const PRIORITY_LABELS = ['Featured & on offer', 'Featured', 'On offer', 'Other vehicles'];

const newest = (a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt);

function withinGroup(sort, q) {
  switch (sort) {
    case 'newest':
      return newest;
    case 'price_asc':
      return (a, b) => a.price - b.price;
    case 'price_desc':
      return (a, b) => b.price - a.price;
    case 'km_asc':
      return (a, b) => a.mileage - b.mileage;
    case 'year_desc':
      return (a, b) => b.year - a.year;
    default: {
      // relevance: verified first, then text match quality, then freshness
      const t = q.toLowerCase();
      const score = (v) =>
        (v.verification === 'verified' ? 2 : 0) +
        (t && `${v.make} ${v.model}`.toLowerCase().startsWith(t) ? 3 : 0) -
        (Date.now() - new Date(v.publishedAt || v.createdAt)) / (864e5 * 30);
      return (a, b) => score(b) - score(a);
    }
  }
}

export function sortVehicles(list, sort, q = '') {
  const inGroup = withinGroup(sort, q);
  return list
    .map((v) => ({ v, g: priorityGroup(v) }))
    .sort((a, b) => a.g - b.g || inGroup(a.v, b.v) || newest(a.v, b.v))
    .map((x) => x.v);
}

export const SORTS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'newest', label: 'Newest listed' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'km_asc', label: 'Least used (km / hours)' },
  { value: 'year_desc', label: 'Model year: newest' },
];

export function chipLabel(key, value, usage = 'km') {
  const spec = SPEC_FIELDS[LEGACY[key] || key];
  if (spec?.filter) {
    const opt = spec.filter.options?.find((o) => o.value === value);
    return opt ? `${opt.label}${spec.filter.kind === 'min' ? '' : ''}` : `${spec.label}: ${value}`;
  }
  switch (key) {
    case 'q':
      return `"${value}"`;
    case 'minPrice':
      return `From ${tzsShort(value)}`;
    case 'maxPrice':
      return `Up to ${tzsShort(value)}`;
    case 'minYear':
      return `${value} or newer`;
    case 'maxYear':
      return `${value} or older`;
    case 'maxKm':
      return `Under ${num(value)} ${usage === 'hours' ? 'hours' : 'km'}`;
    case 'fuel':
      return value.split(',').join(' / ');
    default:
      return value;
  }
}

// TSh price steps for budget filters.
export const PRICE_STEPS = [5000000, 10000000, 15000000, 20000000, 30000000, 40000000, 60000000, 80000000, 120000000, 200000000];
