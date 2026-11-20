// Admin → Approvals: maker-checker requests (refunds, payment adjustments, permanent deletions,
// account suspensions). One admin asks, another authorised admin approves; never your own request.
import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Clock, Undo2, X } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { api } from '../../lib/api';
import { Alert, Badge, Button, EmptyState, Field, Modal, PageHeader, Section, Tabs, Textarea, useToast } from '../../components/ui';
import { APPROVAL_TYPES } from '../../config/permissions';
import { dateTime } from '../../utils/format';

const STATUS_TONE = { pending: 'amber', approved: 'green', rejected: 'red', cancelled: 'neutral' };

function Decide({ request, onClose, onDone }) {
  const toast = useToast();
  const [mode, setMode] = useState(request.mode);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const r = await api('POST', `/admin/approvals/${request.id}/${mode === 'approve' ? 'approve' : 'reject'}`, { note });
      toast(mode === 'approve' ? r.approval.result?.text || 'Approved.' : 'Request rejected. The requester was told.', { tone: mode === 'approve' ? 'success' : 'info' });
      onDone();
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
      onClose={onClose}
      title={mode === 'approve' ? 'Approve this request?' : 'Reject this request?'}
      description={request.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={mode === 'approve' ? 'primary' : 'danger'} onClick={go} loading={busy} icon={mode === 'approve' ? CheckCheck : X}>
            {mode === 'approve' ? 'Approve and carry out' : 'Reject'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-mist-50 p-4 text-sm">
          <p className="text-mist-700">{request.summary}</p>
          <p className="mt-2">
            <span className="text-mist-500">Requested by</span> <b>{request.requestedBy?.name}</b> · {dateTime(request.requestedAt)}
          </p>
          <p className="mt-1">
            <span className="text-mist-500">Reason:</span> {request.reason}
          </p>
        </div>
        {mode === 'approve' && <Alert tone="warn">Approving carries it out straight away. It is recorded in the activity log with your name.</Alert>}
        <Field label={mode === 'approve' ? 'Note (optional)' : 'Why are you rejecting it?'} htmlFor="ap-note" error={err} required={mode !== 'approve'}>
          <Textarea id="ap-note" rows={3} value={note} onChange={(e) => (setNote(e.target.value), setErr(''))} />
        </Field>
        <button type="button" className="text-[13px] font-semibold text-accent-700 hover:underline" onClick={() => setMode(mode === 'approve' ? 'reject' : 'approve')}>
          {mode === 'approve' ? 'Reject instead' : 'Approve instead'}
        </button>
      </div>
    </Modal>
  );
}

export default function AdminApprovals() {
  const { refresh } = useStore();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [tab, setTab] = useState('waiting');
  const [deciding, setDeciding] = useState(null);
  const load = () =>
    api('GET', '/admin/approvals')
      .then((r) => setList(r.approvals))
      .catch((e) => toast(e.message, { tone: 'error' }));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const all = list || [];
    return {
      waiting: all.filter((a) => a.canDecide),
      mine: all.filter((a) => a.mine),
      all,
    };
  }, [list]);
  const shown = groups[tab] || [];

  const cancel = async (a) => {
    try {
      await api('POST', `/admin/approvals/${a.id}/cancel`);
      toast('Request withdrawn.', { tone: 'info' });
      load();
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Approvals" description="Sensitive actions need two people: one admin asks, another authorised admin approves. Nobody can approve their own request." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'waiting', label: 'Waiting for me', count: groups.waiting.length },
          { value: 'mine', label: 'My requests', count: groups.mine.filter((a) => a.status === 'pending').length || undefined },
          { value: 'all', label: 'All I can see' },
        ]}
      />
      <Section bodyClass="p-0">
        {!list ? (
          <p className="p-5 text-sm text-mist-500">Loading…</p>
        ) : !shown.length ? (
          <EmptyState icon={CheckCheck} title={tab === 'waiting' ? 'Nothing waiting for you' : 'No requests'} message={tab === 'waiting' ? 'Requests you can approve appear here, and in your notifications.' : 'Refund, adjustment, deletion and suspension requests appear here.'} />
        ) : (
          <ul className="divide-y divide-mist-100">
            {shown.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone="dark">{APPROVAL_TYPES[a.type]?.label}</Badge>
                    <span className="font-semibold text-ink-900">{a.title}</span>
                    <Badge tone={STATUS_TONE[a.status] || 'neutral'}>{a.status}</Badge>
                  </p>
                  <p className="mt-1 text-[13.5px] text-mist-600">{a.summary}</p>
                  <p className="mt-1 text-[12.5px] text-mist-500">
                    <Clock className="mr-1 inline h-3.5 w-3.5" />
                    {a.requestedBy?.name} asked {dateTime(a.requestedAt)}: “{a.reason}”
                    {a.decidedBy && a.status !== 'pending' && (
                      <>
                        {' '}
                        · {a.status} by {a.decidedBy.name} {dateTime(a.decidedAt)}
                        {a.decisionNote ? `: “${a.decisionNote}”` : ''}
                      </>
                    )}
                  </p>
                  {a.result?.text && <p className="mt-1 text-[12.5px] font-semibold text-ok-700">{a.result.text}</p>}
                  {a.result?.error && <p className="mt-1 text-[12.5px] font-semibold text-bad-600">Last attempt failed: {a.result.error}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {a.canDecide && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setDeciding({ ...a, mode: 'reject' })}>
                        Reject
                      </Button>
                      <Button size="sm" icon={CheckCheck} onClick={() => setDeciding({ ...a, mode: 'approve' })}>
                        Approve
                      </Button>
                    </>
                  )}
                  {a.mine && a.status === 'pending' && (
                    <Button size="sm" variant="ghost" icon={Undo2} onClick={() => cancel(a)}>
                      Withdraw
                    </Button>
                  )}
                  {a.mine && a.status === 'pending' && !a.canDecide && <span className="self-center text-[12.5px] text-mist-500">Waiting for another admin</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {deciding && (
        <Decide
          request={deciding}
          onClose={() => setDeciding(null)}
          onDone={() => {
            load();
            refresh().catch(() => {});
          }}
        />
      )}
    </div>
  );
}
