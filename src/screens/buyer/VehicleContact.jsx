import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from '@/lib/router';
import { ArrowLeft, Handshake, MessageCircle, Phone, Send, ShieldAlert } from 'lucide-react';
import { useStore, isPublic, chatKeys } from '../../store/AppStore';
import { ChatThread } from '../../components/messages/ChatThread';
import { lastAt } from '../../utils/messages';
import { Alert, Avatar, Button, CopyText, EmptyState, Field, Input, PhoneInput, Segmented, Textarea } from '../../components/ui';
import { CarImage } from '../../components/vehicle/CarArt';
import { EnquiryForm } from '../../components/vehicle/EnquiryForm';
import { vehicleTitle } from '../../components/vehicle/VehicleCard';
import { km, tzs } from '../../utils/format';
import { formatPhone, isValidPhone } from '../../lib/phone';
import { vehiclePath } from '../../data/vehicleTypes';

const QUICK = ['Is it still available?', 'What is your best price?', 'Can I see it this weekend?', 'Are service records available?'];

/** Live chat with the seller. Signed-in buyers chat here; guests continue on their private conversation page. */
function Chat({ vehicle, seller }) {
  const { me, role, state, addEnquiry, sendMessage, markConversationRead } = useStore();
  const nav = useNavigate();
  const buyer = role === 'buyer';
  const existing = buyer ? state.enquiries.filter((e) => e.buyerId === me.id && e.vehicleId === vehicle.id).sort((a, b) => new Date(lastAt(b)) - new Date(lastAt(a)))[0] : null;
  const guestChat = !buyer ? Object.entries(chatKeys()).find(([, k]) => k.vehicleId === vehicle.id) : null;
  const [name, setName] = useState(me?.name || '');
  const [phone, setPhone] = useState(me?.phone || '');
  const [text, setText] = useState('');
  const [errs, setErrs] = useState({});
  const [sending, setSending] = useState(false);
  const send = useCallback((t) => sendMessage(existing.id, t), [existing?.id, sendMessage]);
  const markRead = useCallback(() => existing && markConversationRead(existing.id), [existing?.id, markConversationRead]);
  const who = seller?.business || seller?.agency || seller?.name?.split(' ')[0] || 'the seller';

  if (existing) {
    return <ChatThread enquiry={existing} side="buyer" send={send} markRead={markRead} otherName={who} className="h-[480px]" />;
  }

  const start = async (message = text) => {
    const e = {};
    if (name.trim().length < 2) e.name = 'Enter your name';
    if (!isValidPhone(phone)) e.phone = 'Enter a valid mobile number';
    if (!message.trim()) e.text = 'Write a message';
    setErrs(e);
    if (Object.keys(e).length) return;
    setSending(true);
    try {
      const enq = await addEnquiry({ vehicleId: vehicle.id, channel: 'chat', buyerName: name.trim(), buyerPhone: formatPhone(phone), buyerEmail: me?.email || '', message: message.trim() });
      if (!buyer) nav(enq.conversationPath);
    } catch (err) {
      setErrs({ text: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {guestChat && (
        <Alert tone="info" icon={MessageCircle} title={`You already messaged ${who} about this vehicle`} action={<Button size="sm" to={`/messages/${guestChat[0]}?key=${guestChat[1].key}`}>Open conversation</Button>}>
          Carry on where you left off. Replies also come to you by SMS.
        </Alert>
      )}
      <p className="text-sm text-mist-600">
        Start a conversation with {who}. {buyer ? 'Replies appear here and in your Messages.' : "You'll get the seller's reply by SMS with a link back to this chat."}
      </p>
      {!buyer && (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Your name" htmlFor="ch-name" error={errs.name} required>
            <Input id="ch-name" value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="name" />
          </Field>
          <Field label="Mobile number" htmlFor="ch-phone" error={errs.phone} required hint="For the seller's reply by SMS">
            <PhoneInput id="ch-phone" value={phone} onChange={setPhone} error={errs.phone} />
          </Field>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => start(q)} disabled={sending} className="rounded-full border border-mist-200 bg-white px-2.5 py-1 text-[12.5px] font-medium text-ink-700 hover:border-accent-300">
            {q}
          </button>
        ))}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          start();
        }}
      >
        <Textarea rows={3} value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Write your message" aria-label="Message" className="flex-1" error={errs.text} maxLength={2000} />
        <Button type="submit" icon={Send} loading={sending} aria-label="Send message">
          Send
        </Button>
      </form>
      {errs.text && <p className="field-error">{errs.text}</p>}
    </div>
  );
}

export default function VehicleContact() {
  const { id } = useParams();
  const { vehicle, user } = useStore();
  const v = vehicle(id);
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'chat' ? 'chat' : 'enquiry');
  const [reveal, setReveal] = useState(false);
  if (!v || !isPublic(v)) return <div className="container-page py-16"><EmptyState title="This vehicle isn't available" action={<Button to="/cars">Browse vehicles</Button>} /></div>;
  const seller = user(v.sellerId);
  const isAgent = v.sellerRole === 'agent';

  return (
    <div className="container-page py-6 md:py-8">
      <Link to={`${vehiclePath(v)}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-mist-600 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to listing
      </Link>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="card overflow-hidden">
            <CarImage vehicle={v} view="side" className="aspect-[16/9] w-full" />
            <div className="p-4">
              <p className="font-bold">{vehicleTitle(v)}</p>
              <p className="text-[13px] text-mist-500">
                {v.variant} · {km(v.mileage)} · {v.city}
              </p>
              <p className="mt-2 font-display text-xl font-bold num">{tzs(v.price)}</p>
            </div>
          </div>
          <div className="card space-y-4 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={seller?.business || seller?.agency || seller?.name} size={42} />
              <div className="min-w-0">
                <p className="truncate font-bold">{seller?.business || seller?.agency || seller?.name}</p>
                <p className="text-[13px] text-mist-500">{{ dealer: 'Dealer', seller: 'Private owner', agent: 'Agent for the owner' }[v.sellerRole]}</p>
              </div>
            </div>
            {isAgent && (
              <Alert tone="info" icon={Handshake}>
                This car is sold by an agent on the owner's behalf. Contact the agent; they coordinate viewings and the handover.
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="dark" icon={Phone} onClick={() => setReveal(true)}>
                {isAgent ? 'Call agent' : 'Call seller'}
              </Button>
              <Button variant="secondary" icon={MessageCircle} onClick={() => setMode('chat')}>
                Message
              </Button>
            </div>
            {reveal && (
              <div className="flex items-center justify-between rounded-lg bg-mist-50 px-3 py-2.5">
                <a href={`tel:${seller?.phone?.replace(/\s/g, '')}`} className="font-mono font-semibold num">
                  {seller?.phone}
                </a>
                <CopyText text={seller?.phone || ''} />
              </div>
            )}
          </div>
          <Alert tone="warn" icon={ShieldAlert} title="Stay safe">
            Inspect the car and its RC before paying anything. Never share OTPs or pay a "token" to hold a car you haven't seen.
          </Alert>
        </aside>

        <div className="card min-w-0 p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold">Contact the {isAgent ? 'agent' : 'seller'}</h1>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'enquiry', label: 'Send enquiry' },
                { value: 'chat', label: 'Chat' },
              ]}
            />
          </div>
          {mode === 'enquiry' ? <EnquiryForm vehicle={v} /> : <Chat vehicle={v} seller={seller} />}
        </div>
      </div>
    </div>
  );
}
