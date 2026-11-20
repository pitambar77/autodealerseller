import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from '@/lib/router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { MessageSquareText } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Alert, Button, Checkbox, Field, CountrySelect, Input, MockNotice } from '../../components/ui';
import { ROLE_META } from '../../config/site';
import { COUNTRIES, DEFAULT_COUNTRY, formatPhone as formatIntl, isValidPhone, phoneError } from '../../lib/phone';

/** The country picker's options (every country), e.g. { value: 'IN', label: '🇮🇳 +91' }. */
export const COUNTRY_CODES = COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial}` }));

const schema = z
  .object({
    cc: z.string(),
    phone: z.string().trim(),
    consent: z.literal(true, { message: 'You need to agree before we can send a code' }),
  })
  .superRefine((d, ctx) => {
    if (!isValidPhone(d.phone, d.cc)) ctx.addIssue({ code: 'custom', path: ['phone'], message: phoneError(d.cc) });
  });

export const PENDING_KEY = 'autodealer-pending-otp';
export function savePending(p) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
export function readPending() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
  } catch {
    return null;
  }
}

/** The full international number for a picker country and what was typed: ('IN', '98610 21001') → '+91 98610 21001'. */
export const formatPhone = (country, phone) => formatIntl(phone, country);

export default function PhoneSignIn() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { state, findUserByPhone } = useStore();
  const presetRole = params.get('role');
  const next = params.get('next') || '';
  const [unknown, setUnknown] = useState(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { cc: DEFAULT_COUNTRY, phone: params.get('phone') || '', consent: false } });
  const phone = watch('phone');
  const cc = watch('cc');

  const submit = async (d) => {
    const full = formatPhone(d.cc, d.phone);
    let existing;
    try {
      existing = await findUserByPhone(full);
    } catch (e) {
      setError('phone', { message: e.message });
      return;
    }
    if (!existing) {
      setUnknown(full);
      return;
    }
    if (existing.role === 'admin') {
      nav('/admin/login');
      return;
    }
    const pending = { phone: full, role: existing.role, isNew: false, next, sentAt: Date.now() };
    savePending(pending);
    nav('/verify-otp', { state: pending });
  };

  return (
    <div>
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-2 text-[28px] font-bold leading-tight">Sign in to AutoDealer</h1>
      <p className="mt-1.5 text-mist-600">Enter the mobile number you registered with. We'll send a 6-digit code — no password needed.</p>

      <form onSubmit={handleSubmit(submit)} noValidate className="mt-6 space-y-4">
        <Field label="Mobile number" htmlFor="si-phone" error={errors.phone?.message} required>
          <div className="flex gap-2">
            <CountrySelect value={cc} onChange={(v) => setValue('cc', v, { shouldValidate: !!errors.phone })} className="w-[104px]" />
            <Input id="si-phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder={cc === 'TZ' ? '0712 345 678' : cc === 'IN' ? '98765 43210' : 'Mobile number'} {...register('phone', { onChange: () => setUnknown(null) })} error={errors.phone} className="font-mono text-[15px]" />
          </div>
        </Field>
        <div>
          <Checkbox {...register('consent')} label="I agree to receive a one-time sign-in code by SMS." />
          {errors.consent && <p className="field-error">{errors.consent.message}</p>}
        </div>
        {unknown && (
          <Alert tone="warn" title="No account with this number">
            {unknown} isn't registered yet. Create an account — it takes about two minutes.
            <div className="mt-2.5 flex flex-wrap gap-2">
              {(presetRole ? [presetRole] : ['seller', 'agent', 'dealer', 'buyer']).map((r) => (
                <Button key={r} size="sm" variant={presetRole ? 'primary' : 'secondary'} to={`/register/${r}?cc=${cc}&phone=${encodeURIComponent((phone || '').replace(/[^\d+]/g, ''))}`}>
                  Register as {ROLE_META[r].label.toLowerCase()}
                </Button>
              ))}
            </div>
          </Alert>
        )}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={MessageSquareText}>
          Send sign-in code
        </Button>
        <div className="flex flex-col gap-1.5 border-t border-mist-100 pt-4 text-sm text-mist-600 sm:flex-row sm:justify-between">
          <span>
            New to AutoDealer?{' '}
            <Link to={presetRole ? `/register/${presetRole}` : '/register'} className="font-semibold text-accent-700 hover:underline">
              Create an account
            </Link>
          </span>
          <Link to="/admin/login" className="font-semibold text-mist-600 hover:text-ink-900">
            Staff sign-in
          </Link>
        </div>
        {state.demo?.login && (
          <MockNotice>
            Demo numbers: private seller <span className="font-mono">98610 21002</span>, agent <span className="font-mono">…21003</span>, dealer <span className="font-mono">…21001</span>, buyer <span className="font-mono">…21004</span>.
          </MockNotice>
        )}
      </form>
    </div>
  );
}
