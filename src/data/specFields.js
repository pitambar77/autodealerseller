// Specification fields a vehicle category can use (chosen per category in Admin → Categories).
// The listing form, the filters, listing cards, detail pages and comparisons all read from here,
// so a new category only needs a list of these keys, never new code.
import { num } from '../utils/format';

/** Engine-size bands (filter for engineCc). */
export const CC_BANDS = [
  { value: '0-125', label: 'Up to 125 cc' },
  { value: '126-250', label: '126 – 250 cc' },
  { value: '251-500', label: '251 – 500 cc' },
  { value: '501-1500', label: '501 – 1,500 cc' },
  { value: '1501-2500', label: '1,501 – 2,500 cc' },
  { value: '2501-99999', label: 'Over 2,500 cc' },
  { value: 'ev', label: 'Electric' },
];

const min = (steps, unit) => ({ kind: 'min', options: steps.map((s) => ({ value: String(s), label: `${num(s)}+ ${unit}` })) });

/**
 * type: number | decimal | select | text
 * unit: shown after the input and the value · filter: how buyers can filter on it
 */
export const SPEC_FIELDS = {
  engineCc: { label: 'Engine size', unit: 'cc', type: 'number', hint: '0 for electric', filter: { kind: 'bands', options: CC_BANDS }, format: (v, veh) => (Number(v) === 0 || veh?.fuel === 'Electric' ? 'Electric motor' : `${num(v)} cc`) },
  powerBhp: { label: 'Power', unit: 'bhp', type: 'number' },
  powerHp: { label: 'Engine power', unit: 'hp', type: 'number', filter: min([25, 50, 75, 100, 150, 200, 300, 400], 'hp') },
  seats: { label: 'Seats', type: 'number', filter: min([2, 5, 7, 14, 22, 30, 45, 60], 'seats'), format: (v) => `${num(v)} seats` },
  standing: { label: 'Standing capacity', type: 'number', format: (v) => `${num(v)} standing` },
  doors: { label: 'Doors', type: 'number' },
  mileageKmpl: { label: 'Fuel economy', unit: 'km/l', type: 'decimal' },
  weightKg: { label: 'Kerb weight', unit: 'kg', type: 'number' },
  abs: { label: 'ABS', type: 'select', options: ['None', 'Single-channel', 'Dual-channel'] },
  payloadT: { label: 'Payload', unit: 'tonnes', short: 't payload', type: 'decimal', filter: min([1, 3, 5, 10, 15, 20, 25, 30], 'tonnes') },
  gvwT: { label: 'Gross vehicle weight', unit: 'tonnes', type: 'decimal' },
  axle: { label: 'Axle configuration', type: 'select', options: ['4x2', '4x4', '6x2', '6x4', '8x2', '8x4'], filter: { kind: 'exact' } },
  cabin: { label: 'Cabin', type: 'select', options: ['Day cab', 'Sleeper', 'Crew cab'] },
  tyres: { label: 'Number of tyres', type: 'number' },
  trailerType: { label: 'Trailer type', type: 'select', options: ['Flatbed', 'Skeletal', 'Lowbed', 'Tanker', 'Box / curtain side', 'Tipper trailer', 'Car carrier'], filter: { kind: 'exact' } },
  airCon: { label: 'Air conditioning', type: 'select', options: ['Yes', 'No'], filter: { kind: 'exact' } },
  operatingWeightT: { label: 'Operating weight', unit: 'tonnes', type: 'decimal', filter: min([1, 3, 5, 10, 20, 30, 50], 'tonnes') },
  bucketM3: { label: 'Bucket capacity', unit: 'm³', type: 'decimal' },
  liftCapacityT: { label: 'Lifting capacity', unit: 'tonnes', type: 'decimal', filter: min([2, 5, 10, 25, 50], 'tonnes') },
  driveType: { label: 'Drive', type: 'select', options: ['2WD', '4WD'], filter: { kind: 'exact' } },
  ptoHp: { label: 'PTO power', unit: 'hp', type: 'number' },
  attachments: { label: 'Attachments included', type: 'text' },
};

export const SPEC_KEYS = Object.keys(SPEC_FIELDS);

/** "22 tonnes", "160 hp", "4WD"; null when empty. */
export function formatSpec(key, value, vehicle) {
  if (value == null || value === '') return null;
  const f = SPEC_FIELDS[key];
  if (!f) return String(value);
  if (f.format) return f.format(value, vehicle);
  if (f.type === 'number' || f.type === 'decimal') return `${num(value)}${f.unit ? ` ${f.unit}` : ''}`;
  return String(value);
}

/** Does a listing pass a spec filter? `value` is the URL value (band "lo-hi", minimum, or exact text). */
export function specMatches(key, value, vehicle) {
  const f = SPEC_FIELDS[key]?.filter;
  if (!f || !value) return true;
  const v = vehicle.specs?.[key];
  if (f.kind === 'bands') {
    if (value === 'ev') return vehicle.fuel === 'Electric';
    const [lo, hi] = value.split('-').map(Number);
    return vehicle.fuel !== 'Electric' && Number(v || 0) >= lo && Number(v || 0) <= hi;
  }
  if (f.kind === 'min') return Number(v || 0) >= Number(value);
  return String(v || '') === value;
}
