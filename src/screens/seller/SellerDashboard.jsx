import { useState } from 'react';
import { Link } from '@/lib/router';
import { Car, CheckCheck, Eye, Inbox, MessageSquareText, Pencil, Plus, Radio, ShieldCheck, Sparkles } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Alert, Avatar, Badge, Button, ConfirmDialog, EmptyState, KpiCard, PageHeader, Section, StatusBadge, VerificationBadge, useToast } from '../../components/ui';
import { CarImage } from '../../components/vehicle/CarArt';
import { vehicleTitle } from '../../components/vehicle/VehicleCard';
import { AttentionList, useSellerStats } from '../dealer/DealerDashboard';
import { ago, num } from '../../utils/format';
import { vehiclePath } from '../../data/vehicleTypes';
import { isFeatured } from '../../utils/featured';
import { unreadFor } from '../../utils/messages';
import { OfferPriceInline } from '../../components/vehicle/OfferPrice';

export default function SellerDashboard() {
  const { state, me, setListingStatus } = useStore();
  const toast = useToast();
  const [sold, setSold] = useState(null);
  const s = useSellerStats();
  const idDoc = state.documents.find((d) => d.userId === me.id && d.type === 'personal_id');
  const shown = [...s.mine].filter((v) => !['removed'].includes(v.status)).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 6);
  const unread = s.enq.reduce((n, e) => n + unreadFor(e, 'seller'), 0);
  const blocked = s.mine.filter((v) => v.status === 'blocked_duplicate');

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi ${me.name.split(' ')[0]}`}
        description="List as many vehicles as you want to sell. Each listing has its own fee."
        actions={
          <>
            <Button variant="secondary" to="/seller/enquiries" icon={Inbox}>
              Enquiries{unread ? ` (${unread} unread)` : ''}
            </Button>
            <Button to="/seller/vehicles/new" icon={Plus}>
              List a vehicle
            </Button>
          </>
        }
      />

      {!s.mine.length ? (
        <EmptyState
          icon={Plus}
          title="You haven't listed a vehicle yet"
          message="Add your vehicle's details, pay the listing fee and it goes live straight away. Selling more than one? Add them all."
          action={<Button to="/seller/vehicles/new" icon={Plus}>List a vehicle</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Live listings" value={s.live.length} icon={Radio} tone="green" sub={`${s.mine.length} in total`} />
            <KpiCard label="Views" value={num(s.live.reduce((n, v) => n + (v.views || 0), 0))} icon={Eye} sub="on live listings" />
            <KpiCard label="Enquiries" value={s.enq.length} icon={Inbox} sub={`${s.newEnq} new`} />
            <KpiCard label="Unread messages" value={unread} icon={MessageSquareText} tone={unread ? 'amber' : undefined} sub="from buyers" />
          </div>

          <Section
            title="Your vehicles"
            description={s.mine.length > shown.length ? `Your ${shown.length} most recent. See all ${s.mine.length} in My listings.` : undefined}
            actions={
              <Button size="sm" variant="secondary" to="/seller/listings">
                All listings
              </Button>
            }
            bodyClass="p-0"
          >
            <ul className="divide-y divide-mist-100">
              {shown.map((v) => (
                <li key={v.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CarImage vehicle={v} view="side" className="h-14 w-24 shrink-0 rounded-md" />
                    <div className="min-w-0">
                      <Link to={vehiclePath(v)} className="block truncate font-semibold text-ink-900 hover:text-accent-700">
                        {vehicleTitle(v)}
                      </Link>
                      <p className="text-[13px] text-mist-500 num">
                        <OfferPriceInline v={v} /> · {num(v.views || 0)} views · {s.enq.filter((e) => e.vehicleId === v.id).length} enquiries
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <StatusBadge status={v.status} />
                        {v.status === 'live' && <VerificationBadge status={v.verification} size="sm" />}
                        {isFeatured(v) && (
                          <Badge tone="amber" icon={Sparkles}>
                            Featured
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {['draft', 'pending_payment'].includes(v.status) ? (
                      <Button size="sm" to={`/checkout/${v.id}`}>
                        Pay & publish
                      </Button>
                    ) : v.status === 'live' && !isFeatured(v) ? (
                      <Button size="sm" variant="secondary" icon={Sparkles} to={`/checkout/${v.id}?boost=1`}>
                        Feature
                      </Button>
                    ) : null}
                    {!['sold', 'expired'].includes(v.status) && (
                      <Button size="sm" variant="secondary" icon={Pencil} to={`/seller/vehicles/${v.id}/edit`}>
                        Edit
                      </Button>
                    )}
                    {v.status === 'live' && (
                      <Button size="sm" variant="ghost" icon={CheckCheck} onClick={() => setSold(v)}>
                        Sold
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      {blocked.length > 0 && (
        <Alert tone="error" title={`${blocked.length} listing${blocked.length > 1 ? 's were' : ' was'} blocked as a duplicate`} action={<Button size="sm" variant="secondary" to="/seller/listing-status">See why</Button>}>
          Another active listing uses the same registration number or VIN.
        </Alert>
      )}

      <AttentionList items={s.attention} base="/seller" />

      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Section
          title="Latest enquiries"
          actions={
            <Button size="sm" variant="secondary" to="/seller/enquiries">
              Open inbox
            </Button>
          }
          bodyClass="p-0"
        >
          {s.enq.length ? (
            <ul className="divide-y divide-mist-100">
              {[...s.enq]
                .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))
                .slice(0, 5)
                .map((e) => {
                  const v = state.vehicles.find((x) => x.id === e.vehicleId);
                  const last = e.messages?.[e.messages.length - 1];
                  const n = unreadFor(e, 'seller');
                  return (
                    <li key={e.id}>
                      <Link to={`/seller/enquiries?c=${e.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-mist-50">
                        <Avatar name={e.buyerName} size={34} tone="mist" />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center justify-between gap-2 text-sm">
                            <span className={n ? 'font-bold' : 'font-semibold'}>{e.buyerName}</span>
                            <span className="shrink-0 text-[11.5px] text-mist-500">{ago(e.lastMessageAt || e.createdAt)}</span>
                          </p>
                          <p className="truncate text-[12.5px] text-mist-500">{v ? vehicleTitle(v) : e.vehicleId}</p>
                          <p className="truncate text-[13px] text-mist-600">{(last?.from === 'seller' ? 'You: ' : '') + (last?.text || e.message)}</p>
                        </div>
                        {n > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[11px] font-bold text-white">{n}</span>}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <div className="p-4">
              <EmptyState icon={Inbox} title="No enquiries yet" message="When buyers message you about your vehicles, they appear here and you can reply straight away." />
            </div>
          )}
        </Section>
        <div className="space-y-6">
          <Section title="Identity verification">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-mist-400" /> Your ID
              </span>
              <StatusBadge status={idDoc?.status || 'not_submitted'} />
            </div>
            <p className="mt-2 text-[13px] text-mist-600">One ID covers all your listings. Verified listings get the "Documents verified" badge.</p>
            <Button size="sm" variant="secondary" className="mt-3" to="/seller/identity">
              {idDoc ? 'Manage ID documents' : 'Upload ID'}
            </Button>
          </Section>
          {s.mine.length > 0 && (
            <Section title="Selling a business's stock?">
              <p className="text-[13px] text-mist-600">
                <Car className="mr-1 inline h-4 w-4 text-mist-400" /> If you sell vehicles as a business, a dealer account adds a dealer profile, bulk listing packs and a dealer badge.
              </p>
            </Section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!sold}
        onClose={() => setSold(null)}
        title="Mark as sold?"
        message={sold ? `${vehicleTitle(sold)} will leave search results. Its enquiries stay in your inbox.` : ''}
        confirmLabel="Mark as sold"
        onConfirm={() => {
          setListingStatus(sold.id, 'sold');
          toast('Marked as sold. Congratulations!');
        }}
      />
    </div>
  );
}
