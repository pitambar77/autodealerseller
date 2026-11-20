// Devices signed in to my account, with "sign out" per device and for all other devices.
import { useEffect, useState } from 'react';
import { Laptop, Smartphone } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Button, useToast } from '../ui';
import { dateTime } from '../../utils/format';

/** "Chrome on Windows" from a browser's user-agent text. */
export function deviceName(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /node|curl|undici/i.test(ua) ? 'App / script' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone / iPad' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}
const mobile = (ua = '') => /Android|iPhone|iPad|Mobile/.test(ua);

export function SessionsList() {
  const toast = useToast();
  const [list, setList] = useState(null);
  const load = () => api('GET', '/me/sessions').then((r) => setList(r.sessions)).catch(() => setList([]));
  useEffect(() => {
    load();
  }, []);
  const end = async (id) => {
    try {
      await (id ? api('DELETE', `/me/sessions/${id}`) : api('POST', '/me/sessions/revoke'));
      toast(id ? 'That device was signed out.' : 'Signed out of all other devices.', { tone: 'info' });
      load();
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };
  if (!list) return <p className="text-sm text-mist-500">Loading…</p>;
  const others = list.filter((s) => !s.current);
  return (
    <div>
      <ul className="divide-y divide-mist-100 rounded-xl border border-mist-200">
        {list.map((s) => {
          const Icon = mobile(s.userAgent) ? Smartphone : Laptop;
          return (
            <li key={s.id} className="flex items-center gap-3 px-3.5 py-3">
              <Icon className="h-5 w-5 shrink-0 text-mist-400" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {deviceName(s.userAgent)} {s.current && <Badge tone="green">This device</Badge>}
                </p>
                <p className="text-[12.5px] text-mist-500 num">
                  {s.ip || 'Unknown network'} · active {dateTime(s.lastSeenAt)} · signed in {dateTime(s.createdAt)}
                </p>
              </div>
              {!s.current && (
                <Button size="sm" variant="secondary" onClick={() => end(s.id)}>
                  Sign out
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {others.length > 0 && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => end(null)}>
          Sign out all other devices ({others.length})
        </Button>
      )}
    </div>
  );
}
