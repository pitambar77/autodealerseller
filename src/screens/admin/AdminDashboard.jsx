import { useMemo } from 'react';
import { Link } from '@/lib/router';
import { AlertOctagon, Banknote, Car, CheckCheck, CircleDashed, CreditCard, DatabaseBackup, Landmark, Lock, Radio, Users } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Badge, Button, KpiCard, PageHeader, Section } from '../../components/ui';
import { AreaTrend, Bars, Donut, LegendList, Lines, bucket, CHART } from '../../components/charts/Charts';
import { ago, tzs, num, tzsShort } from '../../utils/format';

export default function AdminDashboard() {
  const { state, can } = useStore();
  // Each role sees the numbers for its own area.
  const seeUsers = can('users.view');
  const seeListings = can('listings.view') || can('listings.moderate');
  const seeMoney = can('payments.view') || can('reports.view');
  const seeLoans = can('referrals.view');
  const d = useMemo(() => {
    const users = state.users.filter((u) => u.role !== 'admin');
    const byRole = ['seller', 'agent', 'dealer', 'buyer'].map((r, i) => ({ label: { dealer: 'Dealers', seller: 'Private sellers', agent: 'Agents', buyer: 'Buyers' }[r], value: users.filter((u) => u.role === r).length, color: [CHART.blue, CHART.teal, CHART.navy, CHART.amber][i] }));
    const v = state.vehicles;
    const pays = state.payments;
    const ok = pays.filter((p) => p.status === 'success');
    const listingsTrend = bucket(v, { getDate: (x) => x.createdAt, n: 8, unit: 'week', reducers: { created: (l) => l.length, published: (l) => l.filter((x) => x.publishedAt).length } });
    const regTrend = bucket(users, {
      getDate: (u) => u.registeredAt,
      n: 6,
      unit: 'month',
      reducers: { dealer: (l) => l.filter((u) => u.role === 'dealer').length, seller: (l) => l.filter((u) => u.role === 'seller').length, agent: (l) => l.filter((u) => u.role === 'agent').length, buyer: (l) => l.filter((u) => u.role === 'buyer').length },
    });
    const revTrend = bucket(ok, { getDate: (p) => p.createdAt, n: 8, unit: 'week', reducers: { revenue: (l) => l.reduce((s, p) => s + p.amount, 0) } });
    return {
      users,
      byRole,
      total: v.length,
      live: v.filter((x) => x.status === 'live').length,
      unverified: v.filter((x) => x.status === 'live' && x.verification !== 'verified').length,
      flagged: v.filter((x) => x.verification === 'flagged' || x.status === 'blocked_duplicate' || x.status === 'suspended').length,
      revenue: ok.reduce((s, p) => s + p.amount, 0),
      gst: ok.reduce((s, p) => s + p.gst, 0),
      payStats: ['success', 'failed', 'cancelled', 'pending'].map((s, i) => ({ label: { success: 'Successful', failed: 'Failed', cancelled: 'Cancelled', pending: 'Pending' }[s], value: pays.filter((p) => p.status === s).length, color: [CHART.teal, CHART.rose, CHART.grey, CHART.amber][i] })),
      commission: state.referrals.reduce((s, r) => s + r.commission, 0),
      pipeline: state.referrals.filter((r) => ['referred', 'application', 'sanctioned'].includes(r.status)).reduce((s, r) => s + r.expectedCommission, 0),
      listingsTrend,
      regTrend,
      revTrend,
      pendingDocs: state.documents.filter((x) => x.status === 'pending').length,
    };
  }, [state]);

  const successRate = Math.round((d.payStats[0].value / Math.max(1, d.payStats.reduce((s, x) => s + x.value, 0))) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={state.session?.roleName}
        title="Platform overview"
        description={seeUsers || seeListings || seeMoney ? 'The areas your role looks after.' : 'Your admin workspace.'}
        actions={
          <>
            {can('documents.review') && (
              <Button variant="secondary" to="/admin/documents">
                Review documents ({d.pendingDocs})
              </Button>
            )}
            {state.approvalsWaiting > 0 && (
              <Button icon={CheckCheck} to="/admin/approvals">
                {state.approvalsWaiting} waiting for approval
              </Button>
            )}
            {can('reports.view') && (
              <Button variant={state.approvalsWaiting ? 'secondary' : 'primary'} to="/admin/reports">
                Open reports
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {seeUsers && <KpiCard label="Total users" value={num(d.users.length)} icon={Users} trend={9} sub="vs last month" />}
        {seeListings && <KpiCard label="Listings (total / live)" value={`${d.total} / ${d.live}`} icon={Car} />}
        {seeListings && <KpiCard label="Live but unverified" value={d.unverified} icon={CircleDashed} tone="amber" sub="awaiting document review" />}
        {seeListings && <KpiCard label="Flagged & blocked" value={d.flagged} icon={AlertOctagon} tone="red" sub="needs moderation" />}
        {seeMoney && <KpiCard label="Listing-fee revenue" value={tzsShort(d.revenue)} icon={Banknote} tone="green" sub={`+ ${tzs(d.gst)} VAT collected`} />}
        {seeMoney && <KpiCard label="Payment success rate" value={`${successRate}%`} icon={CreditCard} sub={`${d.payStats[1].value} failed · ${d.payStats[3].value} pending`} />}
        {seeLoans && <KpiCard label="Loan commissions earned" value={tzsShort(d.commission)} icon={Landmark} tone="dark" sub="disbursed referrals" />}
        {seeLoans && <KpiCard label="Commission pipeline" value={tzsShort(d.pipeline)} icon={Radio} sub="if open referrals disburse" />}
        {can('system.security') && <KpiCard label="Security" value="Monitor" icon={Lock} sub="sign-ins, sessions, alerts" />}
        {can('system.backups') && <KpiCard label="Backups" value="Daily" icon={DatabaseBackup} sub="see Backups for history" />}
        <KpiCard label="Waiting for my approval" value={state.approvalsWaiting || 0} icon={CheckCheck} tone={state.approvalsWaiting ? 'amber' : 'default'} />
      </div>

      {(seeListings || seeUsers) && (
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {seeListings && <Section title="Listings created vs published" description="Last 8 weeks">
          <AreaTrend data={d.listingsTrend} series={[{ key: 'created', name: 'Created' }, { key: 'published', name: 'Published (paid)', color: CHART.teal }]} />
        </Section>}
        {seeUsers && <Section title="Users by role">
          <Donut data={d.byRole} height={180} centerValue={d.users.length} centerLabel="users" />
          <div className="mt-4">
            <LegendList data={d.byRole} />
          </div>
        </Section>}
      </div>
      )}

      {(seeUsers || seeMoney) && (
      <div className="grid gap-6 xl:grid-cols-2">
        {seeUsers && <Section title="Registrations by role" description="Last 6 months">
          <Bars stacked data={d.regTrend} series={[{ key: 'seller', name: 'Private sellers', color: CHART.blue }, { key: 'agent', name: 'Agents', color: CHART.teal }, { key: 'dealer', name: 'Dealers', color: CHART.navy }, { key: 'buyer', name: 'Buyers', color: CHART.amber }]} />
        </Section>}
        {seeMoney && <Section title="Listing-fee revenue" description="Excl. VAT, last 8 weeks">
          <Lines money data={d.revTrend} series={[{ key: 'revenue', name: 'Revenue' }]} />
        </Section>}
      </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        {seeMoney && <Section title="Payment outcomes">
          <LegendList data={d.payStats} />
        </Section>}
        <Section title={can('audit.view') ? 'Recent activity' : 'My recent activity'} bodyClass="p-0" actions={<Button size="sm" variant="ghost" to="/admin/activity">Activity log</Button>} className={seeMoney ? '' : 'xl:col-span-2'}>
          {!state.audit.length && <p className="px-5 py-4 text-sm text-mist-500">Nothing yet.</p>}
          <ul className="divide-y divide-mist-100">
            {state.audit.slice(0, 7).map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <Badge tone={a.actorRole === 'admin' ? 'dark' : a.actorRole === 'system' ? 'amber' : 'neutral'} className="hidden w-16 justify-center sm:inline-flex">{a.actorRole === 'admin' ? 'Admin' : a.actorRole === 'system' ? 'System' : 'User'}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-semibold">{a.actor}</span> · {a.action}{' '}
                    {a.entityType === 'listing' ? (
                      <Link to={`/admin/listings/${a.entityId}`} className="font-mono text-[12.5px] text-accent-700 hover:underline">
                        {a.entityId}
                      </Link>
                    ) : (
                      <span className="font-mono text-[12.5px] text-mist-600">{a.entityId}</span>
                    )}
                  </p>
                  {a.note && <p className="truncate text-[12.5px] text-mist-500">{a.note}</p>}
                </div>
                <span className="shrink-0 text-[12px] text-mist-500">{ago(a.at)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
