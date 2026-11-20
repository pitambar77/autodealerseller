// Admin → Customer issues (Operations): requests sent from the Support page, with status and notes.
import { useEffect, useMemo, useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Section, Select, Tabs, Textarea, useToast } from '../../components/ui';
import { dateTime } from '../../utils/format';

const STATUSES = [
  { value: 'open', label: 'Open', tone: 'red' },
  { value: 'in_progress', label: 'In progress', tone: 'amber' },
  { value: 'waiting', label: 'Waiting for customer', tone: 'blue' },
  { value: 'resolved', label: 'Resolved', tone: 'green' },
];
const tone = (s) => STATUSES.find((x) => x.value === s)?.tone || 'neutral';
const label = (s) => STATUSES.find((x) => x.value === s)?.label || s;

function Ticket({ t, onClose, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState(t.status || 'open');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api('PATCH', `/support/${t.id}`, { status, ...(note.trim() ? { note: note.trim() } : {}) });
      onSaved(r.ticket);
      toast('Request updated.');
      onClose();
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      side
      onClose={onClose}
      title={`${t.ref || t.id} · ${t.topic || 'Support request'}`}
      description={`${t.name} · ${t.phone}${t.email ? ` · ${t.email}` : ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-mist-50 p-4 text-sm whitespace-pre-wrap">{t.message}</div>
        {t.listingId && <p className="text-[13px]">Listing: <span className="font-mono">{t.listingId}</span></p>}
        {(t.notes || []).length > 0 && (
          <ul className="space-y-2">
            {t.notes.map((n, i) => (
              <li key={i} className="rounded-lg border border-mist-200 px-3 py-2 text-[13px]">
                <p className="text-[12px] text-mist-500">
                  {n.by} · {dateTime(n.at)}
                </p>
                {n.text}
              </li>
            ))}
          </ul>
        )}
        <Field label="Status" htmlFor="tk-status">
          <Select id="tk-status" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUSES} />
        </Field>
        <Field label="Internal note" htmlFor="tk-note" optional hint="Staff only. What you did or found.">
          <Textarea id="tk-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export default function AdminSupport() {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [tab, setTab] = useState('active');
  const [open, setOpen] = useState(null);
  useEffect(() => {
    api('GET', '/support')
      .then((r) => setList(r.tickets))
      .catch((e) => toast(e.message, { tone: 'error' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => (list || []).filter((t) => (tab === 'active' ? t.status !== 'resolved' : tab === 'resolved' ? t.status === 'resolved' : true)), [list, tab]);
  return (
    <div className="space-y-6">
      <PageHeader title="Customer issues" description="Requests sent from the Support page. Update the status as you work on them; notes are for staff only." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'active', label: 'Open', count: (list || []).filter((t) => t.status !== 'resolved').length },
          { value: 'resolved', label: 'Resolved' },
          { value: 'all', label: 'All' },
        ]}
      />
      <Section bodyClass="p-0">
        {!list ? (
          <p className="p-5 text-sm text-mist-500">Loading…</p>
        ) : !shown.length ? (
          <EmptyState icon={LifeBuoy} title="No requests here" message="Messages from the Support page appear here." />
        ) : (
          <ul className="divide-y divide-mist-100">
            {shown.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setOpen(t)} className="flex w-full flex-col gap-1 px-5 py-3.5 text-left hover:bg-mist-50 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-24 shrink-0 font-mono text-[12.5px] text-mist-500">{t.ref || t.id}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-ink-900">{t.topic || 'Support request'}</span>
                    <span className="block truncate text-[13px] text-mist-600">
                      {t.name}: {t.message}
                    </span>
                  </span>
                  <Badge tone={tone(t.status || 'open')}>{label(t.status || 'open')}</Badge>
                  <span className="w-32 shrink-0 text-right text-[12.5px] text-mist-500">{dateTime(t.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {open && <Ticket t={open} onClose={() => setOpen(null)} onSaved={(t) => setList((l) => l.map((x) => (x.id === t.id ? t : x)))} />}
    </div>
  );
}
