// Vehicle categories. They come from the API (managed in Admin → Categories), so admins can add,
// rename, hide, reorder and remove them without code changes. Every listing has `category`
// (the category's permanent key); listings saved before categories existed count as cars.
//
// The store calls setCategories() whenever it loads data, and the helpers below read the result.
import {
  Ambulance, Bike, Bus, BusFront, Car, CarFront, CarTaxiFront, Caravan, Cog, Construction, Container, Forklift,
  HardHat, Motorbike, Package, Scooter, Ship, Shovel, Sprout, Tractor, Truck, TruckElectric, Wheat, Wrench,
} from 'lucide-react';
import { num } from '../utils/format';
import { SPEC_FIELDS } from './specFields';

/** Icons admins can pick for a category (names match the API's ICON_NAMES). */
export const CATEGORY_ICONS = { Car, CarFront, CarTaxiFront, Motorbike, Bike, Scooter, Bus, BusFront, Truck, TruckElectric, Container, Caravan, Ambulance, Tractor, Forklift, Construction, HardHat, Shovel, Wheat, Sprout, Ship, Package, Wrench, Cog };
/** Illustrations used when a listing has no photos. */
export const ART_KINDS = [
  { value: 'car', label: 'Car' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'truck', label: 'Truck' },
  { value: 'bus', label: 'Bus' },
  { value: 'excavator', label: 'Excavator' },
  { value: 'tractor', label: 'Tractor' },
];

/** All categories by key (hidden ones too, so their listings still display for owners and admins). */
export const VEHICLE_TYPES = {};
/** Keys of the categories shown on the public site, in display order. */
export const TYPE_KEYS = [];
/** Every category key in display order (admin screens). */
export const ALL_TYPE_KEYS = [];

const toType = (c) => ({
  ...c,
  key: c.key,
  label: c.singular,
  plural: c.name,
  noun: c.singular.toLowerCase(),
  nounPlural: c.nounPlural,
  slug: c.slug,
  path: `/${c.slug}`,
  aliases: c.aliases || [],
  icon: CATEGORY_ICONS[c.icon] || Car,
  iconName: c.icon,
  bodies: c.types || [],
  bodyLabel: c.typeLabel || 'Type',
  fuels: c.fuels || [],
  transmissions: c.transmissions || [],
  priceSteps: c.priceSteps || [],
  kmSteps: c.usageSteps || [],
  usage: c.usage === 'hours' ? 'hours' : 'km',
  specFields: (c.specFields || []).filter((f) => SPEC_FIELDS[f.key]),
  features: c.features || [],
  makes: c.makes || [],
  enabled: c.enabled !== false,
});

/** Load the categories from the API (called by the store). */
export function setCategories(list = []) {
  Object.keys(VEHICLE_TYPES).forEach((k) => delete VEHICLE_TYPES[k]);
  TYPE_KEYS.length = 0;
  ALL_TYPE_KEYS.length = 0;
  [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach((c) => {
    const t = toType(c);
    VEHICLE_TYPES[t.key] = t;
    ALL_TYPE_KEYS.push(t.key);
    if (t.enabled) TYPE_KEYS.push(t.key);
  });
}

const FALLBACK = toType({ key: 'car', name: 'Vehicles', singular: 'Vehicle', nounPlural: 'vehicles', slug: 'cars', icon: 'Car', art: 'car', usage: 'km' });

/** Category key of a listing (unknown or missing categories fall back to cars, then the first category). */
export const categoryOf = (v) => (v?.category && VEHICLE_TYPES[v.category] ? v.category : VEHICLE_TYPES.car ? 'car' : ALL_TYPE_KEYS[0] || 'car');
export const typeOf = (v) => VEHICLE_TYPES[categoryOf(v)] || FALLBACK;
export const typeFor = (key) => VEHICLE_TYPES[key] || VEHICLE_TYPES[TYPE_KEYS[0]] || FALLBACK;
/** The first visible category (the site's default). */
export const defaultCategory = () => (VEHICLE_TYPES.car?.enabled ? 'car' : TYPE_KEYS[0] || 'car');

/** Public URL of a listing: /cars/v1001, /trucks-trailers/v6001… */
export const vehiclePath = (v) => `${typeOf(v).path}/${v.id}`;
/** "car" / "truck" / "farm machine" for copy about one listing. */
export const vehicleNoun = (v) => typeOf(v).noun;

/** Category for a URL slug. alias: true when it's an old address that should redirect. */
export function resolveSlug(slug) {
  const s = (slug || '').toLowerCase();
  const direct = ALL_TYPE_KEYS.find((k) => VEHICLE_TYPES[k].slug === s);
  if (direct) return { key: direct, alias: false };
  const old = ALL_TYPE_KEYS.find((k) => VEHICLE_TYPES[k].aliases.includes(s));
  return old ? { key: old, alias: true } : null;
}
/** Category from a browse URL such as /buses or /trucks-trailers/v6001. */
export const categoryFromPath = (pathname = '') => resolveSlug(pathname.split('/')[1])?.key || defaultCategory();

/** "41,000 km" or "2,300 hours" depending on how the category measures use. */
export const usageText = (v) => (typeOf(v).usage === 'hours' ? `${num(v?.mileage)} hours` : `${num(v?.mileage)} km`);
/** "Kilometres driven" / "Hours used" */
export const usageLabel = (T) => (T.usage === 'hours' ? 'Hours used' : 'Kilometres driven');
export const usageShort = (T) => (T.usage === 'hours' ? 'Hours' : 'Kilometres');

const BODY_TITLES = {
  Commuter: 'Commuter motorcycles',
  Scooter: 'Scooters',
  Sport: 'Sports bikes',
  Cruiser: 'Cruisers',
  Adventure: 'Adventure bikes',
  'Off-road': 'Off-road bikes',
  'Plough / harrow': 'Ploughs and harrows',
  'Irrigation equipment': 'Irrigation equipment',
  Coach: 'Coaches',
  Bus: 'Buses',
};
/** Page title for a body type: "SUVs", "Scooters", "Tippers", "Coaches". */
export const bodyTitle = (body = '') => BODY_TITLES[body] || (/(s|sh|ch|x)$/i.test(body) ? `${body}es` : `${body}s`);

/** Toast text for the result of toggleCompare: 'added' | 'removed' | 'full' | 'mixed'. */
export function compareMessage(result, v) {
  const T = typeOf(v);
  if (result === 'mixed') return { text: `Compare works with one vehicle category at a time. Clear your compare list to compare ${T.nounPlural}.`, tone: 'warn' };
  if (result === 'full') return { text: 'Compare holds 3 vehicles. Remove one first.', tone: 'warn' };
  return { text: result === 'added' ? 'Added to compare' : 'Removed from compare', tone: 'info' };
}

/** The first two specifications of a category: shown on listing cards and in the key facts. */
export const keySpecs = (T) => T.specFields.slice(0, 2).map((f) => f.key);
