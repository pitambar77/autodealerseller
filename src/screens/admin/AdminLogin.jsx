import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from '@/lib/router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { takeSignOutReason, useStore } from '../../store/AppStore';
import { AuthQr } from './AdminInvite';
import { Alert, Button, Field, Input, MockNotice, OtpInput } from '../../components/ui';
import { Logo } from '../../components/layout/Brand';
import { StyleToggle } from '../../store/StyleContext';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your work email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export default function AdminLogin() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { state, adminLogin, adminTotpSetup } = useStore();
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  // The API locks an account after repeated failures (Admin → Security sets the limits).
  const [locked, setLocked] = useState(false);
  // Why the last session ended (idle timeout, ended by the MD…), shown once.
  const [notice, setNotice] = useState('');
  useEffect(() => setNotice(takeSignOutReason()), []);
  // Staff without 2-step verification set it up here before getting in.
  const [setup, setSetup] = useState(null);
  // Second step: the 6-digit code from the admin's authenticator app.
  const [creds, setCreds] = useState(null);
  const [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const done = () => nav(params.get('next') ? decodeURIComponent(params.get('next')) : '/admin', { replace: true });
  const fail = (e) => {
    setLocked(e.status === 423 || e.status === 429);
    setError(e.status === 429 ? 'Too many attempts from this network. Try again in 15 minutes.' : e.message);
  };

  const submit = async (d) => {
    setError('');
    try {
      const r = await adminLogin({ email: d.email, password: d.password });
      if (r.needsTotp) {
        setCreds(d);
        setTotp('');
        return;
      }
      if (r.needsTotpSetup) {
        setSetup(r);
        setTotp('');
        return;
      }
      done();
    } catch (e) {
      fail(e);
    }
  };

  const submitTotp = async (e, value = totp) => {
    e?.preventDefault();
    if (value.length < 6) return setError('Enter the 6-digit code from your authenticator app.');
    setError('');
    setBusy(true);
    try {
      if (setup) await adminTotpSetup(setup.setupToken, value);
      else await adminLogin({ email: creds.email, password: creds.password, totp: value });
      done();
    } catch (err) {
      setTotp('');
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 py-10" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-between">
          <Logo dark />
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-300">Admin console</span>
            <StyleToggle onDark />
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-pop md:p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-900 text-white">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">Sign in to administration</h1>
          <p className="mt-1 text-sm text-mist-600">Restricted to AutoDealer staff. Each person signs in with their own account; all actions are logged.</p>
          {notice && !error && (
            <Alert tone="info" title="Signed out" className="mt-5">
              {notice}
            </Alert>
          )}
          {setup ? (
            <form onSubmit={submitTotp} noValidate className="mt-6 space-y-4">
              {error && <Alert tone="error" title="Not verified">{error}</Alert>}
              <div>
                <p className="font-bold text-ink-900">Set up 2-step verification</p>
                <p className="mt-1 text-sm text-mist-600">Required for every admin account. Scan this with Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code it shows.</p>
              </div>
              <div className="flex flex-col items-center gap-4 rounded-xl bg-mist-50 p-4 sm:flex-row">
                <AuthQr url={setup.otpauthUrl} />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-ink-900">Can't scan?</p>
                  <p className="mt-1 text-mist-600">Enter this key manually:</p>
                  <p className="mt-1 select-all break-all font-mono text-[13px] font-semibold text-ink-900">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</p>
                </div>
              </div>
              <OtpInput
                value={totp}
                onChange={(v) => {
                  setTotp(v);
                  setError('');
                  if (v.length === 6) submitTotp(null, v);
                }}
                error={!!error}
              />
              <Button type="submit" size="lg" className="w-full" loading={busy} icon={ShieldCheck}>
                Turn on & sign in
              </Button>
            </form>
          ) : creds ? (
            <form onSubmit={submitTotp} noValidate className="mt-6 space-y-4">
              {error && (
                <Alert tone="error" title={locked ? 'Console locked' : 'Sign-in failed'}>
                  {error}
                </Alert>
              )}
              <div>
                <p className="label">Authenticator code</p>
                <p className="mb-3 text-sm text-mist-600">Open your authenticator app and enter the 6-digit code for AutoDealer Admin.</p>
                <OtpInput
                  value={totp}
                  onChange={(v) => {
                    setTotp(v);
                    setError('');
                    if (v.length === 6) submitTotp(null, v);
                  }}
                  error={!!error}
                  disabled={locked}
                />
              </div>
              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={locked} icon={ShieldCheck}>
                Verify & sign in
              </Button>
              <button type="button" onClick={() => { setCreds(null); setError(''); }} className="w-full text-center text-sm font-semibold text-mist-600 hover:text-ink-900">
                Use a different account
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit(submit)} noValidate className="mt-6 space-y-4">
              {error && (
                <Alert tone="error" title={locked ? 'Console locked' : 'Sign-in failed'}>
                  {error}
                </Alert>
              )}
              <Field label="Work email" htmlFor="al-email" error={errors.email?.message} required>
                <Input id="al-email" type="email" autoComplete="username" {...register('email')} error={errors.email} disabled={locked} />
              </Field>
              <Field label="Password" htmlFor="al-pass" error={errors.password?.message} required>
                <div className="relative">
                  <Input id="al-pass" type={show ? 'text' : 'password'} autoComplete="current-password" {...register('password')} error={errors.password} className="pr-10" disabled={locked} />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-mist-500 hover:text-ink-900" aria-label={show ? 'Hide password' : 'Show password'}>
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={locked} icon={KeyRound}>
                Sign in
              </Button>
            </form>
          )}
          <p className="mt-5 flex items-center gap-2 text-[12.5px] text-mist-500">
            <ShieldCheck className="h-4 w-4" /> 2-step verification protects every admin account. Sessions end after inactivity.
          </p>
          <p className="mt-3 text-sm text-mist-600">
            Got an invitation?{' '}
            <Link to="/admin/invite" className="font-semibold text-accent-700 hover:underline">
              Activate your admin account
            </Link>
          </p>
        </div>
        {state.demo?.login && (
          <MockNotice className="mt-4 border-white/15 bg-white/5 text-ink-200">
            Seeded staff (one per role): <span className="font-mono">admin@</span> (MD), <span className="font-mono">ops@</span>, <span className="font-mono">listings@</span>, <span className="font-mono">finance@</span>, <span className="font-mono">it@autodealer.example</span>. The password and authenticator key are printed by <span className="font-mono">npm run seed</span>.
          </MockNotice>
        )}
      </div>
    </div>
  );
}
