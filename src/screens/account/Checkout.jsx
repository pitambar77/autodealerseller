import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from '@/lib/router';
import { Building, CreditCard, Loader2, Lock, Package, Smartphone, Sparkles, Wallet } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Alert, Button, Checkbox, EmptyState, MockNotice, PageHeader, Plate, RadioCards, Section, StatusBadge, useToast } from '../../components/ui';
import { PaymentSummary } from '../../components/payment/Payment';
import { CarImage } from '../../components/vehicle/CarArt';
import { vehicleTitle } from '../../components/vehicle/VehicleCard';
import { requiredDocsFor } from '../../components/vehicle/VehicleFormWizard';
import { ALL_PLANS, BOOST_PLAN, PLANS, ROLE_META } from '../../config/site';
import { isFeatured } from '../../utils/featured';
import { date } from '../../utils/format';
import { packSummary } from '../../utils/packs';
import { cn, tzs, sleep } from '../../utils/format';
import { vehiclePath } from '../../data/vehicleTypes';

const METHODS = [
  { value: 'Mobile money', label: 'Mobile money', description: 'M-Pesa, Mixx by Yas, Airtel Money, HaloPesa', icon: Smartphone },
  { value: 'Card', label: 'Debit / credit card', description: 'Visa, Mastercard', icon: CreditCard },
  { value: 'Bank transfer', label: 'Bank transfer', description: 'CRDB, NMB, NBC and other banks', icon: Building },
];
const OUTCOMES = [
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'pending', label: 'Pending' },
];

export default function Checkout() {
  const { listingId } = useParams();
  const { state, me, role, vehicle, pay, spendCredit } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const v = vehicle(listingId);
  // A live, paid listing can only be featured; ?boost=1 asks for that explicitly.
  const boost = !!v && v.status === 'live' && (v.paymentStatus === 'paid' || params.get('boost') === '1');
  const plans = boost ? [BOOST_PLAN] : PLANS.filter((p) => p.role === role);
  const [planId, setPlanId] = useState(boost ? BOOST_PLAN.id : plans.find((p) => p.id === v?.planId)?.id || plans[0]?.id);
  const [method, setMethod] = useState('Mobile money');
  const [terms, setTerms] = useState(false);
  const [termsErr, setTermsErr] = useState(false);
  const [outcome, setOutcome] = useState('success');
  const [processing, setProcessing] = useState(false);
  const [payInstead, setPayInstead] = useState(false);
  const home = ROLE_META[role].home;
  const toast = useToast();
  // The API's simulated gateway (PAYMENT_PROVIDER=mock) lets you pick the result.
  const mock = !!state.demo?.mockPayments;

  if (!v || v.sellerId !== me.id) {
    return <EmptyState title="We couldn't find that listing" message="It may have been deleted, or it belongs to another account." action={<Button to={home}>Back to dashboard</Button>} />;
  }
  if (boost && planId !== BOOST_PLAN.id) setPlanId(BOOST_PLAN.id);
  const days = state.config.featuredDays || 7;
  if (v.status === 'blocked_duplicate') {
    return <EmptyState title="Payment isn't available for a blocked listing" message="This car matches another active listing. Fix the registration number or VIN first, so you aren't charged for a listing that can't go live." action={<Button to={`${home}/listings`}>See why it's blocked</Button>} />;
  }
  const missingDocs = requiredDocsFor(role, state.config).filter(([type]) => !state.documents.some((d) => d.userId === me.id && d.type === type && d.status !== 'rejected'));
  const pendingTxn = state.payments.find((p) => p.listingId === v.id && p.status === 'pending');
  // Credits from a pack already paid for (Dealer Pro Pack): publish or feature without paying again.
  const pack = packSummary(me);
  const credits = boost ? pack.featured : pack.listings;
  const showCredit = credits > 0 && !payInstead;

  const publishWithCredit = async () => {
    setProcessing(true);
    let txn;
    try {
      txn = await spendCredit(v.id, boost ? 'feature' : 'listing');
    } catch (e) {
      toast(e.message, { tone: 'error', title: boost ? "The listing wasn't featured" : "The listing wasn't published" });
      return;
    } finally {
      setProcessing(false);
    }
    nav(`/payments/result/${txn.id}`, { replace: true });
  };

  const submit = async () => {
    if (!terms) {
      setTermsErr(true);
      return;
    }
    setProcessing(true);
    let txn;
    try {
      txn = await pay({ listingId: v.id, planId, method, outcome: mock ? outcome : undefined });
    } catch (e) {
      toast(e.message, { tone: 'error', title: "Payment couldn't start" });
      return;
    } finally {
      setProcessing(false);
    }
    nav(`/payments/result/${txn.id}`, { replace: true });
  };

  const plan = ALL_PLANS.find((p) => p.id === planId) || plans[0];

  return (
    <div>
      {boost ? (
        <PageHeader eyebrow="Checkout" title="Feature this listing" description={`Featured listings show a "Featured" badge, come first in search and appear in the home page's featured spots for ${days} days.`} />
      ) : (
        <PageHeader eyebrow="Checkout" title={showCredit ? 'Publish your listing' : 'Pay the listing fee'} description={showCredit ? 'Your listing goes live as soon as you publish it with a credit.' : 'Your listing goes live automatically as soon as this payment succeeds.'} />
      )}
      {boost && isFeatured(v) && (
        <Alert tone="info" icon={Sparkles} className="mb-6" title={`Already featured${v.featuredUntil ? ` until ${date(v.featuredUntil)}` : ''}`}>
          Paying again adds another {days} days.
        </Alert>
      )}
      {!boost && missingDocs.length > 0 && (
        <Alert tone="warn" className="mb-6" title="Upload required documents first">
          {missingDocs.map((d) => d[1]).join(' and ')} must be uploaded before you pay.{' '}
          <Link to={missingDocs[0][2]} className="font-semibold underline">
            Upload now
          </Link>
        </Alert>
      )}
      {pendingTxn && (
        <Alert tone="warn" className="mb-6" title="A payment for this listing is still pending">
          Paying again could charge you twice.{' '}
          <Link to={`/payments/result/${pendingTxn.id}`} className="font-semibold underline">
            Check {pendingTxn.id}
          </Link>
        </Alert>
      )}
      {v.paymentStatus === 'failed' || v.paymentStatus === 'cancelled' ? (
        <Alert tone="info" className="mb-6" title={`Your last payment ${v.paymentStatus === 'failed' ? 'failed' : 'was cancelled'}`}>
          No listing fee was charged. You can try again below.
        </Alert>
      ) : null}

      {credits > 0 && (
        <section className={cn('card mb-6 overflow-hidden', showCredit && 'border-ok-300 ring-1 ring-ok-200')} aria-labelledby="pack-credit">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ok-50 text-ok-700">
              <Package className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="pack-credit" className="font-bold text-ink-900">
                {boost ? `You have ${credits} featured slot${credits === 1 ? '' : 's'} left` : `You have ${credits} listing credit${credits === 1 ? '' : 's'} left`}
              </h2>
              <p className="text-[13.5px] text-mist-600">
                {boost ? `Feature this listing for ${days} days with a slot from your ${pack.name}. Nothing to pay.` : `Your ${pack.name} is already paid for, so this listing goes live with a credit. Nothing to pay.`}
                {pack.expiresAt && <> Use {credits === 1 ? 'it' : 'them'} by {date(pack.expiresAt)}.</>}
              </p>
            </div>
            {showCredit ? (
              <Button size="lg" icon={boost ? Sparkles : Package} onClick={publishWithCredit} disabled={(!boost && missingDocs.length > 0) || processing} className="shrink-0">
                {boost ? 'Feature with a slot' : 'Publish with a credit'}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setPayInstead(false)} className="shrink-0">
                Use a credit instead
              </Button>
            )}
          </div>
          {showCredit && (
            <p className="border-t border-mist-100 bg-mist-50 px-5 py-2.5 text-[13px] text-mist-600">
              Want a different plan for this listing?{' '}
              <button type="button" className="font-semibold text-accent-700 hover:underline" onClick={() => setPayInstead(true)}>
                Pay for it instead
              </button>
            </p>
          )}
        </section>
      )}

      {!showCredit && (
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title={boost ? '1. Featured boost' : '1. Choose a plan'} description={boost ? undefined : 'Plans marked "Featured" also put your listing first in search for the first 7 days.'}>
            <RadioCards name="plan" value={planId} onChange={setPlanId} columns={2} options={plans.map((p) => ({ value: p.id, label: `${p.name} · ${tzs(p.price)}`, description: (p.kind === 'boost' ? [`${days} days`, ...p.features] : p.features).slice(0, 2).join(' · ') }))} />
          </Section>
          <Section title="2. Payment method">
            <RadioCards name="method" value={method} onChange={setMethod} columns={2} options={METHODS} />
            <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-mist-500">
              <Lock className="h-3.5 w-3.5" /> You'll complete payment on the {state.config.paymentGateway.provider} secure page. AutoDealer never sees your card details or mobile money PIN.
            </p>
          </Section>
          {mock && (
          <Section title="Simulate the gateway response" description="Test mode — choose what the payment gateway returns.">
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                <button key={o.value} type="button" onClick={() => setOutcome(o.value)} className={cn('rounded-lg border px-3 py-1.5 text-[13px] font-semibold', outcome === o.value ? 'border-ink-900 bg-ink-900 text-white' : 'border-mist-200 text-mist-700 hover:border-mist-300')} aria-pressed={outcome === o.value}>
                  {o.label}
                </button>
              ))}
            </div>
            <MockNotice className="mt-3">No money moves. Only "Success" publishes the listing; the other outcomes leave it unpublished.</MockNotice>
          </Section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card overflow-hidden">
            <CarImage vehicle={v} view="side" className="aspect-[16/8] w-full" />
            <div className="space-y-4 p-5">
              <div>
                <p className="font-bold text-ink-900">{vehicleTitle(v)}</p>
                <p className="text-[13px] text-mist-500">
                  {v.variant} · {tzs(v.price)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Plate value={v.regNumber} size="sm" />
                  <StatusBadge status={v.status} />
                </div>
              </div>
              <PaymentSummary planId={planId} vehicleTitle={vehicleTitle(v)} featuredDays={days} className="border-t border-mist-100 pt-4" />
              <div>
                <Checkbox
                  checked={terms}
                  onChange={(e) => {
                    setTerms(e.target.checked);
                    setTermsErr(false);
                  }}
                  label={boost ? <>I accept the listing terms. The featured fee is non-refundable once the boost starts.</> : <>I accept the listing terms. The fee is non-refundable once the listing is live.</>}
                />
                {termsErr && <p className="field-error">Accept the listing terms to continue.</p>}
              </div>
              <Button size="lg" className="w-full" icon={Lock} onClick={submit} disabled={(!boost && missingDocs.length > 0) || processing}>
                Pay {tzs(plan.price * 1.18)}
              </Button>
            </div>
          </div>
          <p className="text-center text-[12px] text-mist-500">A VAT invoice is emailed after payment.</p>
        </aside>
      </div>
      )}

      {processing && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink-950/60 backdrop-blur-sm" role="alertdialog" aria-label="Processing payment">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-pop">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent-600" />
            <p className="mt-4 text-lg font-bold">{showCredit ? (boost ? 'Featuring your listing…' : 'Publishing your listing…') : 'Processing payment…'}</p>
            <p className="mt-1 text-sm text-mist-600">{showCredit ? 'Using a credit from your pack.' : `Don't close this window. Waiting for ${state.config.paymentGateway.provider} (simulated).`}</p>
          </div>
        </div>
      )}
    </div>
  );
}
