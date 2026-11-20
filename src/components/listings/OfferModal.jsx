// Seller: start, change or end a discount or special offer on a listing.
import { useState } from 'react';
import { Gift, Tag } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Alert, Button, Field, Input, Modal, RadioCards, Segmented, Textarea, useToast } from '../ui';
import { offerOf } from '../vehicle/OfferPrice';
import { vehicleTitle } from '../vehicle/VehicleCard';
import { tzs } from '../../utils/format';

const in30 = () => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

export function OfferModal({ vehicle: v, onClose }) {
  const { setOffer, endOffer } = useStore();
  const toast = useToast();
  const current = offerOf(v);
  const base = current?.originalPrice || v.price;
  const [d, setD] = useState({
    kind: current?.kind || 'discount',
    discountType: current?.discountType || 'percent',
    value: current?.value ? String(current.value) : '',
    label: current?.label || '',
    details: current?.details || '',
    endsAt: current?.endsAt ? current.endsAt.slice(0, 10) : in30(),
    noEnd: current ? !current.endsAt : true, // new offers run until the seller ends them; an end date is optional
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const value = Number(d.value) || 0;
  const cut = d.kind === 'discount' ? (d.discountType === 'percent' ? Math.round((base * value) / 100) : Math.round(value)) : 0;
  const newPrice = base - cut;

  const save = async () => {
    setBusy(true);
    try {
      await setOffer(v.id, { kind: d.kind, discountType: d.discountType, value: d.kind === 'discount' ? value : undefined, label: d.label, details: d.details, endsAt: d.noEnd ? undefined : d.endsAt });
      toast(d.kind === 'discount' ? `Discount on. The price is now ${tzs(newPrice)}; buyers who saved it are told.` : 'Special offer added to the listing.');
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    setBusy(true);
    try {
      await endOffer(v.id);
      toast(current?.kind === 'discount' ? `Offer ended. The price is back to ${tzs(base)}.` : 'Offer ended.', { tone: 'info' });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={current ? 'Change the offer' : 'Discount or special offer'}
      description={`${vehicleTitle(v)} · ${tzs(base)}`}
      footer={
        <>
          {current && (
            <Button variant="ghost" className="mr-auto text-bad-600" onClick={stop} disabled={busy}>
              End offer
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {current ? 'Save offer' : 'Start offer'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && <Alert tone="error">{err}</Alert>}
        <RadioCards
          name="offer-kind"
          columns={2}
          value={d.kind}
          onChange={(kind) => setD({ ...d, kind })}
          options={[
            { value: 'discount', label: 'Price discount', description: 'Lower the price; the old price shows struck through.', icon: Tag },
            { value: 'special', label: 'Special offer', description: 'An extra, e.g. free service or insurance.', icon: Gift },
          ]}
        />
        {d.kind === 'discount' && (
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
            <Segmented value={d.discountType} onChange={(discountType) => setD({ ...d, discountType })} options={[{ value: 'percent', label: '% off' }, { value: 'amount', label: 'TSh off' }]} />
            <Field label={d.discountType === 'percent' ? 'Discount (%)' : 'Discount (TSh)'} htmlFor="of-val">
              <Input id="of-val" type="number" inputMode="numeric" min={1} value={d.value} onChange={(e) => setD({ ...d, value: e.target.value })} placeholder={d.discountType === 'percent' ? '10' : '500000'} />
            </Field>
          </div>
        )}
        {d.kind === 'discount' && cut > 0 && cut < base && (
          <p className="rounded-xl bg-ok-50 px-3.5 py-2.5 text-sm text-ok-700">
            New price <b>{tzs(newPrice)}</b> <s className="text-mist-500">{tzs(base)}</s> · buyers save {tzs(cut)}
          </p>
        )}
        <Field label="Offer name" htmlFor="of-label" optional hint="Shown as the heading, e.g. “Year-end deal”">
          <Input id="of-label" maxLength={40} value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} />
        </Field>
        <Field label={d.kind === 'special' ? 'What buyers get' : 'Extras (optional)'} htmlFor="of-details" required={d.kind === 'special'}>
          <Textarea id="of-details" rows={2} maxLength={200} value={d.details} onChange={(e) => setD({ ...d, details: e.target.value })} placeholder="e.g. Free first service and 1 year comprehensive insurance" />
        </Field>
        <fieldset className="rounded-xl border border-mist-200 p-3.5">
          <legend className="label px-1">How long it runs</legend>
          <div className="space-y-2.5 text-sm">
            <label className="flex items-start gap-2">
              <input type="radio" name="of-length" className="mt-1" checked={d.noEnd} onChange={() => setD({ ...d, noEnd: true })} />
              <span>
                <b>Until I end it</b>
                <span className="block text-[12.5px] text-mist-500">Stays on the listing until you choose “End offer” or change the asking price.</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="of-length" className="mt-1" checked={!d.noEnd} onChange={() => setD({ ...d, noEnd: false })} />
              <span className="min-w-0 flex-1">
                <b>Ends on a date</b>
                <span className="block text-[12.5px] text-mist-500">Ends automatically at the end of that day (Tanzania time){d.kind === 'discount' ? ' and the price goes back to ' + tzs(base) : ''}. We'll notify you when it ends.</span>
                {!d.noEnd && <Input id="of-end" type="date" className="mt-2 max-w-[13rem]" aria-label="Offer ends on" value={d.endsAt} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setD({ ...d, endsAt: e.target.value })} />}
              </span>
            </label>
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
