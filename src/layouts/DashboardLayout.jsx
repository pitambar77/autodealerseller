import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from '@/lib/router';
import { ChevronDown, ExternalLink, LogOut, Menu, Search, UserCog, X } from 'lucide-react';
import { Logo } from '../components/layout/Brand';
import { Avatar, Breadcrumbs } from '../components/ui';
import { useStore } from '../store/AppStore';
import { NAV } from '../routes/nav';
import { StyleToggle } from '../store/StyleContext';
import { ROLE_META } from '../config/site';
import { NotificationBell } from '../components/layout/NotificationBell';
import { unreadFor } from '../utils/messages';
import { cn } from '../utils/format';

function SideNav({ items, badges, onNavigate }) {
  const loc = useLocation();
  return (
    <nav className="-mr-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1" aria-label="Dashboard">
      {items.map((it) => {
        const extra = it.match?.some((m) => loc.pathname.startsWith(m));
        return (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-semibold transition-colors',
                isActive || extra ? 'bg-white/10 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white',
              )
            }
          >
            <it.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
            <span className="flex-1 truncate">{it.label}</span>
            {it.badge && badges[it.badge] > 0 && <span className="rounded-full bg-accent-500 px-1.5 py-px text-[11px] font-bold text-white num">{badges[it.badge]}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout() {
  const { state, me, role, logout, can, member, memberCan } = useStore();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(false);
  const [q, setQ] = useState('');
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    setOpen(false);
    setProfile(false);
  }, [loc.pathname]);

  // Only what this person can use: admin staff by role permissions, dealership staff by what the owner allowed.
  const items = (NAV[role] || []).filter((it) => {
    if (it.perm && !it.perm.some((p) => can(p))) return false;
    if (it.owner && member) return false;
    if (it.team && member && ![].concat(it.team).some((p) => memberCan(p))) return false;
    return true;
  });
  const badges = useMemo(
    () => ({
      docs: state.documents.filter((d) => d.status === 'pending').length,
      approvals: state.approvalsWaiting || 0,
      flags: state.vehicles.filter((v) => v.verification === 'flagged' || v.status === 'blocked_duplicate').length,
      // Conversations with unread messages
      messages: state.enquiries.filter((e) => (role === 'buyer' ? e.buyerId === me?.id && unreadFor(e, 'buyer') : e.sellerId === me?.id && unreadFor(e, 'seller'))).length,
    }),
    [state.documents, state.vehicles, state.enquiries, role, me?.id],
  );
  const current = [...items].sort((a, b) => b.to.length - a.to.length).find((i) => loc.pathname === i.to || loc.pathname.startsWith(`${i.to}/`) || i.match?.some((m) => loc.pathname.startsWith(m)));
  const crumbs = [{ label: ROLE_META[role]?.label || 'Account', to: ROLE_META[role]?.home }, ...(current && current.to !== ROLE_META[role]?.home ? [{ label: current.label }] : [])];

  const sidebar = (
    <div className="flex h-full flex-col gap-6 bg-ink-950 px-3 pb-4 pt-5">
      <div className="flex items-center justify-between px-2">
        <Logo dark to={ROLE_META[role]?.home} />
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-300 hover:bg-white/10 lg:hidden" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mx-2 rounded-lg bg-white/5 px-3 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">{ROLE_META[role]?.label} workspace</p>
        <p className="truncate text-sm font-semibold text-white">{me?.business || me?.agency || me?.name}</p>
        {role === 'admin' && <p className="mt-0.5 truncate text-[12px] font-semibold text-sun-400">{state.session?.roleName}</p>}
        {member && <p className="mt-0.5 truncate text-[12px] text-ink-300">Signed in as <span className="font-semibold text-sun-400">{member.name}</span>{member.title ? ` · ${member.title}` : ''}</p>}
      </div>
      <SideNav items={items} badges={badges} onNavigate={() => setOpen(false)} />
      <div className="space-y-1 border-t border-white/10 pt-4">
        {role !== 'admin' && (
          <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-semibold text-ink-300 hover:bg-white/5 hover:text-white">
            <ExternalLink className="h-4 w-4" /> View marketplace
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            logout();
            nav(role === 'admin' ? '/admin/login' : '/');
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-semibold text-ink-300 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-mist-50 lg:pl-[248px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] lg:block" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {sidebar}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[272px] max-w-[85vw] animate-fade-up" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)' }}>
            {sidebar}
          </div>
        </div>
      )}

      <header className="sticky z-20 border-b border-mist-200 bg-white/95 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="dash-gutter flex h-14 items-center gap-3">
          <button type="button" className="btn-icon -ml-1 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Breadcrumbs items={crumbs} className="hidden md:flex" />
          {role === 'admin' && (
            <form
              className="relative ml-auto hidden w-full max-w-xs sm:block"
              onSubmit={(e) => {
                e.preventDefault();
                if (!q.trim()) return;
                const t = q.trim().toLowerCase();
                const v = state.vehicles.find((x) => x.id.toLowerCase() === t || x.regNumber.toLowerCase() === t.replace(/\s/g, ''));
                nav(v ? `/admin/listings/${v.id}` : `/admin/users?q=${encodeURIComponent(q.trim())}`);
                setQ('');
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} className="input h-9 bg-mist-50 pl-9 text-[13px]" placeholder="Search listing ID, reg. no. or user" aria-label="Admin search" />
            </form>
          )}
          <div className={cn('flex items-center gap-1', role !== 'admin' && 'ml-auto')}>
            <StyleToggle className="mr-1" />
            <NotificationBell />
            <div className="relative">
              <button type="button" onClick={() => setProfile((p) => !p)} className="flex items-center gap-2 rounded-full p-0.5 pr-1.5 hover:bg-mist-100" aria-haspopup="menu" aria-expanded={profile}>
                <Avatar name={member?.name || me?.name} size={30} />
                <span className="hidden max-w-[120px] truncate text-[13px] font-semibold sm:block">{member?.name || me?.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-mist-500" />
              </button>
              {profile && (
                <div className="absolute right-0 top-11 w-60 animate-fade-up rounded-xl border border-mist-200 bg-white p-1.5 shadow-pop" role="menu">
                  <div className="px-2.5 py-2">
                    <p className="truncate text-sm font-semibold">{member?.name || me?.name}</p>
                    <p className="truncate text-xs text-mist-500">{member ? `${member.title || 'Team member'} · ${me?.business}` : role === 'admin' ? state.session?.roleName : me?.phone}</p>
                  </div>
                  <Link to="/account" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-mist-100" role="menuitem">
                    <UserCog className="h-4 w-4" /> Account settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      nav(role === 'admin' ? '/admin/login' : '/');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-bad-600 hover:bg-bad-50"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="dash-gutter mx-auto w-full max-w-[1280px] py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
