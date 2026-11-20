import { CheckCircle2, Clock, Ban, XCircle } from 'lucide-react';
import { ALL_PLANS } from '../../config/site';
import { cn, tzs } from '../../utils/format';

export function PaymentSummary({ planId, vehicleTitle, featuredDays = 7, className }) {
  const plan = ALL_PLANS.find((p) => p.id === planId);
  if (!plan) return null;
  const gst = Math.round(plan.price * 0.18);
  return (
    <div className={cn('space-y-3 text-sm', className)}>
      <div className="flex justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">{plan.name}</p>
          <p className="truncate text-[13px] text-mist-500">{vehicleTitle}</p>
          <p className="text-[12.5px] text-mist-500">{plan.kind === 'boost' ? `Featured for ${featuredDays} days from payment` : `Valid ${plan.validityDays} days from publishing${plan.featuredDays ? ` · featured for the first ${plan.featuredDays}` : ''}`}</p>
        </div>
        <p className="shrink-0 font-semibold num">{tzs(plan.price)}</p>
      </div>
      <div className="flex justify-between text-mist-600">
        <span>VAT (18%)</span>
        <span className="num">{tzs(gst)}</span>
      </div>
      <div className="flex justify-between border-t border-mist-200 pt-3 text-base font-bold text-ink-900">
        <span>Total payable</span>
        <span className="num">{tzs(plan.price + gst)}</span>
      </div>
    </div>
  );
}

const STATES = {
  success: { icon: CheckCircle2, cls: 'bg-ok-50 text-ok-600', title: 'Payment successful', body: 'Your listing passed all checks and is now live on the marketplace. Document verification happens next — buyers can already see and contact you.' },
  failed: { icon: XCircle, cls: 'bg-bad-50 text-bad-600', title: 'Payment failed', body: 'Your bank declined the payment. No money was taken. Your listing is saved but not live — try again or use another method.' },
  cancelled: { icon: Ban, cls: 'bg-mist-100 text-mist-600', title: 'Payment cancelled', body: 'You cancelled the payment before it finished. Your listing is saved as unpublished; it goes live only after a successful payment.' },
  pending: { icon: Clock, cls: 'bg-warn-50 text-warn-600', title: 'Payment pending', body: 'We are waiting for confirmation from your bank. This usually takes a few minutes. The listing stays unpublished until the payment is confirmed.' },
};

export function PaymentStatusHero({ status, boost, credit }) {
  let s = boost && status === 'success' ? { ...STATES.success, body: 'Your listing is now featured: it shows the "Featured" badge, comes first in search and can appear in the home page\'s featured spots.' } : STATES[status] || STATES.pending;
  // Published or featured with a credit from a pack already paid for: nothing was charged.
  if (credit && status === 'success') s = { ...s, title: boost ? 'Featured with a pack slot' : 'Published with a pack credit', body: boost ? s.body : 'Your listing is live. Nothing was charged: it used one of the credits from your pack.' };
  return (
    <div className="text-center">
      <span className={cn('mx-auto flex h-16 w-16 items-center justify-center rounded-full', s.cls)}>
        <s.icon className="h-8 w-8" />
      </span>
      <h1 className="mt-4 text-2xl font-bold">{s.title}</h1>
      <p className="mx-auto mt-2 max-w-md text-[14.5px] text-mist-600">{s.body}</p>
    </div>
  );
}
