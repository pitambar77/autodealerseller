// Admin → Configuration → Loan providers: add, edit, switch off and remove the banks and lenders
// buyers can send finance enquiries to from the loan calculator.
import { useEffect, useState } from 'react';
import { Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Badge, Button, ConfirmDialog, Field, Input, Modal, PhoneInput, Section, Textarea, Toggle, useToast } from '../../components/ui';
import { formatPhone, isValidPhone } from '../../lib/phone';
import { api } from '../../lib/api';
import { DEFAULT_BANK, bankInfo } from '../../data/partnerBanks';

const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);

const BLANK = {
  name: '',
  short: '',
  tagline: '',
  rate: '',
  commissionPct: '0.5',
  processingFee: '',
  maxFundingPct: '80',
  maxMonths: '72',
  decision: '',
  deskName: 'Car loans desk',
  deskPhone: '',
  deskEmail: '',
  eligibility: DEFAULT_BANK.eligibility.join('\n'),
  documents: 'NIDA ID and TIN certificate\nLast 3 months’ payslips or 2 years’ tax returns\nLast 6 months’ bank statement\nProforma invoice or registration card copy (from the dealer)',
  apiKey: '',
  loginPhone: '',
  enabled: true,
};

/** Form values for an existing provider (the details buyers see, with built-in defaults filled in). */
function toDraft(p) {
  const b = bankInfo(p);
  return {
    ...BLANK,
    name: p.name,
    short: p.short || '',
    tagline: b.tagline || '',
    rate: String(b.rate ?? ''),
    commissionPct: String(p.commissionPct ?? ''),
    processingFee: b.processingFee || '',
    maxFundingPct: String(b.maxFundingPct ?? ''),
    maxMonths: String(b.maxMonths ?? ''),
    decision: b.decision || '',
    deskName: b.desk?.name || '',
    deskPhone: b.desk?.phone || '',
    deskEmail: b.desk?.email || '',
    eligibility: (b.eligibility || []).join('\n'),
    documents: (b.documents || []).join('\n'),
    apiKey: p.apiKey || '',
    loginPhone: p.loginPhone || '',
    enabled: p.enabled !== false,
  };
}

const toPayload = (d) => ({
  name: d.name.trim(),
  short: d.short.trim(),
  tagline: d.tagline.trim(),
  rate: Number(d.rate),
  commissionPct: Number(d.commissionPct),
  processingFee: d.processingFee.trim(),
  maxFundingPct: Number(d.maxFundingPct) || undefined,
  maxMonths: Number(d.maxMonths) || undefined,
  decision: d.decision.trim(),
  desk: { name: d.deskName.trim(), phone: d.deskPhone ? formatPhone(d.deskPhone) : '', email: d.deskEmail.trim() },
  eligibility: lines(d.eligibility),
  documents: lines(d.documents),
  apiKey: d.apiKey.trim(),
  loginPhone: d.loginPhone ? formatPhone(d.loginPhone) : '',
  enabled: d.enabled,
});

function ProviderEditor({ provider, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !provider;
  const [d, setD] = useState(() => (provider ? toDraft(provider) : { ...BLANK }));
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const bind = (k) => ({ value: d[k], onChange: (e) => setD((x) => ({ ...x, [k]: e.target.value })), error: errs[k] });

  const save = async () => {
    const e = {};
    if (d.name.trim().length < 2) e.name = 'Enter the lender name';
    if (d.rate === '' || !(Number(d.rate) >= 0 && Number(d.rate) <= 60)) e.rate = 'Enter the rate, e.g. 16.5';
    if (d.deskPhone && !isValidPhone(d.deskPhone)) e.deskPhone = 'Enter a valid phone number';
    if (d.loginPhone && !isValidPhone(d.loginPhone)) e.loginPhone = 'Enter a valid mobile number';
    if (d.commissionPct === '' || !(Number(d.commissionPct) >= 0 && Number(d.commissionPct) <= 10)) e.commissionPct = '0 to 10%';
    setErrs(e);
    if (Object.keys(e).length) return toast('Some fields need attention.', { tone: 'error' });
    setBusy(true);
    try {
      const r = isNew ? await api('POST', '/admin/loan-providers', toPayload(d)) : await api('PATCH', `/admin/loan-providers/${provider.id}`, toPayload(d));
      onSaved(r);
      toast(isNew ? `${d.name} added. Buyers can now choose it on the loan calculator.` : `${d.name} saved.`);
      onClose();
    } catch (err) {
      const f = err.details?.fields || {};
      setErrs(Object.fromEntries(Object.entries(f).map(([k, v]) => [k.split('.')[0] === 'desk' ? `desk${k.split('.')[1]?.replace(/^./, (c) => c.toUpperCase())}` : k.split('.')[0], v])));
      toast(err.message, { tone: 'error', title: "Couldn't save" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      side
      onClose={onClose}
      title={isNew ? 'Add a loan provider' : `Edit ${provider.name}`}
      description="Buyers see these details on the loan calculator when they choose a lender."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {isNew ? 'Add provider' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <fieldset className="space-y-4">
          <legend className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-mist-500">Lender</legend>
          <Field label="Name" required htmlFor="lpv-name" error={errs.name}>
            <Input id="lpv-name" {...bind('name')} placeholder="CRDB Bank Car Loans" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Short name" optional htmlFor="lpv-short" hint="Used where space is tight">
              <Input id="lpv-short" {...bind('short')} placeholder="CRDB" />
            </Field>
            <Toggle id="lpv-on" label="Shown to buyers" description="Off hides it from the loan calculator" checked={d.enabled} onChange={(v) => setD((x) => ({ ...x, enabled: v }))} />
          </div>
          <Field label="Short description" optional htmlFor="lpv-tag">
            <Input id="lpv-tag" {...bind('tagline')} placeholder="Car loans for salaried and self-employed buyers" maxLength={200} />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-mist-500">Loan terms</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Interest rate" required htmlFor="lpv-rate" error={errs.rate} hint="Indicative rate shown to buyers">
              <Input id="lpv-rate" type="number" step="0.05" min="0" suffix="% p.a." {...bind('rate')} />
            </Field>
            <Field label="Your commission" required htmlFor="lpv-com" error={errs.commissionPct} hint="% of the disbursed loan (not shown to buyers)">
              <Input id="lpv-com" type="number" step="0.05" min="0" max="10" suffix="%" {...bind('commissionPct')} />
            </Field>
            <Field label="Maximum funding" optional htmlFor="lpv-fund" hint="Share of the vehicle price">
              <Input id="lpv-fund" type="number" min="10" max="100" suffix="%" {...bind('maxFundingPct')} />
            </Field>
            <Field label="Longest term" optional htmlFor="lpv-months">
              <Input id="lpv-months" type="number" min="6" max="180" suffix="months" {...bind('maxMonths')} />
            </Field>
          </div>
          <Field label="Processing fee" optional htmlFor="lpv-fee">
            <Input id="lpv-fee" {...bind('processingFee')} placeholder="1% of the loan (min TSh 100,000)" />
          </Field>
          <Field label="How fast they respond" optional htmlFor="lpv-dec">
            <Input id="lpv-dec" {...bind('decision')} placeholder="Call within 1 working day" />
          </Field>
          <Field label="Who can apply" optional htmlFor="lpv-elig" hint="One per line">
            <Textarea id="lpv-elig" rows={4} {...bind('eligibility')} />
          </Field>
          <Field label="Documents needed" optional htmlFor="lpv-docs" hint="One per line">
            <Textarea id="lpv-docs" rows={4} {...bind('documents')} />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-mist-500">Contact and access</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Desk name" optional htmlFor="lpv-dn">
              <Input id="lpv-dn" {...bind('deskName')} />
            </Field>
            <Field label="Desk phone" optional htmlFor="lpv-dp" error={errs.deskPhone}>
              <PhoneInput id="lpv-dp" value={d.deskPhone} onChange={(v) => setD((x) => ({ ...x, deskPhone: v }))} error={errs.deskPhone} placeholder="22 211 0000" />
            </Field>
            <Field label="Desk email" optional htmlFor="lpv-de" error={errs.deskEmail}>
              <Input id="lpv-de" type="email" {...bind('deskEmail')} />
            </Field>
          </div>
          <Field
            label="Lead desk sign-in mobile"
            optional
            htmlFor="lpv-login"
            error={errs.loginPhone}
            hint="The bank's staff sign in with this number (one-time SMS code) to see and update their leads on the bank lead desk. Leave empty for no sign-in."
          >
            <PhoneInput id="lpv-login" value={d.loginPhone} onChange={(v) => setD((x) => ({ ...x, loginPhone: v }))} error={errs.loginPhone} />
          </Field>
          <Field label="API key" optional htmlFor="lpv-key" hint="Only if the lender gave you one for an integration. Never shown to buyers.">
            <Input id="lpv-key" type="password" autoComplete="off" {...bind('apiKey')} />
          </Field>
        </fieldset>
      </div>
    </Modal>
  );
}

export function LoanProviders() {
  const { setConfig } = useStore();
  const toast = useToast();
  const [providers, setProviders] = useState(null);
  const [editing, setEditing] = useState(null); // provider, or 'new'
  const [removing, setRemoving] = useState(null);

  const apply = (r) => {
    setProviders(r.providers);
    setConfig(r.config);
  };
  useEffect(() => {
    api('GET', '/admin/loan-providers').then(apply).catch((e) => toast(e.message, { tone: 'error' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (p) => {
    try {
      apply(await api('PATCH', `/admin/loan-providers/${p.id}`, { enabled: !p.enabled }));
      toast(p.enabled ? `${p.name} is hidden from buyers.` : `${p.name} is shown to buyers.`, { tone: 'info' });
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Landmark className="h-4 w-4" /> Loan providers
        </span>
      }
      description="Banks and lenders buyers can send a finance enquiry to from the loan calculator. Commission is a % of the disbursed loan."
      actions={
        <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>
          Add loan provider
        </Button>
      }
      bodyClass="p-0"
    >
      {!providers ? (
        <p className="p-5 text-sm text-mist-500">Loading…</p>
      ) : !providers.length ? (
        <p className="p-5 text-sm text-mist-500">No loan providers yet. Add one to offer finance on the loan calculator.</p>
      ) : (
        <ul className="divide-y divide-mist-100">
          {providers.map((p) => {
            const b = bankInfo(p);
            return (
              <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                    {p.name}
                    {p.enabled ? <Badge tone="green">Shown</Badge> : <Badge>Hidden</Badge>}
                  </p>
                  <p className="text-[13px] text-mist-600 num">
                    {b.rate}% p.a. · up to {b.maxFundingPct}% for {b.maxMonths} months · commission {p.commissionPct}%
                  </p>
                  <p className="text-[12.5px] text-mist-500">{p.loginPhone ? `Lead desk sign-in: ${p.loginPhone}` : 'No lead desk sign-in'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle id={`lp-on-${p.id}`} label={p.enabled ? 'On' : 'Off'} checked={p.enabled} onChange={() => toggle(p)} />
                  <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  <button type="button" className="btn-icon text-bad-600" aria-label={`Remove ${p.name}`} title="Remove" onClick={() => setRemoving(p)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <ProviderEditor provider={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={apply} />}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        message="Only lenders that never received a finance enquiry can be removed. To keep the history, switch it off instead."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={async () => {
          try {
            apply(await api('DELETE', `/admin/loan-providers/${removing.id}`));
            toast(`${removing.name} removed.`);
          } catch (e) {
            toast(e.message, { tone: 'error', title: "Couldn't remove" });
          }
        }}
      />
    </Section>
  );
}
