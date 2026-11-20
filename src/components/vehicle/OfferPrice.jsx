// How a listing's price shows when the seller runs a discount or special offer.
import { Gift, Tag } from 'lucide-react';
import { cn, date, tzs } from '../../utils/format';

/** Is this listing's offer running? (Expired ones are cleared by the API within minutes.) */
export const offerOf = (v) => (v?.offer && (!v.offer.endsAt || new Date(v.offer.endsAt) > new Date()) ? v.offer : null);
export const offerPercent = (o) => (o?.originalPrice ? Math.round((o.discount / o.originalPrice) * 100) : 0);

/** Small ribbon for cards: "−10%" or "Offer". */
export function OfferRibbon({ v, className }) {
  const o = offerOf(v);
  if (!o) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-bad-600 px-2 py-0.5 text-[11.5px] font-bold text-white shadow-sm', className)} title={o.label || o.details || 'Special offer'}>
      {o.kind === 'discount' ? <Tag className="h-3 w-3" /> : <Gift className="h-3 w-3" />}
      {o.kind === 'discount' ? `−${offerPercent(o)}%` : 'Offer'}
    </span>
  );
}

/** Price with the original struck through (cards and lists). */
export function OfferPriceInline({ v, className }) {
  const o = offerOf(v);
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-1.5', className)}>
      <span className={o?.kind === 'discount' ? 'text-bad-700' : undefined}>{tzs(v.price)}</span>
      {o?.kind === 'discount' && <s className="text-[0.82em] font-medium text-mist-400">{tzs(o.originalPrice)}</s>}
    </span>
  );
}

/** The offer box on the listing page. */
export function OfferPanel({ v }) {
  const o = offerOf(v);
  if (!o) return null;
  return (
    <div className="mt-3 rounded-xl border border-bad-100 bg-bad-50/60 p-3">
      <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold text-bad-700">
        {o.kind === 'discount' ? <Tag className="h-4 w-4" /> : <Gift className="h-4 w-4" />}
        {o.label || (o.kind === 'discount' ? 'Price reduced' : 'Special offer')}
        {o.kind === 'discount' && (
          <span className="font-semibold">
            · save {tzs(o.discount)} ({offerPercent(o)}%)
          </span>
        )}
      </p>
      {o.details && <p className="mt-0.5 text-[13.5px] text-ink-800">{o.details}</p>}
      {o.endsAt && <p className="mt-0.5 text-[12px] text-mist-600">Offer ends {date(o.endsAt)}</p>}
    </div>
  );
}
