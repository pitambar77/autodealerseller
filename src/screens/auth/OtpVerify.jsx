import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from '@/lib/router';
import { ArrowLeft, Pencil, ShieldCheck } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Alert, Button, Field, Input, MockNotice, OtpInput, useToast } from '../../components/ui';
import { ROLE_META } from '../../config/site';
import { readPending, savePending } from './PhoneSignIn';
import { maskPhone } from '../../utils/format';

const RESEND_SECONDS = 30;

/**
 * One-time code by SMS, checked by the API. Shared by sign-in, registration and buyer onboarding.
 * request(phone) sends a code; verify(phone) checks it and returns the API result (or null on a wrong code).
 */
export function useOtp() {
  const { requestOtp, verifyOtp } = useStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [left, setLeft] = useState(0);
  const [devCode, setDevCode] = useState('');
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const request = async (phone) => {
    setError('');
    setLocked(false);
    setCode('');
    try {
      const r = await requestOtp(phone);
      setDevCode(r?.devCode || '');
      setLeft(RESEND_SECONDS);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };
  const verify = async (phone, value = code) => {
    if (locked) {
      setError('Too many attempts. Request a new code.');
      return null;
    }
    if (value.length < 6) {
      setError('Enter all 6 digits.');
      return null;
    }
    try {
      const r = await verifyOtp(phone, value);
      setError('');
      return r;
    } catch (e) {
      // Clear the boxes so a corrected code is typed fresh (and auto-submit doesn't fire per keystroke).
      setCode('');
      setError(e.message);
      if (e.details?.reason === 'locked' || e.details?.reason === 'expired') setLocked(true);
      if (e.details?.reason === 'suspended') return { suspended: true };
      if (e.details?.reason === 'admin') return { admin: true };
      return null;
    }
  };
  return { code, setCode: (c) => { setCode(c); setError(''); }, error, request, verify, left, locked, devCode };
}

/** Shows the code in development builds of the API (OTP_PROVIDER=console); otherwise says an SMS was sent. */
export function OtpNotice({ devCode, className }) {
  if (!devCode) return <p className={`text-[12.5px] text-mist-500 ${className || ''}`}>We've sent the code by SMS. It expires in 10 minutes.</p>;
  return (
    <MockNotice className={className}>
      SMS isn't connected on this server, so here is your code: <span className="font-mono font-semibold">{devCode}</span>
    </MockNotice>
  );
}

export default function OtpVerify() {
  const loc = useLocation();
  const nav = useNavigate();
  const toast = useToast();
  const { registerUser } = useStore();
  const pending = loc.state || readPending();
  const otp = useOtp();
  const [stage, setStage] = useState('code');
  const [name, setName] = useState('');
  const [nameErr, setNameErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Send the first code when the screen opens (once, even when React re-runs effects in development).
  const sentFor = useRef(null);
  useEffect(() => {
    if (!pending?.phone || sentFor.current === pending.phone) return;
    sentFor.current = pending.phone;
    otp.request(pending.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.phone]);

  const finish = (user, member) => {
    savePending(null);
    // Dealership staff sign in to the dealership account as themselves.
    if (member) toast(`You're working in the ${user.business || user.name} account.`, { title: `Welcome, ${member.name.split(' ')[0]}` });
    else toast(`Signed in as ${ROLE_META[user.role].label}.`, { title: `Welcome${user.name ? `, ${user.name.split(' ')[0]}` : ''}` });
    const dest = pending.next ? decodeURIComponent(pending.next) : ROLE_META[user.role].home;
    nav(dest, { replace: true });
  };

  const verify = async (e) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await otp.verify(pending.phone);
    setBusy(false);
    if (!r) return;
    if (r.suspended) {
      otp.setCode('');
      setStage('suspended');
      return;
    }
    if (r.admin) {
      nav('/admin/login', { replace: true });
      return;
    }
    if (r.registered) finish(r.user, r.member);
    else if (pending.role) setStage('name');
    else nav(`/register?phone=${encodeURIComponent(pending.phone.replace(/\D/g, ''))}`, { replace: true });
  };

  const createAccount = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setNameErr('Enter your full name');
      return;
    }
    setBusy(true);
    try {
      const u = await registerUser({ role: pending.role, name: name.trim() });
      finish(u);
    } catch (err) {
      setNameErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  // auto-submit when 6 digits are entered
  useEffect(() => {
    if (otp.code.length === 6 && stage === 'code') verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp.code]);

  if (!pending?.phone) {
    return (
      <div>
        <p className="eyebrow">Verify your number</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight">Start with your mobile number</h1>
        <p className="mt-1.5 text-mist-600">Enter your number on the sign-in page and we'll send you a 6-digit code.</p>
        <Button to="/signin" className="mt-6">
          Go to sign in
        </Button>
      </div>
    );
  }

  if (stage === 'suspended') {
    return (
      <div>
        <Alert tone="error" title="This account is suspended">
          An administrator suspended this account. Contact support to find out why and how to restore access.
        </Alert>
        <Button to="/support" className="mt-4">
          Contact support
        </Button>
      </div>
    );
  }

  if (stage === 'name') {
    return (
      <form onSubmit={createAccount} noValidate>
        <p className="eyebrow">New {ROLE_META[pending.role].label} account · step 3 of 3</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight">Your number is verified</h1>
        <p className="mt-1.5 text-mist-600">Tell us your name. Buyers see it on your listings{pending.role === 'dealer' ? ' alongside your business name' : ''}.</p>
        <Field label="Full name" htmlFor="otp-name" error={nameErr} className="mt-6" required>
          <Input id="otp-name" value={name} onChange={(e) => { setName(e.target.value); setNameErr(''); }} error={nameErr} autoComplete="name" autoFocus />
        </Field>
        <Button type="submit" size="lg" className="mt-5 w-full" loading={busy}>
          Create account
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} noValidate>
      <Link to={`/signin${pending.role ? `?role=${pending.role}` : ''}`} className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-mist-600 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <p className="eyebrow">Verify your number</p>
      <h1 className="mt-2 text-[28px] font-bold leading-tight">Enter the 6-digit code</h1>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-mist-600">
        Sent to <span className="font-mono font-semibold text-ink-900">{maskPhone(pending.phone)}</span>
        <Link to={`/signin${pending.role ? `?role=${pending.role}` : ''}`} className="inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline">
          <Pencil className="h-3.5 w-3.5" /> Edit number
        </Link>
      </p>
      <div className="mt-6">
        <OtpInput value={otp.code} onChange={otp.setCode} error={!!otp.error} disabled={otp.locked} />
        {otp.error && <p className="field-error mt-2" role="alert">{otp.error}</p>}
      </div>
      <div className="mt-4 text-sm text-mist-600">
        {otp.left > 0 ? (
          <span className="num">
            Didn't get it? Resend in <span className="font-mono font-semibold text-ink-900">0:{String(otp.left).padStart(2, '0')}</span>
          </span>
        ) : (
          <button
            type="button"
            className="font-semibold text-accent-700 hover:underline"
            onClick={async () => {
              if (await otp.request(pending.phone)) toast('A new code is on its way.', { tone: 'info' });
            }}
          >
            Resend code
          </button>
        )}
      </div>
      <Button type="submit" size="lg" className="mt-6 w-full" loading={busy} icon={ShieldCheck} disabled={otp.locked}>
        Verify & continue
      </Button>
      <OtpNotice devCode={otp.devCode} className="mt-4" />
    </form>
  );
}
