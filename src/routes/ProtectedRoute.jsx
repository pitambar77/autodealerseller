import { Navigate, Outlet, useLocation } from '@/lib/router';
import { ShieldX } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { Button } from '../components/ui';
import { ROLE_META } from '../config/site';
import { DEMO_USER_IDS } from '../config/demo';
import { ADMIN_PAGE_PERMS, DEALER_PAGE_TEAM } from './nav';

/** Sends visitors to the right sign-in page. The API enforces the same roles on every request. */
export default function ProtectedRoute({ roles }) {
  const { state, role, login, can, member, memberCan } = useStore();
  const loc = useLocation();
  const next = encodeURIComponent(loc.pathname + loc.search);
  if (!role) {
    if (roles.includes('admin')) return <Navigate to={`/admin/login?next=${next}`} replace />;
    if (roles.length === 1 && roles[0] === 'buyer') return <Navigate to={`/buyer/welcome?next=${next}`} replace />;
    return <Navigate to={`/signin?next=${next}${roles.length === 1 ? `&role=${roles[0]}` : ''}`} replace />;
  }
  if (!roles.includes(role)) {
    const target = roles[0];
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="card max-w-md p-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bad-50 text-bad-600">
            <ShieldX className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-bold">This area is for {roles.map((r) => ROLE_META[r].label).join(' / ')} accounts</h1>
          <p className="mt-2 text-sm text-mist-600">You're signed in as {ROLE_META[role].label}. Each account has one role, so private seller, agent and dealer tools stay separate.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" to={ROLE_META[role].home}>
              Go to my dashboard
            </Button>
            {state.demo?.login && <Button onClick={() => login(DEMO_USER_IDS[target]).catch(() => {})}>Switch to demo {ROLE_META[target].label}</Button>}
          </div>
        </div>
      </div>
    );
  }
  // Admin staff: only the sections their role covers. Dealership staff: only what the owner allowed.
  const path = loc.pathname;
  const match = (list) => list.find(([p]) => path === p || path.startsWith(`${p}/`));
  if (role === 'admin') {
    const need = match(ADMIN_PAGE_PERMS)?.[1];
    if (need && !need.some((p) => can(p))) return <NoAccess title="Your admin role doesn't include this section" body={`You're signed in as ${state.session?.roleName || 'staff'}. If you need access, ask the Managing Director to change your role.`} home="/admin" />;
  }
  if (role === 'dealer' && member) {
    const need = match(DEALER_PAGE_TEAM)?.[1];
    if (need && (need === 'owner' || ![].concat(need).some((p) => memberCan(p)))) return <NoAccess title="You don't have access to this" body={`Your dealership hasn't given you access to this part of the account. Ask ${state.users.find((u) => u.id === state.session?.userId)?.name || 'the owner'} if you need it.`} home="/dealer" />;
  }
  return <Outlet />;
}

function NoAccess({ title, body, home }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="card max-w-md p-8 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warn-50 text-warn-700">
          <ShieldX className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-mist-600">{body}</p>
        <Button variant="secondary" to={home} className="mt-6">
          Go to my dashboard
        </Button>
      </div>
    </div>
  );
}
