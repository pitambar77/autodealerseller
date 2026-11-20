// /messages/<id>?key=…: a guest buyer's conversation with a seller (the link comes by SMS or email,
// and is remembered on the device that sent the enquiry). Replies arrive live.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from '@/lib/router';
import { ArrowLeft, Loader2, Lock, MessageSquareText, UserPlus } from 'lucide-react';
import { useStore, chatKeys, rememberChatKey } from '../../store/AppStore';
import { Alert, Avatar, Button, EmptyState } from '../../components/ui';
import { CarImage } from '../../components/vehicle/CarArt';
import { vehicleTitle } from '../../components/vehicle/VehicleCard';
import { ChatThread } from '../../components/messages/ChatThread';
import { connectEvents } from '../../lib/realtime';
import { api } from '../../lib/api';
import { tzs } from '../../utils/format';
import { vehiclePath } from '../../data/vehicleTypes';
import { sellerName } from './BuyerMessages';

export default function GuestConversation() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { me, fetchConversation } = useStore();
  const key = params.get('key') || chatKeys()[id]?.key || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchConversation(id, key)
      .then((d) => {
        if (!alive) return;
        setData(d);
        if (key && d.side === 'buyer' && !d.enquiry.buyerId) rememberChatKey(id, key, d.enquiry.vehicleId);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id, key, fetchConversation]);

  // Live replies for this conversation.
  useEffect(() => {
    if (!data || !key) return undefined;
    return connectEvents({
      query: `enquiry=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`,
      onEvent: (name, d) => {
        if (d.enquiry?.id === id) setData((x) => ({ ...x, enquiry: d.enquiry }));
      },
    });
  }, [!!data, id, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(async (text) => {
    const r = await api('POST', `/enquiries/${id}/messages`, { text, key });
    setData((x) => ({ ...x, enquiry: r.enquiry }));
    return r.enquiry;
  }, [id, key]);
  const markRead = useCallback(() => {
    api('POST', `/enquiries/${id}/read`, { key }).then((r) => r?.enquiry && setData((x) => ({ ...x, enquiry: r.enquiry }))).catch(() => {});
  }, [id, key]);

  if (error) {
    return (
      <div className="container-page py-16">
        <EmptyState icon={Lock} title="This conversation link isn't valid" message="Open the link from the SMS or email we sent you, or sign in if you messaged the seller from your account." action={<Button to="/signin">Sign in</Button>} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-mist-400" aria-label="Loading conversation" />
      </div>
    );
  }
  const { enquiry, vehicle: v, seller, side } = data;
  if (side === 'seller' || (enquiry.buyerId && me?.id === enquiry.buyerId)) {
    return (
      <div className="container-page py-16">
        <EmptyState icon={MessageSquareText} title="Open this conversation in your account" action={<Button to={side === 'seller' ? '/' : `/buyer/messages?c=${id}`}>Go to my messages</Button>} />
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl py-6 md:py-8">
      {v && (
        <Link to={vehiclePath(v)} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-mist-600 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Back to the listing
        </Link>
      )}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name={sellerName(seller)} size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{sellerName(seller)}</h1>
            <p className="text-[13px] text-mist-500">Your conversation as {enquiry.buyerName}</p>
          </div>
        </div>
        {v && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-mist-200 p-2">
            <CarImage vehicle={v} view="side" className="h-12 w-20 shrink-0 rounded-md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{vehicleTitle(v)}</p>
              <p className="text-[13px] text-mist-500 num">
                {tzs(v.price)}
                {v.status !== 'live' && ` · ${v.status === 'sold' ? 'Sold' : 'No longer listed'}`}
              </p>
            </div>
          </div>
        )}
        <ChatThread enquiry={enquiry} side="buyer" send={send} markRead={markRead} otherName={sellerName(seller).split(' ')[0]} className="mt-4 h-[min(520px,60vh)]" />
      </div>
      {!me && (
        <Alert tone="info" icon={UserPlus} className="mt-4" title="Keep all your conversations in one place">
          Create a free buyer account to save vehicles, get price-drop alerts and see replies in your Messages. <Link to="/register/buyer" className="font-semibold underline">Create an account</Link>
        </Alert>
      )}
      <p className="mt-3 text-center text-[12px] text-mist-500">Anyone with this link can read this conversation. Don't share it.</p>
    </div>
  );
}
