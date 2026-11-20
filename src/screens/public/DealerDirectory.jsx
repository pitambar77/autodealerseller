// Public dealer directory: browse and search every registered dealer, then open their profile and full stock.
// Route: /dealers   (filters live in the URL so a search can be shared or bookmarked)
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from '@/lib/router';
import { ArrowRight, BadgeCheck, Building2, CalendarDays, Car, Check, Clock, LayoutGrid, List, MapPin, MapPinned, Phone, Store } from 'lucide-react';
import { CityIcon, cityArt } from '../../components/layout/CityIcon';
import { cityPhoto } from '../../data/cityPhotos';
import { useStore } from '../../store/AppStore';
import { Avatar, Badge, Breadcrumbs, Button, CopyText, EmptyState, SearchInput, Select } from '../../components/ui';
import { CarImage } from '../../components/vehicle/CarArt';
import { DEALER_SORTS, dealerHaystack, openStatus, sortDealers, useDealers } from '../../utils/dealers';
import { cn, num, tzs, tzsShort } from '../../utils/format';
import { TYPE_KEYS, VEHICLE_TYPES } from '../../data/vehicleTypes';

const pill = (on) =>
  cn(
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
    on ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-mist-200 bg-white text-mist-700 hover:border-mist-300',
  );

/** City filter tile: a photo of the city (or an illustration if it has none). */
function CityTile({ city, label, count, active, onClick, photo }) {
  const art = city ? cityArt(city) : null;
  const [broken, setBroken] = useState(false);
  const showPhoto = photo && !broken;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={photo?.credit ? `${label} · ${photo.credit.subject}` : label}
      className={cn(
        'group flex w-[128px] shrink-0 snap-start flex-col rounded-xl border bg-white p-1.5 pb-2.5 text-center transition sm:w-[140px]',
        active ? 'border-accent-500 ring-2 ring-accent-100' : 'border-mist-200 hover:-translate-y-0.5 hover:border-mist-300 hover:shadow-lift',
      )}
    >
      <span className={cn('city-art relative flex h-[76px] w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br text-ink-900', showPhoto ? 'bg-mist-200' : art ? art.tint : 'from-ink-800 to-ink-950 text-white')}>
        {showPhoto ? (
          <img src={photo.url} alt={`${label}${photo.credit ? `: ${photo.credit.subject}` : ''}`} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : art ? (
          <CityIcon city={city} className="h-11 w-11 transition-transform group-hover:scale-110" />
        ) : (
          <MapPinned className="h-7 w-7" />
        )}
      </span>
      <span className={cn('mt-2 w-full truncate px-1 text-[13px] font-semibold', active ? 'text-accent-700' : 'text-ink-900')}>{label}</span>
      <span className="text-[11.5px] text-mist-500 num">
        {count} dealer{count === 1 ? '' : 's'}
      </span>
    </button>
  );
}

/** Credits for the Wikimedia Commons photos shown on the city tiles (their licences require it). */
function PhotoCredits({ photos }) {
  const credited = photos.filter((p) => p?.credit);
  if (!credited.length) return null;
  return (
    <details className="mt-1 text-[12px] text-mist-500">
      <summary className="cursor-pointer select-none hover:text-ink-800">City photo credits</summary>
      <ul className="mt-1.5 space-y-0.5">
        {credited.map(({ credit: c }) => (
          <li key={c.city}>
            {c.city}: {c.subject}
            {c.author ? ` by ${c.author}` : ''}, via{' '}
            <a href={c.page} target="_blank" rel="noreferrer" className="underline hover:text-ink-800">
              Wikimedia Commons
            </a>
            {c.license ? ` (${c.license})` : ''}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function DealerDirectory() {
  const { state } = useStore();
  const dealers = useDealers();
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const [q, setQ] = useState(get('q'));
  const city = get('city');
  const brand = get('brand');
  const verified = get('verified') === '1';
  const inStock = get('stock') === '1';
  const sells = VEHICLE_TYPES[get('type')] ? get('type') : '';
  const sort = get('sort') || 'stock';
  const view = get('view') === 'list' ? 'list' : 'grid';

  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  // Debounce typing into the URL.
  useEffect(() => {
    const t = setTimeout(() => q !== get('q') && set({ q: q.trim() }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const cities = useMemo(() => {
    const m = {};
    dealers.forEach((d) => (m[d.city] = (m[d.city] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [dealers]);
  const brands = useMemo(() => [...new Set(dealers.flatMap((d) => [...d.stockMakes, ...d.brands]))].sort(), [dealers]);

  const results = useMemo(() => {
    const words = get('q').toLowerCase().split(/\s+/).filter(Boolean);
    const list = dealers.filter((d) => {
      if (city && d.city !== city) return false;
      if (brand && !d.stockMakes.includes(brand) && !d.brands.includes(brand)) return false;
      if (verified && d.trust.key !== 'verified') return false;
      if (inStock && !d.cars.length) return false;
      if (sells && !d.typeCounts[sells]) return false;
      if (words.length) {
        const h = dealerHaystack(d);
        if (!words.every((w) => h.includes(w))) return false;
      }
      return true;
    });
    return sortDealers(list, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealers, params]);

  const totalCars = dealers.reduce((t, d) => t + d.cars.length, 0);
  const active = [get('q'), city, brand, verified, inStock, sells].filter(Boolean).length;
  const clear = () => {
    setQ('');
    setParams(view === 'list' ? { view: 'list' } : {}, { replace: true });
  };

  return (
    <div>
      <section className="border-b border-mist-200 bg-white">
        <div className="container-page py-6 md:py-9">
          <Breadcrumbs items={[{ label: 'Buy', to: '/cars' }, { label: 'Dealers' }]} className="mb-4" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Dealer directory</p>
              <h1 className="mt-1 text-[28px] font-bold leading-tight md:text-[36px]">Find a dealer you can trust</h1>
              <p className="mt-2 text-[15px] text-mist-600 num">
                {dealers.length} registered dealer{dealers.length === 1 ? '' : 's'} in {cities.length} cit{cities.length === 1 ? 'y' : 'ies'} · {num(totalCars)} vehicles for sale. Open any dealer to see their showroom details and everything they have listed.
              </p>
            </div>
            <ul className="grid shrink-0 grid-cols-3 gap-2 text-center sm:gap-3">
              {[
                [dealers.length, 'Dealers'],
                [dealers.filter((d) => d.trust.key === 'verified').length, 'Verified'],
                [num(totalCars), 'Vehicles listed'],
              ].map(([n, l]) => (
                <li key={l} className="rounded-xl border border-mist-200 bg-mist-50 px-3 py-2.5 sm:px-5">
                  <p className="text-xl font-bold text-ink-900 num md:text-2xl">{n}</p>
                  <p className="text-[12px] text-mist-500">{l}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <SearchInput value={q} onChange={setQ} placeholder="Search dealer, owner, area or brand" className="flex-1 [&_input]:h-12 [&_input]:text-[15px]" />
            <Select aria-label="City" value={city} onChange={(e) => set({ city: e.target.value })} placeholder="All cities" options={cities.map(([c]) => c)} className="sm:w-52 [&_select]:h-12 [&_select]:text-[15px]" />
          </div>
          {/* City tiles with a photo of each city */}
          <div className="-mx-4 mt-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by city">
            <CityTile label="All cities" count={dealers.length} active={!city} onClick={() => set({ city: '' })} />
            {cities.map(([c, n]) => (
              <CityTile key={c} city={c} label={c} count={n} photo={cityPhoto(c, state.config)} active={city === c} onClick={() => set({ city: city === c ? '' : c })} />
            ))}
          </div>
          <PhotoCredits photos={cities.map(([c]) => cityPhoto(c, state.config))} />
        </div>
      </section>

      <div className="container-page py-6 md:py-8">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={verified} className={pill(verified)} onClick={() => set({ verified: verified ? '' : '1' })}>
              {verified ? <Check className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />} Verified dealers only
            </button>
            <button type="button" aria-pressed={inStock} className={pill(inStock)} onClick={() => set({ stock: inStock ? '' : '1' })}>
              {inStock ? <Check className="h-3.5 w-3.5" /> : <Car className="h-3.5 w-3.5" />} Has stock for sale
            </button>
            {TYPE_KEYS.map((k) => {
              const Ty = VEHICLE_TYPES[k];
              return (
                <button key={k} type="button" aria-pressed={sells === k} className={pill(sells === k)} onClick={() => set({ type: sells === k ? '' : k })}>
                  <Ty.icon className="h-3.5 w-3.5" /> {Ty.plural}
                </button>
              );
            })}
            <Select aria-label="Brand" value={brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Any brand" options={brands} className="w-[150px] [&_select]:h-9 [&_select]:py-0 [&_select]:text-[13px]" />
            {active > 0 && (
              <button type="button" onClick={clear} className="px-2 text-[13px] font-semibold text-accent-700 hover:underline">
                Clear all
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select aria-label="Sort dealers" value={sort} onChange={(e) => set({ sort: e.target.value === 'stock' ? '' : e.target.value })} options={DEALER_SORTS} className="min-w-0 flex-1 lg:w-[200px] lg:flex-none [&_select]:h-9 [&_select]:py-0 [&_select]:text-[13px]" />
            <div className="flex shrink-0 rounded-lg border border-mist-200 bg-white p-0.5" role="group" aria-label="Layout">
              {[
                ['grid', LayoutGrid, 'Grid view'],
                ['list', List, 'List view'],
              ].map(([v, Icon, label]) => (
                <button key={v} type="button" aria-label={label} title={label} aria-pressed={view === v} onClick={() => set({ view: v === 'grid' ? '' : v })} className={cn('rounded-md p-1.5', view === v ? 'bg-ink-900 text-white' : 'text-mist-500 hover:text-ink-900')}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mb-4 text-sm text-mist-600 num" aria-live="polite">
          Showing {results.length} of {dealers.length} dealer{dealers.length === 1 ? '' : 's'}
          {city ? ` in ${city}` : ''}
          {brand ? ` selling ${brand}` : ''}
        </p>

        {results.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No dealers match your search"
            message="Try another city or brand, or clear the filters to see every dealer."
            action={
              <Button variant="secondary" onClick={clear}>
                Clear filters
              </Button>
            }
          />
        ) : view === 'grid' ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((d) => (
              <DealerCard key={d.id} d={d} />
            ))}
          </div>
        ) : (
          <div className="card divide-y divide-mist-100 overflow-hidden">
            {results.map((d) => (
              <DealerRow key={d.id} d={d} />
            ))}
          </div>
        )}

        <section className="mt-10 flex flex-col items-start gap-4 rounded-2xl bg-ink-950 p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-sun-400">For showrooms</p>
            <h2 className="mt-1 text-xl font-bold text-white md:text-2xl">Run a car, bike or truck dealership? Get listed here.</h2>
            <p className="mt-1 max-w-xl text-sm text-ink-300">Register your business, upload your documents and your showroom appears in this directory with every car you list.</p>
          </div>
          <Button to="/register/dealer" iconRight={ArrowRight} className="shrink-0">
            Register as a dealer
          </Button>
        </section>
      </div>
    </div>
  );
}

const profileUrl = (d) => `/dealers/${d.id}`;

function TrustBadge({ d }) {
  return (
    <Badge tone={d.trust.tone} icon={d.trust.key === 'verified' ? BadgeCheck : undefined}>
      {d.trust.label}
    </Badge>
  );
}

function OpenNow({ hours, className }) {
  const s = openStatus(hours);
  if (!s) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[12.5px] font-semibold', s.open ? 'text-ok-700' : 'text-mist-500', className)}>
      <Clock className="h-3.5 w-3.5" /> {s.label}
    </span>
  );
}

function CallButton({ d, className }) {
  const [shown, setShown] = useState(false);
  if (shown)
    return (
      <span className={cn('inline-flex h-10 items-center justify-between gap-2 rounded-lg border border-mist-200 bg-mist-50 pl-3 pr-1', className)}>
        <a href={`tel:${d.phone.replace(/\s/g, '')}`} className="whitespace-nowrap font-mono text-[13px] font-semibold text-ink-900">
          {d.phone}
        </a>
        <CopyText text={d.phone} />
      </span>
    );
  return (
    <Button variant="secondary" icon={Phone} onClick={() => setShown(true)} className={className}>
      Call
    </Button>
  );
}

function Thumbs({ d, className, compact }) {
  const shown = d.cars.slice(0, 3);
  if (!shown.length)
    return (
      <div className={cn('flex flex-col items-center justify-center gap-1 bg-mist-100 text-center text-mist-500', className)}>
        <Car className="h-6 w-6" />
        <span className="text-[12.5px] font-semibold">Nothing listed right now</span>
      </div>
    );
  return (
    <div className={cn('grid gap-0.5 bg-mist-100', shown.length === 1 ? 'grid-cols-1' : shown.length === 2 ? 'grid-cols-2' : 'grid-cols-[2fr_1fr] grid-rows-2', className)}>
      {shown.map((c, i) => (
        <div key={c.id} className={cn('relative min-h-0 overflow-hidden', shown.length === 3 && i === 0 && 'row-span-2')}>
          <CarImage vehicle={c} className="h-full w-full object-cover" />
          {i === shown.length - 1 && d.cars.length > shown.length && (
            <span className="absolute inset-0 flex items-center justify-center bg-ink-950/55 text-sm font-bold text-white">+{d.cars.length - shown.length}{compact ? '' : ' more'}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Small icons showing how many vehicles of each category a dealer has. */
function TypeStock({ d, className }) {
  const types = TYPE_KEYS.filter((k) => d.typeCounts?.[k]);
  if (!types.length) return null;
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-semibold text-ink-800', className)}>
      {types.map((k) => {
        const Ty = VEHICLE_TYPES[k];
        return (
          <span key={k} className="inline-flex items-center gap-1" title={`${d.typeCounts[k]} ${d.typeCounts[k] === 1 ? Ty.noun : Ty.nounPlural}`}>
            <Ty.icon className="h-4 w-4 text-mist-500" /> {d.typeCounts[k]} {d.typeCounts[k] === 1 ? Ty.noun : Ty.nounPlural}
          </span>
        );
      })}
    </p>
  );
}

function DealerCard({ d }) {
  const brands = (d.stockMakes.length ? d.stockMakes : d.brands).slice(0, 4);
  const moreBrands = (d.stockMakes.length ? d.stockMakes : d.brands).length - brands.length;
  return (
    <article className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-pop">
      <Link to={profileUrl(d)} aria-label={`${d.business} — view stock`} className="block">
        <Thumbs d={d} className="h-40" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <Avatar name={d.business || d.name} size={44} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-bold leading-snug">
              <Link to={profileUrl(d)} className="hover:text-accent-700">
                {d.business || d.name}
              </Link>
            </h2>
            <p className="truncate text-[13px] text-mist-600">{d.businessType}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <TrustBadge d={d} />
          <OpenNow hours={d.hours} />
        </div>
        <p className="mt-2.5 flex items-start gap-1.5 text-[13px] text-mist-600">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">{[d.address?.line2, d.city].filter(Boolean).join(', ')}</span>
        </p>
        <TypeStock d={d} className="mt-2" />

        <dl className="mt-4 grid grid-cols-[1fr_1.7fr_1fr] gap-2 rounded-xl bg-mist-50 p-3 text-center">
          <div className="min-w-0">
            <dt className="text-[11.5px] text-mist-500">For sale</dt>
            <dd className="font-bold text-ink-900 num">{d.cars.length}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11.5px] text-mist-500">From</dt>
            <dd className="truncate font-bold text-ink-900 num" title={d.cars.length ? tzsShort(d.minPrice) : ''}>
              {d.cars.length ? tzsShort(d.minPrice) : '—'}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11.5px] text-mist-500">Since</dt>
            <dd className="font-bold text-ink-900 num">{d.yearEstablished || new Date(d.registeredAt).getFullYear()}</dd>
          </div>
        </dl>

        {brands.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {brands.map((b) => (
              <span key={b} className="rounded-md bg-mist-100 px-2 py-0.5 text-[12px] font-semibold text-mist-700">
                {b}
              </span>
            ))}
            {moreBrands > 0 && <span className="px-1 py-0.5 text-[12px] font-semibold text-mist-500">+{moreBrands}</span>}
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-5">
          <Button to={profileUrl(d)} iconRight={ArrowRight} className="flex-1 whitespace-nowrap">
            View dealer &amp; stock
          </Button>
          <CallButton d={d} />
        </div>
      </div>
    </article>
  );
}

function DealerRow({ d }) {
  return (
    <article className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center md:p-5">
      <div className="flex min-w-0 items-start gap-4">
        <Link to={profileUrl(d)} className="hidden h-20 w-28 shrink-0 overflow-hidden rounded-lg sm:block" aria-hidden tabIndex={-1}>
          <Thumbs d={d} compact className="h-full [&_span]:text-[11px]" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="min-w-0 truncate text-[16px] font-bold">
              <Link to={profileUrl(d)} className="hover:text-accent-700">
                {d.business || d.name}
              </Link>
            </h2>
            <TrustBadge d={d} />
          </div>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-mist-600">
            <li className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> {d.businessType}
            </li>
            <li className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {[d.address?.line2, d.city].filter(Boolean).join(', ')}
            </li>
            <li className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Since {d.yearEstablished || new Date(d.registeredAt).getFullYear()}
            </li>
          </ul>
          <p className="mt-1.5 text-[13px] num">
            <span className="font-bold text-ink-900">{d.cars.length} vehicle{d.cars.length === 1 ? '' : 's'} for sale</span>
            {d.cars.length > 0 && <span className="text-mist-600"> · from {tzsShort(d.minPrice)}</span>}
            {d.stockMakes.length > 0 && <span className="text-mist-500"> · {d.stockMakes.slice(0, 4).join(', ')}</span>}
          </p>
          <TypeStock d={d} className="mt-1" />
          <OpenNow hours={d.hours} className="mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <CallButton d={d} />
        <Button to={profileUrl(d)} iconRight={ArrowRight} className="flex-1 whitespace-nowrap md:flex-none">
          View dealer &amp; stock
        </Button>
      </div>
    </article>
  );
}
