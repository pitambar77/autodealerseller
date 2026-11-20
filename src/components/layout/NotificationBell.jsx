// The bell in the header: notifications arrive live (no reload), with an unread count,
// "mark all as read" and optional desktop alerts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from '@/lib/router';
import { BadgeCheck, Bell, BellRing, Car, CheckCheck, FileText, Inbox, MessageSquareText, ShieldAlert, Sparkles, Tag, UserPlus } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { ago, cn } from '../../utils/format';

const ICONS = { enquiry: Inbox, message: MessageSquareText, saved_price_drop: Tag, registration: UserPlus, document: FileText, listing: Car, doc_verified: BadgeCheck, listing_verify: BadgeCheck, listing_feature: Sparkles };
const iconFor = (kind = '') => ICONS[kind] || (kind.startsWith('saved_') ? Sparkles : /^(doc_|listing_)/.test(kind) ? ShieldAlert : Bell);

/** Unread notifications for the signed-in user (also used for the tab title). */
export function useMyNotifications() {
  const { state, me, role } = useStore();
  return useMemo(() => {
    if (!me) return { list: [], unread: 0 };
    const rid = role === 'bank' ? me.lenderId : me.id;
    const list = (state.notifications || []).filter((n) => n.recipientId === rid).sort((a, b) => new Date(b.at) - new Date(a.at));
    return { list, unread: list.filter((n) => !n.readAt).length };
  }, [state.notifications, me, role]);
}

export function NotificationBell({ className, align = 'right' }) {
  const { role, live, markNotificationsRead } = useStore();
  const { list, unread } = useMyNotifications();
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const loc = useLocation();
  const nav = useNavigate();
  const box = useRef(null);

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // "(3) AutoDealer" in the browser tab while there are unread notifications.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, '');
    document.title = unread ? `(${unread > 99 ? '99+' : unread}) ${base}` : base;
  }, [unread, loc.pathname]);

  const items = list.slice(0, 20);

  const openItem = (n) => {
    if (!n.readAt) markNotificationsRead([n.id]).catch(() => {});
    setOpen(false);
    if (n.link) nav(n.link);
  };

  return (
    <div ref={box} className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-icon relative" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad-600 px-1 text-[10.5px] font-bold text-white ring-2 ring-white num">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {open && (
        <div className={cn('absolute top-11 z-40 w-[340px] max-w-[calc(100vw-24px)] animate-fade-up rounded-xl border border-mist-200 bg-white shadow-pop', align === 'right' ? 'right-0' : 'left-0', 'max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:top-16 max-sm:w-auto')}>
          <div className="flex items-center justify-between gap-2 border-b border-mist-100 px-4 py-2.5">
            <p className="text-sm font-bold">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={() => markNotificationsRead().catch(() => {})} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent-700 hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto py-1">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-mist-500">You're all caught up.</li>}
            {items.map((n) => {
              const Icon = iconFor(n.kind);
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => openItem(n)} className={cn('flex w-full gap-3 px-4 py-2.5 text-left hover:bg-mist-50', !n.readAt && 'bg-accent-50/50')}>
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', !n.readAt ? 'bg-accent-100 text-accent-700' : 'bg-mist-100 text-mist-500')}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[13px] text-ink-900', !n.readAt ? 'font-semibold' : 'font-medium')}>
                        {n.title}
                        {n.count > 1 && <span className="font-normal text-mist-500"> · {n.count} {n.kind === 'document' ? 'documents' : 'messages'}</span>}
                      </span>
                      {n.body && <span className="line-clamp-2 block text-[12.5px] text-mist-600">{n.body}</span>}
                      <span className="block text-[11.5px] text-mist-500">{ago(n.at)}</span>
                    </span>
                    {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-600" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-mist-100 px-4 py-2 text-[12px] text-mist-500">
            <span className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', live === 'open' ? 'bg-ok-500' : 'bg-warn-500')} />
              {live === 'open' ? 'Live: updates arrive instantly' : 'Reconnecting…'}
            </span>
            {perm === 'default' && (
              <button
                type="button"
                className="inline-flex items-center gap-1 font-semibold text-accent-700 hover:underline"
                onClick={() => Notification.requestPermission().then(setPerm).catch(() => {})}
              >
                <BellRing className="h-3.5 w-3.5" /> Desktop alerts
              </button>
            )}
          </div>
          {role === 'admin' && (
            <Link to="/admin/documents" className="block border-t border-mist-100 px-4 py-2.5 text-center text-[13px] font-semibold text-accent-700 hover:bg-mist-50">
              Open the documents queue
            </Link>
          )}
          {role !== 'admin' && role !== 'bank' && (
            <Link to={role === 'buyer' ? '/buyer/messages' : role === 'agent' ? '/agent/listings?tab=enquiries' : `/${role}/enquiries`} className="block border-t border-mist-100 px-4 py-2.5 text-center text-[13px] font-semibold text-accent-700 hover:bg-mist-50">
              {role === 'buyer' ? 'Open messages' : 'Open enquiries'}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
