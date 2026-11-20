import { useState } from 'react';
import { CloudUpload, Image as ImageIcon, Globe, KeyRound, Mail, MessageSquareText, PlugZap, Radio, Scale, Search, Wallet } from 'lucide-react';
import { useEffect } from 'react';
import { api, fileToDataUrl } from '../../lib/api';
import { LoanProviders } from './LoanProviders';
import { CITIES } from '../../data/catalog';
import { cityPhoto } from '../../data/cityPhotos';
import { useStore } from '../../store/AppStore';
import { Alert, Badge, Button, Field, Input, PageHeader, PhoneInput, Section, Toggle, useToast } from '../../components/ui';

/** Save / reset buttons shown when a section has unsaved changes. */
function SaveBar({ dirty, onSave, onReset, onTest, testing }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-mist-100 pt-4">
      {onTest && (
        <Button variant="ghost" icon={PlugZap} onClick={onTest} loading={testing} className="mr-auto">
          Test connection
        </Button>
      )}
      <Button variant="secondary" disabled={!dirty} onClick={onReset}>
        Discard
      </Button>
      <Button disabled={!dirty} onClick={onSave}>
        Save
      </Button>
    </div>
  );
}

const POLICY_KEYS = ['agentAuthorizationRequired', 'listingValidityDays', 'defaultInterestRate', 'sellerListingLimit', 'featuredDays'];
const pickPolicy = (c) => ({ ...Object.fromEntries(POLICY_KEYS.map((k) => [k, c[k]])), sellerListingLimit: c.sellerListingLimit ?? 0, featuredDays: c.featuredDays ?? 7 });

const SERVICE_INFO = {
  storage: { icon: CloudUpload, label: 'Photo & document storage', names: { local: 'This server (local disk)', cloudinary: 'Cloudinary' }, env: 'STORAGE_DRIVER, CLOUDINARY_URL' },
  sms: { icon: MessageSquareText, label: 'SMS (codes and alerts)', names: { console: 'Not connected (printed in the log)', beem: 'Beem Africa', africastalking: "Africa's Talking", twilio: 'Twilio' }, env: 'SMS_PROVIDER + provider keys' },
  email: { icon: Mail, label: 'Email', names: { console: 'Not connected (printed in the log)', smtp: 'SMTP' }, env: 'EMAIL_PROVIDER, SMTP_*' },
  live: { icon: Radio, label: 'Live updates', names: { memory: 'Built in (one API server)', redis: 'Redis (several API servers)' }, env: 'REDIS_URL' },
  payments: { icon: Wallet, label: 'Payments', names: { mock: 'Simulated (test mode)' }, env: 'PAYMENT_PROVIDER' },
  vehicleLookup: { icon: Search, label: 'TRA vehicle lookup', names: { none: 'Off: sellers type details', mock: 'Sample records (demo)', tra: 'TRA API' }, env: 'VEHICLE_LOOKUP_PROVIDER' },
};

/** What the API is actually connected to (from its .env), with test buttons. */
function ConnectedServices() {
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [to, setTo] = useState({ sms: '', email: '' });
  const [busy, setBusy] = useState('');
  useEffect(() => {
    api('GET', '/admin/integrations').then(setInfo).catch((e) => setInfo({ error: e.message }));
  }, []);
  const test = async (service) => {
    setBusy(service);
    try {
      const r = await api('POST', '/admin/integrations/test', { service, to: to[service] });
      toast(r.message, { title: 'Test passed' });
    } catch (e) {
      toast(e.message, { tone: 'error', title: 'Test failed' });
    } finally {
      setBusy('');
    }
  };
  if (!info) return <Section title="Connected services"><p className="text-sm text-mist-500">Checking…</p></Section>;
  if (info.error) return <Alert tone="error" title="Couldn't read the service status">{info.error}</Alert>;
  const value = { storage: info.storage.driver, sms: info.sms.provider, email: info.email.provider, live: info.live.mode, payments: info.payments.provider, vehicleLookup: info.vehicleLookup.provider };
  const ok = { storage: info.storage.ready, sms: info.sms.provider !== 'console', email: info.email.provider !== 'console' && info.email.ready, live: true, payments: info.payments.provider !== 'mock', vehicleLookup: info.vehicleLookup.provider === 'tra' };
  return (
    <Section title={<span className="flex items-center gap-2"><PlugZap className="h-4 w-4" /> Connected services</span>} description="Set in the API's environment (.env) — see SETUP.md in the API folder. Restart the API after changing them.">
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(SERVICE_INFO).map(([k, m]) => (
          <li key={k} className="rounded-xl border border-mist-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <m.icon className="h-4 w-4 text-mist-500" /> {m.label}
              </span>
              <Badge tone={ok[k] ? 'green' : 'amber'} dot>{ok[k] ? 'Connected' : k === 'live' ? 'On' : 'Not live'}</Badge>
            </div>
            <p className="mt-1.5 text-[13.5px] text-ink-800">{m.names[value[k]] || value[k]}</p>
            {k === 'storage' && info.storage.cloud && <p className="text-[12px] text-mist-500">Cloud “{info.storage.cloud}” · folder {info.storage.folder}</p>}
            {k === 'storage' && info.storage.error && <p className="text-[12px] text-bad-600">{info.storage.error}</p>}
            {k === 'live' && <p className="text-[12px] text-mist-500">{info.live.connections} open page{info.live.connections === 1 ? '' : 's'} connected now</p>}
            {k === 'sms' && <p className="text-[12px] text-mist-500">Enquiry and reply alerts by SMS: {info.sms.notifications ? 'on' : 'off'}</p>}
            {k === 'email' && <p className="truncate text-[12px] text-mist-500">From {info.email.from}</p>}
            <p className="mt-1 font-mono text-[11px] text-mist-400">{m.env}</p>
            {(k === 'sms' || k === 'email') && (
              <div className="mt-3 flex gap-2">
                {k === 'sms' ? (
                  <PhoneInput id="cs-sms-to" value={to.sms} onChange={(v) => setTo({ ...to, sms: v })} className="min-w-0 flex-1" />
                ) : (
                  <Input aria-label="Email address for a test email" placeholder="you@example.com" value={to.email} onChange={(e) => setTo({ ...to, email: e.target.value })} className="h-9 text-[13px]" />
                )}
                <Button size="sm" variant="secondary" loading={busy === k} onClick={() => test(k)}>
                  Send test
                </Button>
              </div>
            )}
            {k === 'storage' && (
              <Button size="sm" variant="secondary" className="mt-3" loading={busy === 'storage'} onClick={() => test('storage')}>
                Test upload
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function CityThumb({ url, city }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="px-2 text-center text-[12px] text-mist-500">Photo couldn't load. Upload your own.</span>;
  return <img src={url} alt={city} className="h-full w-full object-cover" loading="lazy" onError={() => setBroken(true)} />;
}

/** Photos on the Dealers page's city tiles: upload a real photo for any city, or go back to the default. */
export function CityPhotos() {
  const { state, setCityPhoto } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const dealerCities = new Set(state.users.filter((u) => u.role === 'dealer').map((u) => u.city));
  const cities = [...new Set([...CITIES.map((c) => c.name), ...dealerCities])].filter(Boolean);
  const save = async (city, file) => {
    if (file && !/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Use a JPG, PNG or WebP photo.', { tone: 'error' });
    if (file && file.size > 5 * 1048576) return toast('Keep the photo under 5 MB.', { tone: 'error' });
    setBusy(city);
    try {
      await setCityPhoto(city, file ? await fileToDataUrl(file) : null);
      toast(file ? `Photo of ${city} updated.` : `${city} is back to its default photo.`);
    } catch (e) {
      toast(e.message, { tone: 'error', title: "Couldn't save" });
    } finally {
      setBusy('');
    }
  };
  return (
    <Section title={<span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> City photos</span>} description="Shown on the city tiles of the Dealers page. Upload a wide photo (at least 640 px) to replace the default, for example your own photo of the city.">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {cities.map((city) => {
          const photo = cityPhoto(city, state.config);
          const own = !!state.config.cityImages?.[city];
          return (
            <li key={city} className="overflow-hidden rounded-xl border border-mist-200">
              <div className="relative flex aspect-[16/10] items-center justify-center bg-mist-100">
                {photo ? <CityThumb url={photo.url} city={city} /> : <span className="text-[12px] text-mist-500">No photo yet</span>}
                {own && <Badge tone="green" className="absolute left-1.5 top-1.5">Your photo</Badge>}
              </div>
              <div className="p-2.5">
                <p className="truncate text-[13px] font-semibold">
                  {city}
                  {dealerCities.has(city) && <span className="font-normal text-mist-500"> · has dealers</span>}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  <label className="cursor-pointer text-[12.5px] font-semibold text-accent-700 hover:underline">
                    {busy === city ? 'Saving…' : photo ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={!!busy}
                      aria-label={`Upload a photo of ${city}`}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) save(city, f);
                      }}
                    />
                  </label>
                  {own && (
                    <button type="button" className="text-[12.5px] font-semibold text-mist-600 hover:underline" disabled={!!busy} onClick={() => save(city, null)}>
                      Use default
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// Which settings each permission covers (the API checks the same).
const POLICY_PERM = { agentAuthorizationRequired: 'config.manage', listingValidityDays: 'config.manage', sellerListingLimit: 'config.manage', featuredDays: 'config.manage', defaultInterestRate: 'finance.settings' };

export default function AdminSettings() {
  const { state, updateConfig, can } = useStore();
  const rules = can('config.manage');
  const toast = useToast();
  const [ver, setVer] = useState({ name: state.config.verificationPortalName, url: state.config.verificationPortalUrl });
  const [verErr, setVerErr] = useState('');
  const [policy, setPolicy] = useState(pickPolicy(state.config));

  const saveVer = () => {
    try {
      const u = new URL(ver.url);
      if (u.protocol !== 'https:') throw new Error('https');
    } catch {
      setVerErr('Enter a full https:// address for the official portal');
      return;
    }
    setVerErr('');
    updateConfig({ verificationPortalName: ver.name, verificationPortalUrl: ver.url });
    toast('Verification link updated. Buyers see it on the verification page.');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Platform configuration" description="Connected services, policies and official links. Changes are recorded in the activity log." />
      {can('system.integrations') && <ConnectedServices />}

      {rules && (
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title={<span className="flex items-center gap-2"><Globe className="h-4 w-4" /> Official verification link</span>} description="Where buyers are sent to check a registration. Verification happens on that external site.">
          <div className="space-y-4">
            <Field label="Portal name" htmlFor="ver-name">
              <Input id="ver-name" value={ver.name} onChange={(e) => setVer({ ...ver, name: e.target.value })} />
            </Field>
            <Field label="Portal URL" htmlFor="ver-url" error={verErr}>
              <Input id="ver-url" type="url" value={ver.url} onChange={(e) => setVer({ ...ver, url: e.target.value })} error={verErr} className="font-mono text-[13px]" />
            </Field>
          </div>
          <SaveBar dirty={ver.name !== state.config.verificationPortalName || ver.url !== state.config.verificationPortalUrl} onSave={saveVer} onReset={() => setVer({ name: state.config.verificationPortalName, url: state.config.verificationPortalUrl })} />
        </Section>
      </div>
      )}

      {can('finance.settings') && <LoanProviders />}

      {(rules || can('finance.settings')) && (
      <Section title={<span className="flex items-center gap-2"><Scale className="h-4 w-4" /> Marketplace policies</span>}>
        <div>
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div className={rules ? '' : 'pointer-events-none opacity-60'}>
          <Toggle
            id="pol-auth"
            label="Require owner authorisation for agents"
            description="When on, agents must upload a signed owner letter before an agent listing can be paid for and published."
            checked={policy.agentAuthorizationRequired}
            onChange={(v) => setPolicy({ ...policy, agentAuthorizationRequired: v })}
          />
          </div>
          <Field label="Listing validity" htmlFor="pol-days" hint="Days a paid listing stays live">
            <Input id="pol-days" disabled={!rules} type="number" min={7} max={180} suffix="days" value={policy.listingValidityDays} onChange={(e) => setPolicy({ ...policy, listingValidityDays: Number(e.target.value) })} />
          </Field>
          <Field label="Default EMI interest rate" htmlFor="pol-rate" hint={can('finance.settings') ? 'Pre-filled on the loan calculator' : 'Set by Finance'}>
            <Input id="pol-rate" type="number" step="0.05" suffix="% p.a." value={policy.defaultInterestRate} disabled={!can('finance.settings')} onChange={(e) => setPolicy({ ...policy, defaultInterestRate: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="mt-6 grid gap-6 border-t border-mist-100 pt-6 lg:grid-cols-[1.3fr_1fr_1fr]">
          <Field label="Private seller listing limit" htmlFor="pol-limit" hint="Active listings a private seller can have at once. 0 means no limit.">
            <Input id="pol-limit" disabled={!rules} type="number" min={0} max={500} suffix="listings" value={policy.sellerListingLimit} onChange={(e) => setPolicy({ ...policy, sellerListingLimit: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
          </Field>
          <Field label="Featured boost length" htmlFor="pol-feat" hint={'How long "Feature this listing" lasts'}>
            <Input id="pol-feat" disabled={!rules} type="number" min={1} max={90} suffix="days" value={policy.featuredDays} onChange={(e) => setPolicy({ ...policy, featuredDays: Number(e.target.value) })} />
          </Field>
        </div>
        </div>
        <SaveBar
          dirty={Object.keys(policy).some((k) => policy[k] !== pickPolicy(state.config)[k])}
          onSave={() => {
            // Send only what changed and what this role may change.
            const saved = pickPolicy(state.config);
            updateConfig(Object.fromEntries(Object.entries(policy).filter(([k, v]) => v !== saved[k] && can(POLICY_PERM[k]))));
            toast('Policies saved.');
          }}
          onReset={() => setPolicy(pickPolicy(state.config))}
        />
      </Section>
      )}
      <p className="flex items-center gap-2 text-[12.5px] text-mist-500">
        <KeyRound className="h-4 w-4" /> Service keys live in the API's environment (.env), never in the browser. Rotate them every 90 days.
      </p>
    </div>
  );
}
