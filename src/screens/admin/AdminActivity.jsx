// Admin → Activity log: who did what, when, from where and what changed. The MD (full activity
// history) sees everyone; other staff see their own actions. Entries can't be edited or deleted.
import { useEffect, useMemo, useState } from 'react';
import { Download, History, ShieldCheck } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { api } from '../../lib/api';
import { Alert, Badge, Button, CsvModal, DataTable, EmptyState, Input, PageHeader, SearchInput, Section, Select, useToast } from '../../components/ui';
import { dateTime } from '../../utils/format';

const fmt = (v) => (v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v));
function Changes({ changes }) {
  if (!changes || typeof changes !== 'object') return null;
  return (
    <ul className="mt-1 space-y-0.5 text-[12px] text-mist-600">
      {Object.entries(changes).map(([k, v]) => (
        <li key={k}>
          <span className="font-semibold">{k}</span>: {v && typeof v === 'object' && 'from' in v ? <>{fmt(v.from)} → <b className="text-ink-800">{fmt(v.to)}</b></> : fmt(v)}
        </li>
      ))}
    </ul>
  );
}

export default function AdminActivity() {
  const { can, state } = useStore();
  const toast = useToast();
  const all = can('audit.view');
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ q: '', actorId: '', entityType: '', from: '', to: '' });
  const [csv, setCsv] = useState(false);
  const [chain, setChain] = useState(null);

  useEffect(() => {
    const qs = new URLSearchParams(Object.entries({ ...f, limit: 2000 }).filter(([, v]) => v));
    const t = setTimeout(() => {
      api('GET', `/admin/audit?${qs}`)
        .then((r) => setRows(r.audit))
        .catch((e) => toast(e.message, { tone: 'error' }));
    }, 250);
    return () => clearTimeout(t);
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps

  const staff = useMemo(() => state.users.filter((u) => u.role === 'admin'), [state.users]);
  const types = ['listing', 'user', 'staff', 'role', 'payment', 'config', 'backup', 'reconciliation', 'support', 'team', 'audit'];
  const csvText = useMemo(() => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return ['When (UTC),Who,Role,Action,Record,Note,Changes,IP', ...(rows || []).map((e) => [e.at, e.actor, e.adminRole || e.actorRole, e.action, `${e.entityType}:${e.entityId}`, e.note, e.changes ? JSON.stringify(e.changes) : '', e.ip].map(esc).join(','))].join('\n');
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description={all ? 'Every important action by every administrator, with the time, the network and what changed. Entries cannot be changed or deleted.' : 'Your own actions in the admin console. The Managing Director sees everyone’s.'}
        actions={
          <div className="flex gap-2">
            {(all || can('system.security')) && (
              <Button variant="secondary" icon={ShieldCheck} onClick={() => api('GET', '/admin/audit/verify').then(setChain).catch((e) => toast(e.message, { tone: 'error' }))}>
                Check integrity
              </Button>
            )}
            <Button variant="secondary" icon={Download} onClick={() => setCsv(true)} disabled={!rows?.length}>
              Export CSV
            </Button>
          </div>
        }
      />
      {chain && (
        <Alert tone={chain.ok ? 'success' : 'error'} title={chain.ok ? 'Activity log intact' : 'Tampering detected'}>
          {chain.ok ? `All ${chain.checked} chained entries are unchanged and none are missing.` : chain.problem}
        </Alert>
      )}
      <Section bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-mist-100 p-4">
          <SearchInput value={f.q} onChange={(q) => setF({ ...f, q })} placeholder="Search actions, records, notes, IP" className="w-full sm:w-72" />
          {all && <Select aria-label="Staff member" value={f.actorId} onChange={(e) => setF({ ...f, actorId: e.target.value })} options={[{ value: '', label: 'Everyone' }, ...staff.map((u) => ({ value: u.id, label: u.name }))]} className="h-10 w-48" />}
          <Select aria-label="Record type" value={f.entityType} onChange={(e) => setF({ ...f, entityType: e.target.value })} options={[{ value: '', label: 'All records' }, ...types.map((t) => ({ value: t, label: t }))]} className="h-10 w-40" />
          <Input aria-label="From" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="h-10 w-40" />
          <Input aria-label="To" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="h-10 w-40" />
        </div>
        {!rows ? (
          <p className="p-5 text-sm text-mist-500">Loading…</p>
        ) : !rows.length ? (
          <EmptyState icon={History} title="No activity found" message="Try a different search or dates." />
        ) : (
          <DataTable
            rowKey="id"
            rows={rows}
            pageSize={25}
            columns={[
              { key: 'at', header: 'When', render: (e) => <span className="whitespace-nowrap text-[13px]">{dateTime(e.at)}</span> },
              {
                key: 'actor',
                header: 'Who',
                render: (e) => (
                  <span>
                    <b>{e.actor}</b>
                    <span className="block text-[12px] text-mist-500">{e.adminRole || e.actorRole}</span>
                  </span>
                ),
              },
              {
                key: 'action',
                header: 'What',
                render: (e) => (
                  <div className="min-w-[220px]">
                    <p className="font-semibold">{e.action}</p>
                    {e.note && <p className="text-[12.5px] text-mist-600">{e.note}</p>}
                    <Changes changes={e.changes} />
                  </div>
                ),
              },
              { key: 'entity', header: 'Record', render: (e) => <Badge>{`${e.entityType || '—'} ${e.entityId || ''}`.trim()}</Badge> },
              { key: 'ip', header: 'Network', render: (e) => <span className="font-mono text-[12px] text-mist-600">{e.ip || '—'}</span> },
            ]}
          />
        )}
      </Section>
      <CsvModal open={csv} onClose={() => setCsv(false)} filename="autodealer-activity-log.csv" csv={csvText} />
    </div>
  );
}
