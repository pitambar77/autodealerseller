// Admin → Configuration → Cities: the cities and towns shown in every city picker (registration,
// listing a vehicle, account, search filters). Add one and people there can sign up and list at once.
import { useEffect, useMemo, useState } from 'react';
import { MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Badge, Button, Checkbox, ConfirmDialog, Field, Input, Modal, Section, Toggle, useToast } from '../../components/ui';
import { api } from '../../lib/api';

function CityEditor({ city, onClose, onSaved }) {
  const toast = useToast();
  const [d, setD] = useState({ name: city.name, region: city.region || '', zanzibar: !!city.zanzibar });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (d.name.trim().length < 2) return setErr('Enter the city or town name');
    setSaving(true);
    try {
      const r = await api('PATCH', `/admin/cities/${encodeURIComponent(city.name)}`, { name: d.name.trim(), region: d.region.trim(), zanzibar: d.zanzibar });
      onSaved(r);
      toast(d.name.trim() !== city.name ? `Renamed to ${d.name.trim()}. Its listings and accounts moved too.` : `${city.name} updated.`);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${city.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="City or town" htmlFor="ce-name" error={err} hint={city.listings + city.accounts ? `Renaming moves its ${city.listings} listing(s) and ${city.accounts} account(s) to the new name.` : undefined}>
          <Input id="ce-name" value={d.name} onChange={(e) => (setD({ ...d, name: e.target.value }), setErr(''))} error={err} />
        </Field>
        <Field label="Region" htmlFor="ce-region" optional hint="Shown next to addresses, e.g. Moshi is in Kilimanjaro region.">
          <Input id="ce-region" value={d.region} onChange={(e) => setD({ ...d, region: e.target.value })} />
        </Field>
        <Checkbox label="In Zanzibar (registration numbers start with Z)" checked={d.zanzibar} onChange={(e) => setD({ ...d, zanzibar: e.target.checked })} />
      </div>
    </Modal>
  );
}

export function CitiesManager() {
  const { setConfig } = useStore();
  const toast = useToast();
  const [cities, setCities] = useState(null);
  const [add, setAdd] = useState({ name: '', region: '', zanzibar: false });
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  const apply = (r) => {
    setCities(r.cities);
    setConfig(r.config); // every city picker on the site updates at once
  };
  useEffect(() => {
    api('GET', '/admin/cities').then(apply).catch((e) => toast(e.message, { tone: 'error' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addCity = async (e) => {
    e.preventDefault();
    if (add.name.trim().length < 2) return setAddErr('Enter the city or town name');
    setAdding(true);
    try {
      apply(await api('POST', '/admin/cities', { name: add.name.trim(), region: add.region.trim(), zanzibar: add.zanzibar }));
      toast(`${add.name.trim()} added. People can now pick it when they register or list a vehicle.`);
      setAdd({ name: '', region: '', zanzibar: false });
    } catch (err) {
      setAddErr(err.message);
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (c) => {
    try {
      apply(await api('PATCH', `/admin/cities/${encodeURIComponent(c.name)}`, { enabled: !c.enabled }));
      toast(c.enabled ? `${c.name} is hidden from forms. Its listings and accounts keep it.` : `${c.name} is shown in forms again.`, { tone: 'info' });
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };

  const shown = useMemo(() => (cities || []).filter((c) => !q || `${c.name} ${c.region}`.toLowerCase().includes(q.toLowerCase())), [cities, q]);
  const onCount = (cities || []).filter((c) => c.enabled).length;

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Cities and towns
        </span>
      }
      description="The places people can choose when they register, list a vehicle or search. Add a city and it appears in every form straight away."
      bodyClass="p-0"
    >
      <form onSubmit={addCity} className="grid gap-3 border-b border-mist-100 bg-mist-50/60 px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="New city or town" htmlFor="ct-name" error={addErr}>
          <Input id="ct-name" value={add.name} onChange={(e) => (setAdd({ ...add, name: e.target.value }), setAddErr(''))} placeholder="e.g. Shinyanga" error={addErr} />
        </Field>
        <Field label="Region" htmlFor="ct-region" optional>
          <Input id="ct-region" value={add.region} onChange={(e) => setAdd({ ...add, region: e.target.value })} placeholder="Same as the city if empty" />
        </Field>
        <Button type="submit" icon={Plus} loading={adding} className="sm:mb-[1px]">
          Add city
        </Button>
        <div className="sm:col-span-3">
          <Checkbox label="In Zanzibar" checked={add.zanzibar} onChange={(e) => setAdd({ ...add, zanzibar: e.target.checked })} />
        </div>
      </form>

      {!cities ? (
        <p className="p-5 text-sm text-mist-500">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
            <p className="text-[13px] text-mist-600">
              <b className="text-ink-900">{onCount}</b> shown in forms · {cities.length - onCount} switched off
            </p>
            {cities.length > 8 && (
              <Input aria-label="Find a city" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a city" prefix={<Search className="h-4 w-4" />} className="h-9 w-48 text-[13px]" />
            )}
          </div>
          <ul className="mt-2 grid md:grid-cols-2 md:gap-x-6 md:px-0">
            {shown.map((c) => (
              <li key={c.name} className="flex items-center gap-3 border-t border-mist-100 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                    {c.name}
                    {c.zanzibar && <Badge tone="info">Zanzibar</Badge>}
                    {!c.enabled && <Badge>Hidden</Badge>}
                  </p>
                  <p className="text-[12.5px] text-mist-500 num">
                    {c.region && c.region !== c.name ? `${c.region} region · ` : ''}
                    {c.listings} listing{c.listings === 1 ? '' : 's'} · {c.accounts} account{c.accounts === 1 ? '' : 's'}
                  </p>
                </div>
                <Toggle id={`ct-on-${c.name}`} label={<span className="sr-only">{c.enabled ? `Hide ${c.name}` : `Show ${c.name}`}</span>} checked={c.enabled} onChange={() => toggle(c)} />
                <button type="button" className="btn-icon" aria-label={`Edit ${c.name}`} title="Edit" onClick={() => setEditing(c)}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" className="btn-icon text-bad-600" aria-label={`Remove ${c.name}`} title="Remove" onClick={() => setRemoving(c)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-5 py-4 text-sm text-mist-500">No city matches “{q}”.</li>}
          </ul>
        </>
      )}

      {editing && <CityEditor city={editing} onClose={() => setEditing(null)} onSaved={apply} />}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        message={removing && removing.listings + removing.accounts ? `${removing.name} has listings or accounts, so it can't be removed. Switch it off instead to hide it from forms.` : 'It disappears from every city picker. You can add it again later.'}
        confirmLabel="Remove"
        tone="danger"
        onConfirm={async () => {
          try {
            apply(await api('DELETE', `/admin/cities/${encodeURIComponent(removing.name)}`));
            toast(`${removing.name} removed.`);
          } catch (e) {
            toast(e.message, { tone: 'error', title: "Couldn't remove" });
          }
        }}
      />
    </Section>
  );
}
