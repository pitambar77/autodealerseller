// Trust indicators under the home page banner buttons ("Direct seller contact", "Verified documents"…).
// Admins manage the text, icon, optional link and on/off in Admin → Website content → Trust indicators.
import { BadgeCheck, Car, Clock, FileCheck2, Handshake, Headset, MapPin, Phone, ShieldCheck, Star, ThumbsUp, Wallet } from 'lucide-react';
import { Link } from '@/lib/router';
import { DEFAULT_CONFIG } from '../../config/site';
import { cn } from '../../utils/format';

export const TRUST_ICON_OPTIONS = [
  { value: 'badge-check', label: 'Tick badge', Icon: BadgeCheck },
  { value: 'shield-check', label: 'Shield', Icon: ShieldCheck },
  { value: 'file-check', label: 'Document', Icon: FileCheck2 },
  { value: 'phone', label: 'Phone', Icon: Phone },
  { value: 'handshake', label: 'Handshake', Icon: Handshake },
  { value: 'star', label: 'Star', Icon: Star },
  { value: 'map-pin', label: 'Location', Icon: MapPin },
  { value: 'wallet', label: 'Wallet', Icon: Wallet },
  { value: 'car', label: 'Car', Icon: Car },
  { value: 'clock', label: 'Clock', Icon: Clock },
  { value: 'headset', label: 'Support', Icon: Headset },
  { value: 'thumbs-up', label: 'Thumbs up', Icon: ThumbsUp },
];

export function TrustIcon({ name, className }) {
  const Icon = TRUST_ICON_OPTIONS.find((o) => o.value === name)?.Icon || BadgeCheck;
  return <Icon className={className} aria-hidden="true" />;
}

/** The indicators to show: the admin's list (switched-on ones), or the defaults before data has loaded. */
export function useTrustItems(config) {
  const list = Array.isArray(config?.trustIndicators) ? config.trustIndicators : DEFAULT_CONFIG.trustIndicators;
  return list.filter((t) => t.enabled !== false && t.text);
}

function Item({ t }) {
  const body = (
    <>
      <TrustIcon name={t.icon} className="h-4 w-4 shrink-0 text-[#F8D000]" />
      <span>{t.text}</span>
    </>
  );
  if (!t.link) return <div className="flex items-center gap-2">{body}</div>;
  const cls = 'flex items-center gap-2 underline-offset-4 transition hover:text-white hover:underline';
  return t.link.startsWith('/') ? (
    <Link to={t.link} className={cls}>
      {body}
    </Link>
  ) : (
    <a href={t.link} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  );
}

export function TrustIndicators({ items, className }) {
  if (!items?.length) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[13px] text-white/75 sm:text-sm', className)}>
      {items.map((t, i) => (
        <Item key={t.id || i} t={t} />
      ))}
    </div>
  );
}
