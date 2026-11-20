// Account page for admin staff (password, 2-step verification, devices, my permissions) and for
// dealership team members (who they are in the dealership, what they can do, devices).
import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { api } from '../../lib/api';
import { Badge, Button, DL, Field, Input, PageHeader, Section, useToast } from '../../components/ui';
import { SessionsList } from '../../components/account/SessionsList';
import { PERMISSIONS, TEAM_PERMISSIONS, allows } from '../../config/permissions';
import { date } from '../../utils/format';

function PasswordForm() {
  const toast = useToast();
  const [d, setD] = useState({ current: '', password: '', confirm: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (d.password !== d.confirm) return setErr({ confirm: "The new passwords don't match" });
    setBusy(true);
    try {
      await api('POST', '/me/password', { current: d.current, password: d.password });
      setD({ current: '', password: '', confirm: '' });
      setErr({});
      toast('Password changed. Your other devices were signed out.');
    } catch (x) {
      setErr(x.details?.fields?.current ? { current: x.message } : { password: x.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <Field label="Current password" htmlFor="pw-current" error={err.current}>
        <Input id="pw-current" type="password" autoComplete="current-password" value={d.current} onChange={(e) => setD({ ...d, current: e.target.value })} error={err.current} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="pw-new" error={err.password} hint="At least 12 characters with capital and lowercase letters, a number and a symbol. Not your name or email.">
          <Input id="pw-new" type="password" autoComplete="new-password" value={d.password} onChange={(e) => setD({ ...d, password: e.target.value })} error={err.password} />
        </Field>
        <Field label="Repeat new password" htmlFor="pw-confirm" error={err.confirm}>
          <Input id="pw-confirm" type="password" autoComplete="new-password" value={d.confirm} onChange={(e) => setD({ ...d, confirm: e.target.value })} error={err.confirm} />
        </Field>
      </div>
      <Button type="submit" icon={KeyRound} loading={busy} disabled={!d.current || !d.password}>
        Change password
      </Button>
    </form>
  );
}

export function StaffAccount() {
  const { me, state, perms } = useStore();
  const full = perms.includes('*');
  const mine = PERMISSIONS.filter((p) => allows(perms, p.key));
  return (
    <div>
      <PageHeader title="My admin account" description="Your sign-in, 2-step verification, devices and what your role can do." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Section title="Password">
            <PasswordForm />
          </Section>
          <Section title="Signed-in devices" description={`Admin sessions end after ${state.session?.idleMinutes || 30} minutes without activity.`}>
            <SessionsList />
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Account">
            <DL
              items={[
                ['Name', me.name],
                ['Work email', me.email],
                ['Role', <b key="r">{state.session?.roleName}</b>],
                ['2-step verification', me.twoFactor ? <Badge key="t" tone="green">On</Badge> : <Badge key="t" tone="amber">Set up at next sign-in</Badge>],
                ['Last sign-in', me.lastLoginAt ? `${date(me.lastLoginAt)}${me.lastLoginIp ? ` · ${me.lastLoginIp}` : ''}` : '—'],
              ]}
            />
            <p className="mt-3 text-[12.5px] text-mist-500">Lost the phone with your authenticator? Ask the Managing Director to reset your 2-step verification.</p>
          </Section>
          <Section title="What my role can do">
            {full ? (
              <p className="flex items-start gap-2 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok-600" /> Everything: you have full Super Admin access, including staff and permissions.
              </p>
            ) : (
              <ul className="space-y-1.5 text-[13.5px]">
                {mine.map((p) => (
                  <li key={p.key} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok-600" /> {p.label}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

export function MemberAccount() {
  const { me, member } = useStore();
  return (
    <div>
      <PageHeader title="My account" description={`You work in the ${me.business} dealership account.`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Section title="Signed-in devices">
            <SessionsList />
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Me">
            <DL items={[['Name', member.name], ['Role', member.title || 'Team member'], ['Sign-in number', member.phone], ['Dealership', me.business], ['Owner', me.name]]} />
            <p className="mt-3 text-[12.5px] text-mist-500">The dealership owner manages your access. Listings and messages belong to the dealership.</p>
          </Section>
          <Section title="What I can do">
            <ul className="space-y-1.5 text-[13.5px]">
              {TEAM_PERMISSIONS.map((p) => (
                <li key={p.key} className={allows(member.permissions, p.key) ? 'flex items-start gap-2' : 'flex items-start gap-2 text-mist-400 line-through'}>
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> {p.label}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
