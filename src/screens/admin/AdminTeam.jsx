// Admin → Team & roles (Managing Director): one account per staff member, their roles, invitations,
// deactivation, sessions, unlocking and 2-step resets; and the roles themselves with their permissions.
import { useEffect, useMemo, useState } from 'react';
import { KeyRound, LogOut, Mail, Pencil, Plus, ShieldCheck, ShieldOff, Trash2, Unlock, UserMinus, UserPlus, UserCheck } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { api } from '../../lib/api';
import { Alert, Badge, Button, Checkbox, ConfirmDialog, CopyText, Field, Input, Modal, PageHeader, Section, Select, Tabs, Textarea, useToast, Avatar } from '../../components/ui';
import { deviceName } from '../../components/account/SessionsList';
import { PERMISSIONS } from '../../config/permissions';
import { dateTime } from '../../utils/format';
import { cn } from '../../utils/format';

const GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];

function InviteModal({ roles, onClose, onDone }) {
  const toast = useToast();
  const [d, setD] = useState({ email: '', name: '', adminRole: roles.find((r) => !r.locked)?.key || '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const send = async () => {
    setBusy(true);
    try {
      const r = await api('POST', '/admin/staff/invites', d);
      setSent(r);
      onDone(r);
      toast(r.emailed ? `Invitation emailed to ${r.email}.` : 'Invitation created. Share the code with them.');
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
      title={sent ? 'Invitation ready' : 'Invite a staff member'}
      description={sent ? undefined : 'Each person gets their own account: they set their own password and 2-step verification. No shared logins.'}
      footer={
        sent ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button icon={Mail} onClick={send} loading={busy}>
              Send invitation
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <div className="space-y-3 text-sm">
          <p>
            {sent.emailed ? 'We emailed' : 'Give'} <b>{sent.email}</b> this code. They open <span className="font-mono">{sent.link}</span>, enter it with their email, and set a password and authenticator. It expires in {sent.expiresInDays} days.
          </p>
          <div className="flex items-center gap-3 rounded-xl bg-mist-50 p-4">
            <span className="select-all font-mono text-xl font-bold tracking-wider">{sent.code}</span>
            <CopyText text={sent.code} />
          </div>
          <p className="text-[12.5px] text-mist-500">The code is shown only once. If it gets lost, send a new invitation.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {err && <Alert tone="error">{err}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Work email" htmlFor="iv-email" required>
              <Input id="iv-email" type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} placeholder="name@autodealer.co.tz" />
            </Field>
            <Field label="Name" htmlFor="iv-name" optional>
              <Input id="iv-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
            </Field>
          </div>
          <Field label="Role" htmlFor="iv-role" required hint={roles.find((r) => r.key === d.adminRole)?.description}>
            <Select id="iv-role" value={d.adminRole} onChange={(e) => setD({ ...d, adminRole: e.target.value })} options={roles.map((r) => ({ value: r.key, label: r.name }))} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

function RoleEditor({ role, onClose, onDone }) {
  const toast = useToast();
  const [d, setD] = useState({ name: role?.name || '', description: role?.description || '', permissions: role?.permissions || ['dashboard.view'] });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = (k) => setD((x) => ({ ...x, permissions: x.permissions.includes(k) ? x.permissions.filter((p) => p !== k) : [...x.permissions, k] }));
  const save = async () => {
    setBusy(true);
    try {
      const r = role ? await api('PATCH', `/admin/staff/roles/${role.key}`, d) : await api('POST', '/admin/staff/roles', d);
      onDone(r);
      toast(role ? `${d.name} updated. Staff in this role were signed out so they get the new access.` : `${d.name} created.`);
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
      side
      size="lg"
      onClose={onClose}
      title={role ? `Edit role: ${role.name}` : 'New role'}
      description="Choose exactly what people in this role can see and do."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {role ? 'Save role' : 'Create role'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="Role name" htmlFor="re-name" required>
          <Input id="re-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Customer Support Agent" />
        </Field>
        <Field label="What this role is for" htmlFor="re-desc" optional>
          <Textarea id="re-desc" rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </Field>
        {GROUPS.map((g) => (
          <fieldset key={g}>
            <legend className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-mist-500">{g}</legend>
            <div className="space-y-2">
              {PERMISSIONS.filter((p) => p.group === g).map((p) => (
                <Checkbox
                  key={p.key}
                  checked={d.permissions.includes(p.key)}
                  onChange={() => toggle(p.key)}
                  label={
                    <span>
                      {p.label} {p.sensitive && <Badge tone="amber">Sensitive</Badge>}
                    </span>
                  }
                  description={p.hint}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </Modal>
  );
}

export default function AdminTeam() {
  const { me } = useStore();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('staff');
  const [inviting, setInviting] = useState(false);
  const [editingRole, setEditingRole] = useState(null); // role or 'new'
  const [confirm, setConfirm] = useState(null); // { title, message, run, tone, label }
  const load = () =>
    api('GET', '/admin/staff')
      .then(setData)
      .catch((e) => toast(e.message, { tone: 'error' }));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn, msg) => {
    try {
      const r = await fn();
      setData((x) => ({ ...x, ...r }));
      if (msg) toast(msg, { tone: 'info' });
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };
  const roles = data?.roles || [];
  const active = useMemo(() => (data?.staff || []).filter((s) => s.status === 'active').length, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & roles"
        description="Every administrator has their own login. Give each person the role that matches their job; change or revoke access at any time."
        actions={
          <Button icon={UserPlus} onClick={() => setInviting(true)} disabled={!data}>
            Invite staff member
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'staff', label: 'Staff', count: active },
          { value: 'roles', label: 'Roles & permissions', count: roles.length },
          { value: 'invites', label: 'Invitations', count: data?.invites.length || undefined },
        ]}
      />

      {!data ? (
        <p className="text-sm text-mist-500">Loading…</p>
      ) : tab === 'staff' ? (
        <Section bodyClass="p-0">
          <ul className="divide-y divide-mist-100">
            {data.staff.map((s) => {
              const self = s.id === me.id;
              return (
                <li key={s.id} className={cn('px-5 py-4', s.status !== 'active' && 'bg-mist-50/70')}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Avatar name={s.name} size={40} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                          {s.name} {self && <Badge>You</Badge>}
                          {s.status !== 'active' && <Badge tone="red">Deactivated</Badge>}
                          {s.lockedUntil && <Badge tone="red">Locked</Badge>}
                          {s.twoFactor ? <Badge tone="green" icon={ShieldCheck}>2-step on</Badge> : <Badge tone="amber" icon={ShieldOff}>No 2-step yet</Badge>}
                        </p>
                        <p className="text-[13px] text-mist-600">
                          {s.email} · {s.phone}
                        </p>
                        <p className="text-[12.5px] text-mist-500">
                          Last sign-in {s.lastLoginAt ? `${dateTime(s.lastLoginAt)}${s.lastLoginIp ? ` from ${s.lastLoginIp}` : ''}` : 'never'} · {s.sessions.length} active session{s.sessions.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        aria-label={`Role for ${s.name}`}
                        value={s.adminRole}
                        disabled={self || s.status !== 'active'}
                        onChange={(e) => {
                          const role = roles.find((r) => r.key === e.target.value);
                          setConfirm({ title: `Make ${s.name} ${role.name}?`, message: `${role.description} They'll be signed out and get the new access when they sign in again.`, label: 'Change role', run: () => act(() => api('PATCH', `/admin/staff/${s.id}`, { adminRole: role.key }), 'Role changed.') });
                        }}
                        options={roles.map((r) => ({ value: r.key, label: r.name }))}
                        className="h-9 w-56 text-[13px]"
                      />
                      {s.lockedUntil && (
                        <Button size="sm" variant="secondary" icon={Unlock} onClick={() => act(() => api('POST', `/admin/staff/${s.id}/unlock`), `${s.name} can sign in again.`)}>
                          Unlock
                        </Button>
                      )}
                      {s.sessions.length > 0 && !self && (
                        <Button size="sm" variant="secondary" icon={LogOut} onClick={() => act(() => api('POST', `/admin/staff/${s.id}/sessions/end`, {}), `${s.name} was signed out everywhere.`)}>
                          End sessions
                        </Button>
                      )}
                      {!self && s.twoFactor && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={KeyRound}
                          onClick={() => setConfirm({ title: `Reset ${s.name}'s 2-step verification?`, message: 'Use this when they lost their phone. They are signed out and must set up a new authenticator at their next sign-in.', label: 'Reset', run: () => act(() => api('POST', `/admin/staff/${s.id}/reset-2fa`), '2-step verification reset.') })}
                        >
                          Reset 2-step
                        </Button>
                      )}
                      {!self &&
                        (s.status === 'active' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-bad-600"
                            icon={UserMinus}
                            onClick={() => setConfirm({ title: `Deactivate ${s.name}?`, message: 'Their access is revoked at once and every session ends. Their activity history is kept. You can reactivate them later.', label: 'Deactivate', tone: 'danger', run: () => act(() => api('POST', `/admin/staff/${s.id}/status`, { status: 'suspended' }), `${s.name} was deactivated.`) })}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" icon={UserCheck} onClick={() => act(() => api('POST', `/admin/staff/${s.id}/status`, { status: 'active' }), `${s.name} was reactivated.`)}>
                            Reactivate
                          </Button>
                        ))}
                    </div>
                  </div>
                  {s.sessions.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2 pl-[52px]">
                      {s.sessions.map((x) => (
                        <li key={x.id} className="flex items-center gap-2 rounded-lg bg-mist-50 px-2.5 py-1.5 text-[12px] text-mist-600">
                          {deviceName(x.userAgent)} · {x.ip} · active {dateTime(x.lastSeenAt)}
                          {!self && (
                            <button type="button" className="font-semibold text-bad-600 hover:underline" onClick={() => act(() => api('POST', `/admin/staff/${s.id}/sessions/end`, { sessionId: x.id }), 'Session ended.')}>
                              End
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : tab === 'roles' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={Plus} variant="secondary" onClick={() => setEditingRole('new')}>
              New role
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {roles.map((r) => (
              <Section
                key={r.key}
                title={
                  <span className="flex items-center gap-2">
                    {r.name} {r.locked && <Badge tone="dark">Super admin</Badge>}
                  </span>
                }
                description={r.description}
                actions={
                  !r.locked && (
                    <div className="flex gap-1">
                      <button type="button" className="btn-icon" aria-label={`Edit ${r.name}`} onClick={() => setEditingRole(r)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" className="btn-icon text-bad-600" aria-label={`Remove ${r.name}`} onClick={() => setConfirm({ title: `Remove the ${r.name} role?`, message: r.members ? `${r.members} staff member(s) have it: give them another role first.` : 'Nobody has this role.', label: 'Remove', tone: 'danger', run: () => act(() => api('DELETE', `/admin/staff/roles/${r.key}`), 'Role removed.') })}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                }
              >
                <p className="mb-2 text-[12.5px] font-semibold text-mist-500">
                  {r.members} active staff member{r.members === 1 ? '' : 's'}
                </p>
                {r.permissions.includes('*') ? (
                  <p className="text-sm">Everything, including staff, roles, permissions and approvals.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {PERMISSIONS.filter((p) => r.permissions.includes(p.key)).map((p) => (
                      <Badge key={p.key} tone={p.sensitive ? 'amber' : 'neutral'}>
                        {p.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </Section>
            ))}
          </div>
        </div>
      ) : (
        <Section bodyClass="p-0">
          {data.invites.length ? (
            <ul className="divide-y divide-mist-100">
              {data.invites.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{i.name || i.email}</p>
                    <p className="text-[13px] text-mist-600">
                      {i.email} · {i.roleName} · invited by {i.createdBy} · expires {dateTime(i.expiresAt)}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-bad-600" onClick={() => act(() => api('DELETE', `/admin/staff/invites/${i.id}`), 'Invitation cancelled.')}>
                    Cancel
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-mist-500">No open invitations.</p>
          )}
        </Section>
      )}

      {inviting && <InviteModal roles={roles} onClose={() => setInviting(false)} onDone={(r) => setData((x) => ({ ...x, ...r }))} />}
      {editingRole && <RoleEditor role={editingRole === 'new' ? null : editingRole} onClose={() => setEditingRole(null)} onDone={(r) => setData((x) => ({ ...x, ...r }))} />}
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title} message={confirm?.message} confirmLabel={confirm?.label} tone={confirm?.tone} onConfirm={() => confirm?.run()} />
    </div>
  );
}
