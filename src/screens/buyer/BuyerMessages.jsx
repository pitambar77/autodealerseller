// Buyer → Messages: every conversation with sellers, with live replies.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from '@/lib/router';
import { ArrowLeft, MessageSquareText, Phone, Search } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Avatar, Button, EmptyState, PageHeader, SearchInput } from '../../components/ui';
import { CarImage } from '../../components/vehicle/CarArt';
import { vehicleTitle } from '../../components/vehicle/VehicleCard';
import { ChatThread } from '../../components/messages/ChatThread';
import { ago, cn, tzs } from '../../utils/format';
import { lastAt, lastMessage, threadOf, unreadFor } from '../../utils/messages';
import { typeFor, defaultCategory, vehiclePath } from '../../data/vehicleTypes';

export const sellerName = (u) => u?.business || u?.agency || u?.name || 'Seller';

export default function BuyerMessages() {
  const { state, me, vehicle, user, sendMessage, markConversationRead } = useStore();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(params.get('c'));
  const linked = params.get('c');
  useEffect(() => {
    if (linked) setSelected(linked);
  }, [linked]);

  const mine = useMemo(() => state.enquiries.filter((e) => e.buyerId === me.id).sort((a, b) => new Date(lastAt(b)) - new Date(lastAt(a))), [state.enquiries, me.id]);
  const list = mine.filter((e) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    const v = vehicle(e.vehicleId);
    return `${sellerName(user(e.sellerId))} ${v ? vehicleTitle(v) : ''} ${threadOf(e).map((m) => m.text).join(' ')}`.toLowerCase().includes(t);
  });
  const wide = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const current = mine.find((e) => e.id === selected) || (wide ? list[0] : null);
  const cv = current ? vehicle(current.vehicleId) : null;
  const seller = current ? user(current.sellerId) : null;
  const send = useCallback((text) => sendMessage(current.id, text), [current?.id, sendMessage]);
  const markRead = useCallback(() => current && markConversationRead(current.id), [current?.id, markConversationRead]);
  const open = (id) => {
    setSelected(id);
    if (linked) setParams({}, { replace: true });
  };

  return (
    <div>
      <PageHeader title="Messages" description="Your conversations with sellers. Replies arrive here as soon as they're sent." />
      {!mine.length ? (
        <EmptyState
          icon={MessageSquareText}
          title="No conversations yet"
          message="Message a seller from any listing and the conversation continues here."
          action={<Button to={typeFor(defaultCategory()).path} icon={Search}>Browse vehicles</Button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(280px,340px)_1fr]">
            <div className={cn('border-mist-100 lg:border-r', current && selected ? 'hidden lg:block' : '')}>
              <div className="border-b border-mist-100 p-3">
                <SearchInput value={q} onChange={setQ} placeholder="Search messages" />
              </div>
              <ul className="max-h-[70vh] divide-y divide-mist-100 overflow-y-auto">
                {list.map((e) => {
                  const v = vehicle(e.vehicleId);
                  const n = unreadFor(e, 'buyer');
                  const last = lastMessage(e);
                  return (
                    <li key={e.id}>
                      <button type="button" onClick={() => open(e.id)} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-mist-50', current?.id === e.id && 'bg-accent-50/60')}>
                        {v ? <CarImage vehicle={v} view="side" className="h-11 w-16 shrink-0 rounded-md" /> : <Avatar name={sellerName(user(e.sellerId))} size={40} />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn('truncate text-sm', n ? 'font-bold' : 'font-semibold')}>{sellerName(user(e.sellerId))}</p>
                            <span className={cn('shrink-0 text-[11.5px]', n ? 'font-semibold text-accent-700' : 'text-mist-500')}>{ago(lastAt(e))}</span>
                          </div>
                          <p className="truncate text-[12.5px] text-mist-500">{v ? vehicleTitle(v) : 'Vehicle no longer listed'}</p>
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn('truncate text-[13px]', n ? 'text-ink-800' : 'text-mist-600')}>
                              {last?.from === 'buyer' && <span className="text-mist-500">You: </span>}
                              {last?.text}
                            </p>
                            {n > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[11px] font-bold text-white">{n}</span>}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            {current && (
              <div className={cn('flex min-w-0 flex-col p-4 sm:p-5', !selected && 'hidden lg:flex')}>
                <button type="button" onClick={() => setSelected(null)} className="mb-3 inline-flex items-center gap-1 self-start text-sm font-semibold text-mist-600 lg:hidden">
                  <ArrowLeft className="h-4 w-4" /> All messages
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={sellerName(seller)} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{sellerName(seller)}</p>
                    <p className="text-[13px] text-mist-500">{{ dealer: 'Dealer', seller: 'Private owner', agent: "Agent for the owner" }[seller?.role] || 'Seller'}</p>
                  </div>
                  {seller?.phone && (
                    <a href={`tel:${seller.phone.replace(/\s/g, '')}`} className="btn btn-sm btn-secondary">
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                  )}
                </div>
                {cv && (
                  <Link to={vehiclePath(cv)} className="mt-3 flex items-center gap-3 rounded-xl border border-mist-200 p-2 hover:border-accent-300">
                    <CarImage vehicle={cv} view="side" className="h-12 w-20 shrink-0 rounded-md" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{vehicleTitle(cv)}</span>
                      <span className="block text-[13px] text-mist-500 num">
                        {tzs(cv.price)}
                        {cv.status !== 'live' && ` · ${cv.status === 'sold' ? 'Sold' : 'No longer listed'}`}
                      </span>
                    </span>
                  </Link>
                )}
                <ChatThread key={current.id} enquiry={current} side="buyer" send={send} markRead={selected === current.id ? markRead : undefined} otherName={sellerName(seller).split(' ')[0]} className="mt-4 h-[min(520px,62vh)]" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
