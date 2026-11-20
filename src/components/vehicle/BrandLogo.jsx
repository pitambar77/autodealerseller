// Brand logo tile for a vehicle make. Logo files live in /public/brands (from the open-source
// car-logos-dataset; the logos themselves are trademarks of their owners). A make without a
// logo file shows its initials instead, so new brands never break the layout.
import { useState } from 'react';
import { cn } from '../../utils/format';

const LOGOS = {
  'Maruti Suzuki': 'maruti-suzuki',
  Suzuki: 'maruti-suzuki',
  Hyundai: 'hyundai',
  Tata: 'tata',
  Mahindra: 'mahindra',
  Honda: 'honda',
  Toyota: 'toyota',
  Kia: 'kia',
  MG: 'mg',
  Skoda: 'skoda',
  Volkswagen: 'volkswagen',
  BMW: 'bmw',
  'Mercedes-Benz': 'mercedes-benz',
  KTM: 'ktm',
  Eicher: 'eicher',
  BharatBenz: 'bharatbenz',
  Isuzu: 'isuzu',
  'Mitsubishi Fuso': 'mitsubishi-fuso',
  Sinotruk: 'sinotruk',
  Scania: 'scania',
};

export const brandLogoSrc = (make) => (LOGOS[make] ? `/brands/${LOGOS[make]}.png` : null);

const initials = (make = '') =>
  make
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/** White tile (also in dark mode, so every logo stays legible). size: 'sm' | 'md' | 'lg'. */
export function BrandLogo({ make, size = 'md', className }) {
  const [failed, setFailed] = useState(false);
  const src = brandLogoSrc(make);
  const box = { sm: 'h-9 w-12', md: 'h-12 w-16', lg: 'h-16 w-24' }[size];
  return (
    <span className={cn('keep-light flex shrink-0 items-center justify-center rounded-lg bg-[#fff] p-1.5', box, className)}>
      {src && !failed ? (
        <img src={src} alt={`${make} logo`} loading="lazy" onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="font-display text-[15px] font-extrabold text-[#13282D]" aria-hidden="true">
          {initials(make)}
        </span>
      )}
    </span>
  );
}
