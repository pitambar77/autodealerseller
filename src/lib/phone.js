// Phone numbers from any country (libphonenumber-js): the country picker list, validation and formatting.
// Numbers are stored in international format, e.g. "+255 712 345 678" or "+91 98610 21001".
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';

export const DEFAULT_COUNTRY = 'TZ';
/** Shown first in every country picker. */
const PINNED = ['TZ', 'KE', 'UG', 'RW', 'BI', 'IN'];

const names = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();
const flag = (iso) => String.fromCodePoint(...[...iso].map((c) => 127397 + c.charCodeAt(0)));

/** Every country: { code: 'TZ', dial: '+255', name: 'Tanzania', flag: '🇹🇿' }, pinned ones first. */
export const COUNTRIES = (() => {
  const all = getCountries().map((code) => ({ code, dial: `+${getCountryCallingCode(code)}`, name: names?.of(code) || code, flag: flag(code) }));
  const pinned = PINNED.map((c) => all.find((x) => x.code === c)).filter(Boolean);
  const rest = all.filter((x) => !PINNED.includes(x.code)).sort((a, b) => a.name.localeCompare(b.name));
  return [...pinned, ...rest];
})();
export const PINNED_COUNT = PINNED.length;
export const countryByCode = (code) => COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];

/** Parse what someone typed (national or international) for a country. */
export function parsePhone(national, country = DEFAULT_COUNTRY) {
  const raw = String(national || '').trim();
  if (!raw) return null;
  return parsePhoneNumberFromString(raw, raw.startsWith('+') ? undefined : country) || null;
}

/** Is this a plausible phone number? Accepts "+91 98610 21001", or "0712 345 678" with country TZ. */
export function isValidPhone(value, country = DEFAULT_COUNTRY) {
  const p = parsePhone(value, country);
  return !!p && p.isPossible();
}

/** "+255 712 345 678". Unparseable input is returned trimmed. */
export function formatPhone(value, country = DEFAULT_COUNTRY) {
  const p = parsePhone(value, country);
  return p ? p.formatInternational() : String(value || '').trim();
}

/** Split a stored number into the picker's country and the national part ("712 345 678"). */
export function splitPhone(value, fallback = DEFAULT_COUNTRY) {
  const p = parsePhone(value, fallback);
  if (!p) return { country: fallback, national: String(value || '').replace(/^\+\d+\s*/, '') };
  return { country: p.country || COUNTRIES.find((c) => c.dial === `+${p.countryCallingCode}`)?.code || fallback, national: p.formatNational() };
}

export const phoneError = (country = DEFAULT_COUNTRY) => `Enter a valid mobile number for ${countryByCode(country).name}`;
