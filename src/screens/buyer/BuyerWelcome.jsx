import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from '@/lib/router';
import { ArrowRight, Check, Heart, MessageSquareText, Search } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Alert, Button, Checkbox, Field, Input, MockNotice, OtpInput, PhoneInput, Select, useToast } from '../../components/ui';
import { BODY_TYPES, CITIES } from '../../data/catalog';
import { OtpNotice, useOtp } from '../auth/OtpVerify';
import { cn, maskPhone } from '../../utils/format';
import { formatPhone, isValidPhone } from '../../lib/phone';

const BUDGETS = [
  { value: '0-15000000', label: 'Under TSh 15M' },
  { value: '15000000-40000000', label: 'TSh 15M – 40M' },
  { value: '40000000-75000000', label: 'TSh 40M – 75M' },
  { value: '75000000-9999999999', label: 'Above TSh 75M' },
];

export default function BuyerWelcome() {
  const [params] = useSearchParams();
  const next = params.get('next');
  const nav = useNavigate();
  const toast = useToast();
  const { state, findUserByPhone, setBuyerPrefs } = useStore();
  const [stage, setStage] = useState('phone');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState({ budget: '', city: '', ...state.buyerPrefs, bodies: state.buyerPrefs?.bodies || [] });
  // Once signed in, start from the preferences saved on the account.
  useEffect(() => {
    if (stage === 'prefs') setPrefs((p) => ({ ...p, ...state.buyerPrefs, bodies: state.buyerPrefs?.bodies || p.bodies }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  const otp = useOtp();
  const full = formatPhone(phone);

  const sendCode = async (e) => {
    e.preventDefault();
    const er = {};
    if (!isValidPhone(phone)) er.phone = 'Enter a valid mobile number';
    if (!consent) er.consent = 'Agree to receive a one-time code to continue';
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const u = await findUserByPhone(full);
      if (!u) return setErr({ unregistered: true });
      if (u.role !== 'buyer') return setErr({ phone: `This number belongs to a ${u.role} account. Buyers need a separate number, or browse as a guest.` });
      if (await otp.request(full)) setStage('otp');
      else setErr({ phone: otp.error || 'Could not send a code. Try again.' });
    } catch (ex) {
      setErr({ phone: ex.message });
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await otp.verify(full);
    setBusy(false);
    if (!r) return;
    if (r.suspended) return setErr({ otp: 'This account is suspended. Contact support.' });
    if (!r.registered) return setErr({ otp: 'No buyer account with this number.' });
    setStage('prefs');
  };

  const finish = () => {
    setBuyerPrefs(prefs).catch(() => {});
    toast('You can now save cars and searches across visits.', { title: 'Signed in' });
    nav(next ? decodeURIComponent(next) : '/buyer', { replace: true });
  };

  return (
    <div>
      <ol className="mb-6 flex items-center gap-2 text-[12.5px] font-semibold text-mist-500">
        {['Phone', 'Code', 'Preferences'].map((s, i) => {
          const idx = ['phone', 'otp', 'prefs'].indexOf(stage);
          return (
            <li key={s} className="flex items-center gap-2">
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[11px]', i < idx ? 'bg-ink-900 text-white' : i === idx ? 'bg-accent-600 text-white' : 'bg-mist-200')}>{i < idx ? <Check className="h-3 w-3" /> : i + 1}</span>
              <span className={i === idx ? 'text-ink-900' : ''}>{s}</span>
              {i < 2 && <span className="h-px w-6 bg-mist-300" />}
            </li>
          );
        })}
      </ol>

      {stage === 'phone' && (
        <form onSubmit={sendCode} noValidate>
          <p className="eyebrow">For buyers</p>
          <h1 className="mt-2 text-[28px] font-bold leading-tight">Save cars, searches and enquiries</h1>
          <p className="mt-1.5 text-mist-600">Signing in is optional. You can browse, compare and contact sellers as a guest.</p>
          <ul className="mt-5 space-y-2 text-sm text-mist-700">
            {[
              [Heart, 'Keep a shortlist across devices'],
              [Search, 'Get alerts for saved searches'],
              [MessageSquareText, 'Track every enquiry you send'],
            ].map(([I, t]) => (
              <li key={t} className="flex items-center gap-2.5">
                <I className="h-4 w-4 text-accent-600" /> {t}
              </li>
            ))}
          </ul>
          <Field label="Mobile number" htmlFor="bw-phone" error={err.phone} className="mt-6" required>
            <PhoneInput id="bw-phone" value={phone} onChange={setPhone} error={err.phone} />
          </Field>
          <div className="mt-4">
            <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label="I agree to the Terms and Privacy Policy and to receive a one-time code by SMS." />
            {err.consent && <p className="field-error">{err.consent}</p>}
          </div>
          {err.unregistered && (
            <Alert tone="warn" className="mt-4" title="No buyer account with this number">
              Create one in under a minute, or keep browsing as a guest.
              <div className="mt-2">
                <Button size="sm" to={`/register/buyer?phone=${phone.replace(/\D/g, '')}`}>Create buyer account</Button>
              </div>
            </Alert>
          )}
          <Button type="submit" size="lg" className="mt-5 w-full" loading={busy}>
            Send code
          </Button>
          <Button variant="ghost" size="lg" className="mt-2 w-full" to="/cars" iconRight={ArrowRight}>
            Continue as guest
          </Button>
          {state.demo?.login && <MockNotice className="mt-4">Demo buyer: <span className="font-mono">98610 21004</span>.</MockNotice>}
        </form>
      )}

      {stage === 'otp' && (
        <form onSubmit={verify} noValidate>
          <h1 className="text-[28px] font-bold leading-tight">Enter the 6-digit code</h1>
          <p className="mt-1.5 text-mist-600">
            Sent to <span className="font-mono font-semibold text-ink-900">{maskPhone(full)}</span> ·{' '}
            <button type="button" onClick={() => setStage('phone')} className="font-semibold text-accent-700 hover:underline">
              Edit number
            </button>
          </p>
          <div className="mt-6">
            <OtpInput value={otp.code} onChange={otp.setCode} error={!!(otp.error || err.otp)} />
            {(otp.error || err.otp) && <p className="field-error mt-2">{otp.error || err.otp}</p>}
          </div>
          <p className="mt-3 text-sm text-mist-600 num">
            {otp.left > 0 ? `Resend in 0:${String(otp.left).padStart(2, '0')}` : (
              <button type="button" onClick={() => otp.request(full)} className="font-semibold text-accent-700 hover:underline">
                Resend code
              </button>
            )}
          </p>
          <Button type="submit" size="lg" className="mt-5 w-full" loading={busy}>
            Verify
          </Button>
          <OtpNotice devCode={otp.devCode} className="mt-4" />
        </form>
      )}

      {stage === 'prefs' && (
        <div>
          <h1 className="text-[28px] font-bold leading-tight">What are you looking for?</h1>
          <p className="mt-1.5 text-mist-600">We'll use this to recommend cars. Change it any time.</p>
          <div className="mt-6 space-y-5">
            <Field label="Budget" htmlFor="bw-budget">
              <Select id="bw-budget" value={prefs.budget} onChange={(e) => setPrefs({ ...prefs, budget: e.target.value })} options={BUDGETS} />
            </Field>
            <fieldset>
              <legend className="label">Body types</legend>
              <div className="flex flex-wrap gap-2">
                {BODY_TYPES.map((b) => {
                  const on = prefs.bodies.includes(b);
                  return (
                    <button key={b} type="button" aria-pressed={on} onClick={() => setPrefs({ ...prefs, bodies: on ? prefs.bodies.filter((x) => x !== b) : [...prefs.bodies, b] })} className={cn('rounded-full border px-3.5 py-1.5 text-sm font-semibold', on ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-mist-200 text-mist-700 hover:border-mist-300')}>
                      {b}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Field label="City" htmlFor="bw-city">
              <Select id="bw-city" value={prefs.city} onChange={(e) => setPrefs({ ...prefs, city: e.target.value })} options={CITIES.map((c) => c.name)} />
            </Field>
          </div>
          <Button size="lg" className="mt-6 w-full" onClick={finish}>
            Go to my dashboard
          </Button>
          <button type="button" onClick={finish} className="mt-3 w-full text-center text-sm font-semibold text-mist-600 hover:text-ink-900">
            Skip for now
          </button>
        </div>
      )}
      <p className="mt-8 text-center text-sm text-mist-600">
        Selling a car? <Link to="/register" className="font-semibold text-accent-700 hover:underline">Create a seller account</Link>
      </p>
    </div>
  );
}
