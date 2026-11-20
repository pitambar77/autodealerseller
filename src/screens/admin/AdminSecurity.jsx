// Admin → Security (IT / Technical Administrator, MD): alerts, sign-in attempts, active admin
// sessions, audit log integrity, and the security rules (idle sign-out, lockout, 2-step).
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { api } from '../../lib/api';
import { Alert, Badge, Button, DataTable, Field, Input, KpiCard, PageHeader, Section, Toggle, useToast } from '../../components/ui';
import { deviceName } from '../../components/account/SessionsList';
import { dateTime } from '../../utils/format';

const REASON = { ok: 'Signed in', password: 'Wrong password', totp: 'Wrong 2-step code', locked: 'Account locked', deactivated: 'Deactivated account', new_network: 'Signed in (new network)', totp_setup_required: 'Asked to set up 2-step' };

function Rules({ settings, onSaved }) {
  const { can, setConfig } = useStore();
  const toast = useToast();
  const [d, setD] = useState(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setD(settings), [settings]);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api('PATCH', '/admin/config', { security: d });
      setConfig?.(r.config);
      onSaved();
      toast('Security rules saved.');
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const num = (k) => ({ value: d[k], onChange: (e) => setD({ ...d, [k]: e.target.value }), type: 'number', inputMode: 'numeric' });
  return (
    <Section title="Security rules" description="Apply to every admin account." actions={<Button size="sm" onClick={save} loading={busy}>Save rules</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sign out after inactivity (minutes)" htmlFor="sr-idle" hint="5–240. Admins get a 1-minute warning first.">
          <Input id="sr-idle" {...num('adminIdleMinutes')} />
        </Field>
        <Field label="Longest session (hours)" htmlFor="sr-hours" hint="1–72. Then they sign in again, even if active.">
          <Input id="sr-hours" {...num('adminSessionHours')} />
        </Field>
        <Field label="Lock after failed sign-ins" htmlFor="sr-max" hint="3–20 wrong passwords or codes in a row.">
          <Input id="sr-max" {...num('maxFailedLogins')} />
        </Field>
        <Field label="Lock for (minutes)" htmlFor="sr-lock" hint="5–1440. The MD can unlock sooner.">
          <Input id="sr-lock" {...num('lockMinutes')} />
        </Field>
      </div>
      <div className="mt-5 border-t border-mist-100 pt-4">
        <Toggle
          id="sr-2fa"
          checked={!!d.adminTwoFactorRequired}
          onChange={(v) => (can('staff.manage') || v) && setD({ ...d, adminTwoFactorRequired: v })}
          label="Require 2-step verification for every admin"
          description={can('staff.manage') ? 'Strongly recommended. Staff without it must set it up at sign-in.' : 'Only the Managing Director can turn this off.'}
        />
      </div>
    </Section>
  );
}

export default function AdminSecurity() {
  const { can } = useStore();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [chain, setChain] = useState(null);
  const [checking, setChecking] = useState(false);
  const load = () =>
    api('GET', '/admin/security')
      .then(setData)
      .catch((e) => toast(e.message, { tone: 'error' }));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = async () => {
    setChecking(true);
    try {
      setChain(await api('GET', '/admin/audit/verify'));
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setChecking(false);
    }
  };
  const endSession = async (s) => {
    try {
      await api('POST', `/admin/staff/${s.userId}/sessions/end`, { sessionId: s.id });
      toast(`${s.name}'s session ended.`, { tone: 'info' });
      load();
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };

  if (!data) return <p className="text-sm text-mist-500">Loading…</p>;
  const sm = data.summary;
  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Sign-in monitoring, active admin sessions and the rules that protect admin accounts." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="Sign-ins (24 h)" value={sm.signins24h} icon={ShieldCheck} />
        <KpiCard label="Failed sign-ins (24 h)" value={sm.failed24h} icon={ShieldAlert} tone={sm.failed24h ? 'amber' : 'default'} />
        <KpiCard label="Locked accounts" value={sm.locked} icon={AlertTriangle} tone={sm.locked ? 'red' : 'default'} />
        <KpiCard label="Without 2-step" value={sm.without2fa} icon={ShieldAlert} tone={sm.without2fa ? 'amber' : 'default'} />
        <KpiCard label="Active admin sessions" value={sm.activeSessions} icon={LogOut} />
      </div>

      <Section title="Alerts" description="Unusual sign-ins and admin activity worth a look.">
        {data.alerts.length ? (
          <ul className="space-y-2">
            {data.alerts.map((a, i) => (
              <li key={i}>
                <Alert tone={a.level === 'high' ? 'error' : 'warn'} title={a.title}>
                  {a.body}
                </Alert>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-ok-700">
            <CheckCircle2 className="h-4 w-4" /> Nothing unusual in the last 7 days.
          </p>
        )}
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Rules settings={data.settings} onSaved={load} />
        <Section title="Activity log integrity" description="Every log entry is chained to the one before it. Any change or deletion breaks the chain and shows here.">
          <Button variant="secondary" icon={ShieldCheck} onClick={verify} loading={checking}>
            Check the activity log now
          </Button>
          {chain &&
            (chain.ok ? (
              <Alert tone="success" className="mt-4" title="Intact">
                All {chain.checked} entries are unchanged and none are missing.
              </Alert>
            ) : (
              <Alert tone="error" className="mt-4" title="Tampering detected">
                {chain.problem} Restore from a backup and investigate who had database access.
              </Alert>
            ))}
        </Section>
      </div>

      <Section title="Active admin sessions" bodyClass="p-0">
        <DataTable
          rowKey="id"
          rows={data.sessions}
          empty="No active sessions."
          columns={[
            { key: 'name', header: 'Staff member', render: (s) => <b>{s.name}</b> },
            { key: 'device', header: 'Device', render: (s) => deviceName(s.userAgent) },
            { key: 'ip', header: 'Network', render: (s) => <span className="font-mono text-[12.5px]">{s.ip}</span> },
            { key: 'createdAt', header: 'Signed in', render: (s) => dateTime(s.createdAt) },
            { key: 'lastSeenAt', header: 'Last active', render: (s) => dateTime(s.lastSeenAt) },
            ...(can('staff.manage') ? [{ key: 'end', header: '', align: 'right', render: (s) => <Button size="sm" variant="ghost" className="text-bad-600" onClick={() => endSession(s)}>End</Button> }] : []),
          ]}
        />
      </Section>

      <Section title="Sign-in attempts (7 days)" bodyClass="p-0">
        <DataTable
          rowKey="id"
          rows={data.attempts}
          pageSize={15}
          empty="No sign-in attempts."
          columns={[
            { key: 'at', header: 'When', render: (a) => dateTime(a.at) },
            { key: 'who', header: 'Account', render: (a) => <span>{a.name || a.email}</span> },
            { key: 'ok', header: 'Result', render: (a) => <Badge tone={a.ok ? (a.flagged ? 'amber' : 'green') : 'red'}>{REASON[a.reason] || a.reason}</Badge> },
            { key: 'ip', header: 'Network', render: (a) => <span className="font-mono text-[12.5px]">{a.ip}</span> },
            { key: 'ua', header: 'Device', render: (a) => deviceName(a.userAgent) },
          ]}
        />
      </Section>
    </div>
  );
}
