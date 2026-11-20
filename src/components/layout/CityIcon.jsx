// Illustration for a city's tile on the dealer directory, used when the city has no photo.
// Simple line drawings that follow the text colour, so they work in light and dark mode.
// A city without its own drawing gets a generic skyline.
import { cn } from '../../utils/format';

const GROUND = 'M6 56H58';

// Shapes reused by several cities
const MOUNTAIN = 'M4 56L22 26L30 36L40 18L60 56M36 25L40 18L44 25';
const SEA = 'M6 46C12 42 18 50 24 46S36 42 42 46S54 50 58 46M6 54C12 50 18 58 24 54S36 50 42 54S54 58 58 54M20 40V20L30 14V40M30 22H40V40';
const LAKE_ROCKS = 'M10 46C14 30 22 26 28 30C30 22 40 20 44 30C50 28 56 36 54 46M6 52C12 49 18 55 24 52S36 49 42 52S54 55 58 52';

/** One entry per city: what the illustration shows, its line drawing and a tile tint (used when there's no photo). */
export const CITY_ART = {
  'Dar es Salaam': { landmark: 'Harbour skyline', tint: 'from-[#E6F3FF] to-[#CFE6FB]', d: 'M8 56V36H14V24H20V36H24V18H32V40H36V28H44V44H48V32H56V56' },
  Arusha: { landmark: 'Mount Meru', tint: 'from-[#EAF7EE] to-[#D2EEDA]', d: MOUNTAIN },
  Moshi: { landmark: 'Kilimanjaro', tint: 'from-[#EEF2FF] to-[#DCE3FB]', d: 'M4 56L24 24C28 20 36 20 40 24L60 56M24 24L28 28L32 24L36 28L40 24' },
  Dodoma: { landmark: 'Capital city', tint: 'from-[#FFF6E5] to-[#FFE8BF]', d: 'M12 56V30H52V56M20 56V38H28V56M36 56V38H44V56M10 30L32 16L54 30' },
  Mwanza: { landmark: 'Rocks of Lake Victoria', tint: 'from-[#E9F4FF] to-[#D3E7FB]', d: LAKE_ROCKS, ground: false },
  Mbeya: { landmark: 'Southern highlands', tint: 'from-[#EAF7EE] to-[#D2EEDA]', d: MOUNTAIN },
  Morogoro: { landmark: 'Uluguru Mountains', tint: 'from-[#EAF7EE] to-[#D2EEDA]', d: 'M4 56L18 32L26 42L38 22L48 36L60 56' },
  Iringa: { landmark: 'Hilltop town', tint: 'from-[#FFF3E6] to-[#FFE2C2]', d: 'M4 56C16 40 26 34 40 34S56 44 60 56M30 34V24H38V34M28 24H40' },
  Tanga: { landmark: 'Coastal town', tint: 'from-[#E6F3FF] to-[#CFE6FB]', d: SEA, ground: false },
  Tabora: { landmark: 'Historic railway town', tint: 'from-[#FFF6E5] to-[#FFE8BF]', d: 'M8 50H56M12 50V40H40V50M40 44H52V50M16 40V34H24V40M18 56A3 3 0 1 0 18.01 56M34 56A3 3 0 1 0 34.01 56' },
  Kigoma: { landmark: 'Lake Tanganyika', tint: 'from-[#E9F4FF] to-[#D3E7FB]', d: LAKE_ROCKS, ground: false },
  Zanzibar: { landmark: 'Stone Town', tint: 'from-[#E6F3FF] to-[#CFE6FB]', d: SEA, ground: false },
};

const SKYLINE = { landmark: 'City skyline', tint: 'from-mist-100 to-mist-200', d: 'M8 56V38H15V30H22V42H27V22H36V44H41V33H49V26H56V56' };

export const cityArt = (city) => CITY_ART[city] || SKYLINE;

/** Line drawing of the city's best-known landmark. */
export function CityIcon({ city, className }) {
  const art = cityArt(city);
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={cn('h-10 w-10', className)} role="img" aria-label={`${city}: ${art.landmark}`}>
      <path d={art.d} />
      {art.ground !== false && <path d={GROUND} opacity="0.45" />}
    </svg>
  );
}
