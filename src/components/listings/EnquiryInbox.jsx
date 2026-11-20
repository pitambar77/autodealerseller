import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from '@/lib/router';
import { ArrowLeft, CheckCircle2, CircleDot, Inbox, Landmark, Mail, MessageCircle, Phone, XCircle } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Avatar, Badge, EmptyState, Pagination, SearchInput, Select, StatusBadge, Tabs, useToast } from '../ui';
import { LOAN_STEPS } from '../../data/partnerBanks';
import { CarImage } from '../vehicle/CarArt';
import { vehicleTitle } from '../vehicle/VehicleCard';
import { ago, cn, dateTime, tzs } from '../../utils/format';
import { lastAt, lastMessage, threadOf, unreadFor } from '../../utils/messages';
import { ChatThread } from '../messages/ChatThread';
import { vehiclePath } from '../../data/vehicleTypes';

export const ENQ_STATUS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'closed', label: 'Closed · deal' },
  { value: 'lost', label: 'Closed · no deal' },
  { value: 'spam', label: 'Spam' },
];

/** Two-pane inbox: conversations on the left, the chat on the right (stacked on phones). */
export function EnquiryInbox({ showVehicleFilter = true, compact }) {
  const { state, me, vehicle, setEnquiryStatus, sendMessage, markConversationRead } = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('open');
  const [q, setQ] = useState('');
  const [veh, setVeh] = useState('');
  const [selected, setSelected] = useState(params.get('c'));
  const [page, setPage] = useState(1);
  const PS = 10;

  // Links from notifications and toasts open a conversation with ?c=<id>
  const linked = params.get('c');
  useEffect(() => {
    if (linked) setSelected(linked);
  }, [linked]);

  const mine = useMemo(() => state.enquiries.filter((e) => e.sellerId === me.id).sort((a, b) => new Date(lastAt(b)) - new Date(lastAt(a))), [state.enquiries, me.id]);
  const vehicles = [...new Set(mine.map((e) => e.vehicleId))].map((id) => vehicle(id)).filter(Boolean);
  const isOpen = (e) => ['new', 'contacted', 'negotiating'].includes(e.status);
  const unreadCount = mine.filter((e) => unreadFor(e, 'seller') > 0).length;
  const list = mine.filter((e) => {
    if (tab === 'open' && !isOpen(e)) return false;
    if (tab === 'unread' && !unreadFor(e, 'seller')) return false;
    if (tab === 'closed' && isOpen(e)) return false;
    if (tab === 'finance' && e.type !== 'finance') return false;
    if (veh && e.vehicleId !== veh) return false;
    const t = q.trim().toLowerCase();
    if (t && !`${e.buyerName} ${e.buyerPhone} ${threadOf(e).map((m) => m.text).join(' ')}`.toLowerCase().includes(t)) return false;
    return true;
  });
  const pages = Math.max(1, Math.ceil(list.length / PS));
  const view = list.slice((page - 1) * PS, page * PS);
  const wide = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const current = mine.find((e) => e.id === selected) || (wide && !compact ? view[0] : null);
  const cv = current ? vehicle(current.vehicleId) : null;

  const open = (id) => {
    setSelected(id);
    if (linked) setParams((p) => { const n = new URLSearchParams(p); n.delete('c'); return n; }, { replace: true });
  };
  const setStatus = (id, s) => {
    setEnquiryStatus(id, s);
    toast(`Enquiry marked "${ENQ_STATUS.find((x) => x.value === s).label}".`, { tone: 'info' });
  };
  const send = useCallback((text) => sendMessage(current.id, text), [current?.id, sendMessage]);
  const markRead = useCallback(() => current && markConversationRead(current.id), [current?.id, markConversationRead]);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-mist-100 px-4 pt-2">
        <Tabs
          value={tab}
          onChange={(t) => {
            setTab(t);
            setPage(1);
          }}
          tabs={[
            { value: 'open', label: 'Open', count: mine.filter(isOpen).length },
            { value: 'unread', label: 'Unread', count: unreadCount },
            ...(mine.some((e) => e.type === 'finance') ? [{ value: 'finance', label: 'Finance', count: mine.filter((e) => e.type === 'finance').length }] : []),
            { value: 'closed', label: 'Closed', count: mine.filter((e) => !isOpen(e)).length },
            { value: 'all', label: 'All', count: mine.length },
          ]}
        />
      </div>
      <div className={cn('grid', !compact && 'lg:grid-cols-[minmax(300px,360px)_1fr]')}>
        <div className={cn('border-mist-100 lg:border-r', current && selected ? 'hidden lg:block' : '')}>
          <div className="flex flex-col gap-2 border-b border-mist-100 p-3 sm:flex-row">
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search buyer or message" className="flex-1" />
            {showVehicleFilter && vehicles.length > 1 && (
              <Select aria-label="Filter by vehicle" value={veh} onChange={(e) => { setVeh(e.target.value); setPage(1); }} placeholder="All vehicles" options={vehicles.map((v) => ({ value: v.id, label: `${v.make} ${v.model} ${v.year}` }))} className="sm:w-44" />
            )}
          </div>
          {view.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Inbox} title={tab === 'unread' ? 'All caught up' : 'No enquiries here'} message={tab === 'unread' ? 'You have read every message.' : 'When buyers message you about your vehicles, the conversations show up here.'} />
            </div>
          ) : (
            <ul className="divide-y divide-mist-100">
              {view.map((e) => {
                const v = vehicle(e.vehicleId);
                const n = unreadFor(e, 'seller');
                const last = lastMessage(e);
                return (
                  <li key={e.id}>
                    <button type="button" onClick={() => open(e.id)} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-mist-50', current?.id === e.id && 'bg-accent-50/60')}>
                      <Avatar name={e.buyerName} size={38} tone="mist" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn('truncate text-sm', n ? 'font-bold text-ink-900' : 'font-semibold text-ink-800')}>{e.buyerName}</p>
                          <span className={cn('shrink-0 text-[11.5px]', n ? 'font-semibold text-accent-700' : 'text-mist-500')}>{ago(lastAt(e))}</span>
                        </div>
                        <p className="truncate text-[12.5px] text-mist-500">{v ? vehicleTitle(v) : e.vehicleId}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className={cn('truncate text-[13px]', n ? 'text-ink-800' : 'text-mist-600')}>
                            {last?.from === 'seller' && <span className="text-mist-500">You: </span>}
                            {last?.text}
                          </p>
                          <span className="flex shrink-0 items-center gap-1">
                            {e.type === 'finance' && <Badge tone="info" icon={Landmark}>Finance</Badge>}
                            {n > 0 ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[11px] font-bold text-white" aria-label={`${n} unread`}>{n}</span> : <StatusBadge status={e.status} />}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination className="border-t border-mist-100 px-4 py-3" page={page} pages={pages} onChange={setPage} />
        </div>

        {current && !compact && (
          <div className={cn('flex min-w-0 flex-col p-4 sm:p-5', !selected && 'hidden lg:flex')}>
            <button type="button" onClick={() => setSelected(null)} className="mb-3 inline-flex items-center gap-1 self-start text-sm font-semibold text-mist-600 lg:hidden">
              <ArrowLeft className="h-4 w-4" /> All enquiries
            </button>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={current.buyerName} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">{current.buyerName}</p>
                  <p className="text-[13px] text-mist-500">
                    {current.buyerId ? 'Registered buyer' : 'Guest buyer'} · since {dateTime(current.createdAt)}
                  </p>
                </div>
              </div>
              <Select aria-label="Enquiry status" value={current.status} onChange={(ev) => setStatus(current.id, ev.target.value)} options={ENQ_STATUS} className="w-[180px]" />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a href={`tel:${current.buyerPhone?.replace(/\s/g, '')}`} className="btn btn-sm btn-dark" onClick={() => current.status === 'new' && setStatus(current.id, 'contacted')}>
                <Phone className="h-3.5 w-3.5" /> Call {current.buyerPhone}
              </a>
              <a className="btn btn-sm btn-secondary" href={`https://wa.me/${current.buyerPhone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              {current.buyerEmail && (
                <a className="btn btn-sm btn-secondary" href={`mailto:${current.buyerEmail}`}>
                  <Mail className="h-3.5 w-3.5" /> Email
                </a>
              )}
              {cv && (
                <Link to={vehiclePath(cv)} className="ml-auto flex min-w-0 items-center gap-2 rounded-lg border border-mist-200 py-1 pl-1 pr-3 hover:border-accent-300">
                  <CarImage vehicle={cv} view="side" className="h-9 w-14 shrink-0 rounded-md" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{vehicleTitle(cv)}</span>
                    <span className="block text-[12px] text-mist-500 num">{tzs(cv.price)}</span>
                  </span>
                </Link>
              )}
            </div>

            {current.type === 'finance' && <FinancePanel e={current} />}

            <ChatThread
              key={current.id}
              enquiry={current}
              side="seller"
              send={send}
              markRead={selected === current.id ? markRead : undefined}
              otherName={current.buyerName.split(' ')[0]}
              className="mt-4 h-[min(520px,62vh)]"
              disabled={current.status === 'spam'}
              disabledReason="Marked as spam. Change the status to reply."
            />
            <p className="mt-2 text-[12px] text-mist-500">
              {current.buyerId ? 'The buyer sees your replies in their AutoDealer messages.' : 'This buyer has no account: they get your reply by SMS with a link back to this chat.'} Status is for your own tracking.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Loan terms and the partner bank's live progress for a finance enquiry. */
function FinancePanel({ e }) {
  const { state } = useStore();
  const f = e.finance;
  const ref = state.referrals.find((r) => r.id === f.referralId);
  const status = ref?.status || 'referred';
  const step = LOAN_STEPS.findIndex((s) => s.value === status);
  const last = ref?.history?.[0];
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-info-100">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-info-50 px-4 py-2.5">
        <p className="flex items-center gap-2 text-[13.5px] font-bold text-info-700">
          <Landmark className="h-4 w-4" /> Finance enquiry · {f.lender} also notified
        </p>
        <span className="font-mono text-[12px] font-semibold text-info-700">Lead {f.referralId}</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <dl className="space-y-1 text-[13.5px]">
          {[
            ['Car price', tzs(f.price)],
            ['Down payment', tzs(f.downPayment)],
            ['Loan', `${tzs(f.loanAmount)} · ${f.months} mo`],
            ['EMI shown', `${tzs(f.emi)}/mo at ${f.ratePct.toFixed(2)}%`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-mist-600">{k}</dt>
              <dd className="text-right font-semibold text-ink-900 num">{v}</dd>
            </div>
          ))}
        </dl>
        <dl className="space-y-1 text-[13.5px]">
          {[
            ['Earns as', f.employment],
            ['Income', f.income || 'Not shared'],
            ['Best time to call', f.callTime],
            ['Also wants', [f.testDrive && 'Test drive', f.exchange && 'Exchange'].filter(Boolean).join(', ') || '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-mist-600">{k}</dt>
              <dd className="text-right font-semibold text-ink-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="border-t border-mist-100 px-4 py-3">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-mist-500">Bank progress</p>
        <ol className="flex flex-wrap gap-1.5">
          {LOAN_STEPS.map((s, i) => (
            <li key={s.value} className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold', status !== 'rejected' && i <= step ? 'bg-ok-50 text-ok-700' : 'bg-mist-100 text-mist-500')}>
              {status !== 'rejected' && i <= step ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />} {s.label}
            </li>
          ))}
          {status === 'rejected' && (
            <li className="flex items-center gap-1 rounded-full bg-bad-50 px-2.5 py-1 text-[12px] font-semibold text-bad-700">
              <XCircle className="h-3.5 w-3.5" /> Declined by bank
            </li>
          )}
        </ol>
        {last && (
          <p className="mt-2 text-[12.5px] text-mist-600">
            Last update {ago(last.at)}{last.note ? `: “${last.note}”` : ''}
          </p>
        )}
        <p className="mt-2 text-[12.5px] text-mist-500">Next step for you: confirm the car with the buyer and send the proforma invoice to {f.lender}.</p>
      </div>
    </div>
  );
}
