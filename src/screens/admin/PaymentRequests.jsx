// Finance: ask for a refund or a payment adjustment (both need another admin's approval), and the
// reconciliation view (match payments with gateway / bank statements).
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Scale } from 'lucide-react';
import { api } from '../../lib/api';
import { useStore } from '../../store/AppStore';
import { Alert, Badge, Button, DataTable, Field, Input, KpiCard, Modal, RadioCards, Section, Textarea, useToast } from '../../components/ui';
import { dateTime, tzs, tzsShort } from '../../utils/format';

/** Request a refund ('refund') or an adjustment ('adjustment') on a payment. */
export function PaymentRequestModal({ payment, type, onClose }) {
  const toast = useToast();
  const refunded = Number(payment.refundedAmount) || 0;
  const left = (Number(payment.total) || 0) - refunded;
  const [d, setD] = useState({ amount: type === 'refund' ? String(left) : '', kind: payment.status === 'success' ? 'correction' : 'mark_paid', statementRef: '', reason: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api('POST', '/admin/approvals', { type, paymentId: payment.id, reason: d.reason, ...(type === 'refund' ? { amount: Number(d.amount) } : { kind: d.kind, statementRef: d.statementRef, ...(d.kind === 'correction' ? { amount: Number(d.amount) } : {}) }) });
      toast('Request sent. It takes effect once another authorised admin approves it (Approvals).');
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
      title={type === 'refund' ? `Request a refund on ${payment.id}` : `Request an adjustment to ${payment.id}`}
      description={`${tzs(payment.total)} · ${payment.method} · ${payment.status}${refunded ? ` · ${tzs(refunded)} already refunded` : ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} loading={busy}>
            Send for approval
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone="info">Refunds and adjustments need a second person: another admin with the matching approval permission must approve it. You can't approve your own request.</Alert>
        {err && <Alert tone="error">{err}</Alert>}
        {type === 'refund' ? (
          <Field label="Amount to refund (TSh)" htmlFor="pr-amt" hint={`Up to ${tzs(left)}.`}>
            <Input id="pr-amt" type="number" inputMode="numeric" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} />
          </Field>
        ) : (
          <>
            <RadioCards
              name="adj-kind"
              columns={payment.status === 'success' ? 2 : 3}
              value={d.kind}
              onChange={(kind) => setD({ ...d, kind })}
              options={[
                ...(payment.status !== 'success' ? [{ value: 'mark_paid', label: 'Mark paid', description: 'Money is on the statement: publish the listing.' }] : []),
                ...(payment.status === 'pending' ? [{ value: 'mark_failed', label: 'Mark failed', description: 'Money never arrived.' }] : []),
                { value: 'correction', label: 'Correct the amount', description: 'Record a difference (+ or −).' },
              ]}
            />
            {d.kind === 'correction' && (
              <Field label="Correction (TSh)" htmlFor="pr-adj" hint="Negative to reduce, e.g. -5000.">
                <Input id="pr-adj" type="number" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} />
              </Field>
            )}
            <Field label="Statement reference" htmlFor="pr-ref" optional hint="Bank or gateway statement line that proves it.">
              <Input id="pr-ref" value={d.statementRef} onChange={(e) => setD({ ...d, statementRef: e.target.value })} />
            </Field>
          </>
        )}
        <Field label="Reason" htmlFor="pr-reason" required hint="The approver sees this.">
          <Textarea id="pr-reason" rows={3} value={d.reason} onChange={(e) => setD({ ...d, reason: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

/** Day-by-day totals; select successful payments and record that they match a statement. */
export function Reconciliation() {
  const { can, refresh } = useStore();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState([]);
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () =>
    api('GET', '/admin/reconciliation')
      .then((r) => {
        setData(r);
        setPicked([]);
      })
      .catch((e) => toast(e.message, { tone: 'error' }));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const open = useMemo(() => (data?.payments || []).filter((p) => p.status === 'success' && !p.reconciledAt), [data]);
  const sum = (rows, k) => rows.reduce((n, r) => n + (Number(r[k]) || 0), 0);
  const pickedTotal = open.filter((p) => picked.includes(p.id)).reduce((n, p) => n + (Number(p.adjustedTotal ?? p.total) || 0) - (Number(p.refundedAmount) || 0), 0);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api('POST', '/admin/reconciliation', { paymentIds: picked, statementRef: ref, note });
      toast(`${r.batch.count} payment(s) reconciled against ${r.batch.statementRef}.`);
      setRef('');
      setNote('');
      load();
      refresh().catch(() => {});
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  if (!data) return <p className="text-sm text-mist-500">Loading…</p>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Collected (30 days)" value={tzsShort(sum(data.days, 'gross'))} icon={Scale} tone="green" />
        <KpiCard label="Refunded" value={tzsShort(sum(data.days, 'refunds'))} icon={Scale} tone="red" />
        <KpiCard label="Net" value={tzsShort(sum(data.days, 'net'))} icon={Scale} />
        <KpiCard label="Not reconciled yet" value={open.length} icon={CheckCircle2} tone={open.length ? 'amber' : 'green'} />
      </div>
      <Section title="By day" bodyClass="p-0">
        <DataTable
          rowKey="date"
          rows={data.days}
          pageSize={10}
          columns={[
            { key: 'date', header: 'Day' },
            { key: 'success', header: 'Paid', align: 'right' },
            { key: 'gross', header: 'Collected', align: 'right', render: (d) => tzs(d.gross) },
            { key: 'refunds', header: 'Refunds', align: 'right', render: (d) => (d.refunds ? tzs(d.refunds) : '—') },
            { key: 'net', header: 'Net', align: 'right', render: (d) => <b>{tzs(d.net)}</b> },
            { key: 'pending', header: 'Pending / failed', align: 'right', render: (d) => `${d.pending} / ${d.failed}` },
            { key: 'rec', header: 'Reconciled', align: 'right', render: (d) => (d.unreconciled ? <Badge tone="amber">{d.reconciled}/{d.success}</Badge> : <Badge tone="green">All</Badge>) },
          ]}
        />
      </Section>
      {can('payments.reconcile') && (
        <Section title="Match payments with a statement" description="Tick the payments that appear on the gateway settlement or bank statement, then record its reference.">
          {open.length ? (
            <>
              <div className="max-h-80 overflow-y-auto rounded-xl border border-mist-200">
                <label className="flex items-center gap-3 border-b border-mist-100 bg-mist-50 px-3 py-2 text-[13px] font-semibold">
                  <input type="checkbox" checked={picked.length === open.length} onChange={(e) => setPicked(e.target.checked ? open.map((p) => p.id) : [])} /> Select all ({open.length})
                </label>
                {open.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 border-b border-mist-100 px-3 py-2 text-[13px] last:border-0">
                    <input type="checkbox" checked={picked.includes(p.id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p.id] : x.filter((i) => i !== p.id)))} />
                    <span className="w-28 font-mono">{p.id}</span>
                    <span className="w-40 font-mono text-[12px] text-mist-500">{p.gatewayRef}</span>
                    <span className="flex-1 text-mist-600">{dateTime(p.createdAt)} · {p.method}</span>
                    <b className="num">{tzs((Number(p.adjustedTotal ?? p.total) || 0) - (Number(p.refundedAmount) || 0))}</b>
                  </label>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Statement / settlement reference" htmlFor="rc-ref">
                  <Input id="rc-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. NMB-STMT-2026-11-14" />
                </Field>
                <Field label="Note" htmlFor="rc-note" optional>
                  <Input id="rc-note" value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <Button onClick={save} loading={busy} disabled={!picked.length || ref.trim().length < 2}>
                  Reconcile {picked.length || ''} · {tzs(pickedTotal)}
                </Button>
              </div>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-ok-700">
              <CheckCircle2 className="h-4 w-4" /> Every successful payment in this period is reconciled.
            </p>
          )}
        </Section>
      )}
      <Section title="Reconciliation records" bodyClass="p-0">
        <DataTable
          rowKey="id"
          rows={data.batches}
          empty="No reconciliations recorded yet."
          columns={[
            { key: 'at', header: 'When', render: (b) => dateTime(b.at) },
            { key: 'by', header: 'By' },
            { key: 'statementRef', header: 'Statement', render: (b) => <span className="font-mono text-[12.5px]">{b.statementRef}</span> },
            { key: 'count', header: 'Payments', align: 'right' },
            { key: 'total', header: 'Total', align: 'right', render: (b) => tzs(b.total) },
            { key: 'note', header: 'Note' },
          ]}
        />
      </Section>
    </div>
  );
}


