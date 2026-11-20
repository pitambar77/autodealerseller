// Dealer → Team: the owner adds managers and sales staff. Each signs in with their own mobile number
// and works in this dealership account with the permissions chosen here. Their activity is listed below.
import { useEffect, useState } from 'react';
import { History, LogOut, Pause, Pencil, Play, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { api } from '../../lib/api';
import { Alert, Avatar, Badge, Button, Checkbox, ConfirmDialog, DataTable, EmptyState, Field, Input, Modal, PageHeader, PhoneInput, Section, useToast } from '../../components/ui';
import { TEAM_PERMISSIONS, TEAM_PRESETS } from '../../config/permissions';
import { formatPhone, isValidPhone } from '../../lib/phone';
import { dateTime } from '../../utils/format';

const STATUS = { invited: ['amber', 'Not signed in yet'], active: ['green', 'Active'], suspended: ['red', 'Access paused'] };

function MemberEditor({ member, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !member;
  const [d, setD] = useState({ name: member?.name || '', phone: member?.phone || '', email: member?.email || '', title: member?.title || TEAM_PRESETS.sales.label, permissions: member?.permissions || TEAM_PRESETS.sales.permissions });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const toggle = (k) => setD((x) => ({ ...x, permissions: x.permissions.includes(k) ? x.permissions.filter((p) => p !== k) : [...x.permissions, k] }));
  const save = async () => {
    const e = {};
    if (d.name.trim().length < 2) e.name = 'Enter their name';
    if (isNew && !isValidPhone(d.phone)) e.phone = 'Enter a valid mobile number';
    if (!d.permissions.length) e.permissions = 'Choose at least one thing they can do';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const body = isNew ? { ...d, phone: formatPhone(d.phone) } : { name: d.name, email: d.email, title: d.title, permissions: d.permissions };
      const r = isNew ? await api('POST', '/team', body) : await api('PATCH', `/team/${member.id}`, body);
      onSaved(r);
      toast(isNew ? `${d.name} added. We sent them a text: they sign in with their own number.` : 'Changes saved. They apply straight away.');
      onClose();
    } catch (x) {
      setErr({ form: x.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      side
      onClose={onClose}
      title={isNew ? 'Add a team member' : `Edit ${member.name}`}
      description="They get their own sign-in with their mobile number. Everything they do stays in your dealership account and is shown in the activity list."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {isNew ? 'Add to team' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {err.form && <Alert tone="error">{err.form}</Alert>}
        <Field label="Name" htmlFor="tm-name" error={err.name} required>
          <Input id="tm-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} error={err.name} />
        </Field>
        {isNew ? (
          <Field label="Mobile number" htmlFor="tm-phone" error={err.phone} required hint="Their own number (not already registered on AutoDealer). They sign in with it.">
            <PhoneInput id="tm-phone" value={d.phone} onChange={(v) => setD({ ...d, phone: v })} error={err.phone} />
          </Field>
        ) : (
          <p className="text-sm">
            <span className="text-mist-500">Sign-in number:</span> <span className="font-mono">{member.phone}</span>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="tm-email" optional>
            <Input id="tm-email" type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
          </Field>
          <Field label="Job title" htmlFor="tm-title" optional>
            <Input id="tm-title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. Sales manager" />
          </Field>
        </div>
        <div>
          <p className="label">Start from</p>
          <div className="flex flex-wrap gap-2">
            {Object.values(TEAM_PRESETS).map((p) => (
              <button key={p.label} type="button" className="chip" onClick={() => setD({ ...d, title: d.title && !Object.values(TEAM_PRESETS).some((x) => x.label === d.title) ? d.title : p.label, permissions: p.permissions })}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <fieldset>
          <legend className="label">What they can do</legend>
          <div className="space-y-2">
            {TEAM_PERMISSIONS.map((p) => (
              <Checkbox key={p.key} checked={d.permissions.includes(p.key)} onChange={() => toggle(p.key)} label={p.label} description={p.hint} />
            ))}
          </div>
          {err.permissions && <p className="field-error">{err.permissions}</p>}
          <p className="mt-3 text-[12.5px] text-mist-500">Only you can manage the team, change the business profile or close the account.</p>
        </fieldset>
      </div>
    </Modal>
  );
}

export default function DealerTeam() {
  const { me } = useStore();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null); // member or 'new'
  const [removing, setRemoving] = useState(null);
  const load = () =>
    api('GET', '/team')
      .then(setData)
      .catch((e) => toast(e.message, { tone: 'error' }));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (p, msg) => {
    try {
      setData(await p);
      if (msg) toast(msg, { tone: 'info' });
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={me.business}
        title="Team"
        description="Let your manager and sales staff work in this dealership account with their own sign-in. You choose what each person can do, and can change or remove access at any time."
        actions={
          <Button icon={UserPlus} onClick={() => setEditing('new')}>
            Add team member
          </Button>
        }
      />
      <Section bodyClass="p-0">
        {!data ? (
          <p className="p-5 text-sm text-mist-500">Loading…</p>
        ) : !data.members.length ? (
          <EmptyState icon={UsersRound} title="No team members yet" message="Add your manager or sales representatives. Each signs in with their own mobile number." action={<Button icon={UserPlus} onClick={() => setEditing('new')}>Add team member</Button>} />
        ) : (
          <ul className="divide-y divide-mist-100">
            {data.members.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Avatar name={m.name} size={40} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                      {m.name} {m.title && <span className="text-[13px] font-normal text-mist-500">· {m.title}</span>}
                      <Badge tone={STATUS[m.status]?.[0]}>{STATUS[m.status]?.[1] || m.status}</Badge>
                    </p>
                    <p className="text-[13px] text-mist-600">
                      {m.phone}
                      {m.email ? ` · ${m.email}` : ''} · {m.lastActiveAt ? `last active ${dateTime(m.lastActiveAt)}` : `added ${dateTime(m.invitedAt)}`}
                      {m.active ? ` · signed in on ${m.active} device${m.active === 1 ? '' : 's'}` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {TEAM_PERMISSIONS.filter((p) => m.permissions.includes(p.key)).map((p) => (
                        <Badge key={p.key}>{p.label}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(m)}>
                    Edit
                  </Button>
                  {m.active > 0 && (
                    <Button size="sm" variant="ghost" icon={LogOut} onClick={() => act(api('POST', `/team/${m.id}/sessions/end`), `${m.name} was signed out.`)}>
                      Sign out
                    </Button>
                  )}
                  {m.status === 'suspended' ? (
                    <Button size="sm" variant="ghost" icon={Play} onClick={() => act(api('POST', `/team/${m.id}/status`, { status: 'active' }), `${m.name} can sign in again.`)}>
                      Restore
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" icon={Pause} onClick={() => act(api('POST', `/team/${m.id}/status`, { status: 'suspended' }), `${m.name}'s access is paused.`)}>
                      Pause
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" icon={Trash2} className="text-bad-600" onClick={() => setRemoving(m)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" /> Team activity
          </span>
        }
        description="What you and your team did in this account."
        bodyClass="p-0"
      >
        <DataTable
          rowKey="id"
          rows={data?.activity || []}
          pageSize={12}
          empty="Nothing yet."
          columns={[
            { key: 'at', header: 'When', render: (e) => <span className="whitespace-nowrap">{dateTime(e.at)}</span> },
            { key: 'actor', header: 'Who', render: (e) => <b>{e.actor.replace(/ \(for .*\)$/, '')}</b> },
            { key: 'action', header: 'What', render: (e) => <span>{e.action}{e.entityId ? <span className="text-mist-500"> · {e.entityId}</span> : ''}{e.note ? <span className="block text-[12.5px] text-mist-500">{e.note}</span> : null}</span> },
          ]}
        />
      </Section>

      {editing && <MemberEditor member={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={setData} />}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        tone="danger"
        title={`Remove ${removing?.name} from the team?`}
        message="They are signed out and can't sign in to your account any more. Listings and messages they worked on stay with the dealership."
        confirmLabel="Remove"
        onConfirm={() => act(api('DELETE', `/team/${removing.id}`), `${removing.name} was removed.`)}
      />
    </div>
  );
}
