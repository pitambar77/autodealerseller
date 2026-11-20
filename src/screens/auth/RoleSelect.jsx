import { useState } from 'react';
import { useNavigate, Link } from '@/lib/router';
import { ArrowRight, Building2, Car, Check, Handshake, Heart, Search } from 'lucide-react';
import { Button } from '../../components/ui';
import { cn } from '../../utils/format';

export const ROLE_CARDS = [
  {
    role: 'seller',
    icon: Car,
    title: 'Private seller',
    desc: 'You are selling your own car, motorcycle or other vehicle.',
    points: ['One active listing at a time', 'Personal ID required', 'Buyers contact you directly'],
  },
  {
    role: 'agent',
    icon: Handshake,
    title: 'Agent',
    desc: 'You sell vehicles on behalf of their owners.',
    points: ['List for multiple owners', 'ID + owner authorisation', 'Owner → buyer handover tracker'],
  },
  {
    role: 'dealer',
    icon: Building2,
    title: 'Dealer',
    desc: 'You run a showroom or used-vehicle business.',
    points: ['List as many vehicles as you stock', 'Business certificate required', 'Lead inbox and performance charts'],
  },
];

export default function RoleSelect() {
  const [role, setRole] = useState('');
  const nav = useNavigate();
  return (
    <div>
      <p className="eyebrow">Create your account</p>
      <h1 className="mt-2 text-[28px] font-bold leading-tight">Are you buying or selling?</h1>
      <p className="mt-1.5 text-mist-600">Accounts are free. Each account has one type, so pick the one that fits.</p>

      {/* Buyers: a large, separate option so it's found at a glance */}
      <Link
        to="/register/buyer"
        className="group mt-6 block rounded-2xl border-2 border-sun-500 bg-sun-50 p-5 transition hover:shadow-lift sm:p-6"
      >
        <span className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sun-500 text-ink-950">
          <Search className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[20px] font-bold leading-tight text-ink-900">I'm buying a vehicle</span>
          <span className="mt-1 block text-[14.5px] text-mist-700">Save vehicles, compare them, get price alerts and contact sellers directly.</span>
          <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-mist-600">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> Saved vehicles on every device
            </span>
            <span>· Free, no documents needed</span>
          </span>
        </span>
        </span>
        <span className="btn btn-lg btn-dark mt-4 w-full">
          Create buyer account <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>

      <div className="mt-8 flex items-center gap-3">
        <span className="h-px flex-1 bg-mist-200" />
        <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-mist-500">I'm selling</p>
        <span className="h-px flex-1 bg-mist-200" />
      </div>
      <div className="mt-4 space-y-3" role="radiogroup" aria-label="Seller account type">
        {ROLE_CARDS.map((c) => (
          <button
            key={c.role}
            type="button"
            role="radio"
            aria-checked={role === c.role}
            onClick={() => setRole(c.role)}
            onDoubleClick={() => nav(`/register/${c.role}`)}
            className={cn('flex w-full items-start gap-4 rounded-xl border bg-white p-4 text-left transition', role === c.role ? 'border-accent-500 ring-2 ring-accent-100' : 'border-mist-200 hover:border-mist-300')}
          >
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', role === c.role ? 'bg-accent-600 text-white' : 'bg-mist-100 text-ink-800')}>
              <c.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-[16px] font-bold text-ink-900">{c.title}</span>
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border', role === c.role ? 'border-accent-600 bg-accent-600 text-white' : 'border-mist-300')}>{role === c.role && <Check className="h-3 w-3" strokeWidth={3} />}</span>
              </span>
              <span className="block text-sm text-mist-600">{c.desc}</span>
              <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {c.points.map((p) => (
                  <span key={p} className="text-[12.5px] text-mist-500">
                    · {p}
                  </span>
                ))}
              </span>
            </span>
          </button>
        ))}
      </div>
      <Button size="lg" className="mt-6 w-full" disabled={!role} iconRight={ArrowRight} onClick={() => nav(`/register/${role}`)}>
        {role ? `Continue as ${ROLE_CARDS.find((c) => c.role === role).title.toLowerCase()}` : 'Choose a seller account type'}
      </Button>
      <div className="mt-6 border-t border-mist-100 pt-5 text-center text-sm text-mist-600">
        Already registered?{' '}
        <Link to="/signin" className="font-semibold text-accent-700 hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
