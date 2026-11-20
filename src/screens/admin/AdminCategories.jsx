// Admin → Vehicle categories. Add, rename, hide, reorder and remove the categories the marketplace
// is organised by. Menus, search, the listing form, filters, listing cards and detail pages all
// follow these settings, so a new category needs no code changes.
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Info, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Alert, Badge, Button, Checkbox, Field, Input, Modal, PageHeader, Section, Segmented, Select, Textarea, Toggle, useToast } from '../../components/ui';
import { ART_KINDS, CATEGORY_ICONS, VEHICLE_TYPES } from '../../data/vehicleTypes';
import { SPEC_FIELDS, SPEC_KEYS } from '../../data/specFields';
import { CarArt } from '../../components/vehicle/CarArt';
import { cn, num, tzsShort } from '../../utils/format';
import { fileToDataUrl } from '../../lib/api';

const lines = (text) => [...new Set(String(text || '').split(/\n|,/).map((x) => x.trim()).filter(Boolean))];
const numbers = (text) => lines(text).map((x) => Number(x.replace(/[^\d.]/g, ''))).filter((x) => x > 0).sort((a, b) => a - b);
const slugify = (t) => t.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const BLANK = {
  name: '',
  singular: '',
  nounPlural: '',
  slug: '',
  icon: 'Car',
  art: 'car',
  tagline: '',
  typeLabel: 'Type',
  types: '',
  fuels: 'Petrol\nDiesel\nElectric',
  transmissions: 'Manual\nAutomatic',
  usage: 'km',
  priceSteps: '5000000, 10000000, 20000000, 40000000, 80000000, 150000000',
  usageSteps: '10000, 50000, 100000, 200000, 500000',
  minPrice: '0',
  maxUsage: '1000000',
  specFields: [],
  features: '',
  makes: '',
  registryTypes: '',
  enabled: true,
  image: null,
  imageData: undefined,
};

/** Form draft from a stored category (lists become one item per line). */
const toDraft = (c) => ({
  ...BLANK,
  ...c,
  types: (c.types || []).join('\n'),
  fuels: (c.fuels || []).join('\n'),
  transmissions: (c.transmissions || []).join('\n'),
  priceSteps: (c.priceSteps || []).join(', '),
  usageSteps: (c.usageSteps || []).join(', '),
  minPrice: String(c.minPrice ?? 0),
  maxUsage: String(c.maxUsage ?? ''),
  features: (c.features || []).join('\n'),
  makes: (c.makes || []).join('\n'),
  registryTypes: (c.registryTypes || []).join('\n'),
  specFields: (c.specFields || []).map((f) => ({ ...f })),
  imageData: undefined,
});

const toPayload = (d) => ({
  name: d.name.trim(),
  singular: d.singular.trim(),
  nounPlural: d.nounPlural.trim(),
  slug: d.slug.trim(),
  icon: d.icon,
  art: d.art,
  tagline: d.tagline.trim(),
  typeLabel: d.typeLabel.trim(),
  types: lines(d.types),
  fuels: lines(d.fuels),
  transmissions: lines(d.transmissions),
  usage: d.usage,
  priceSteps: numbers(d.priceSteps),
  usageSteps: numbers(d.usageSteps),
  minPrice: Number(String(d.minPrice).replace(/[^\d.]/g, '')) || 0,
  maxUsage: Number(String(d.maxUsage).replace(/[^\d.]/g, '')) || 1,
  specFields: d.specFields,
  features: lines(d.features),
  makes: lines(d.makes),
  registryTypes: lines(d.registryTypes),
  enabled: d.enabled,
  ...(d.imageData !== undefined ? { imageData: d.imageData } : {}),
});

const FIELD_IDS = { name: 'ce-name', singular: 'ce-one', nounPlural: 'ce-many', slug: 'ce-slug', typeLabel: 'ce-tl', types: 'ce-types', fuels: 'ce-fuels', transmissions: 'ce-trans', maxUsage: 'ce-maxu', priceSteps: 'ce-price', usageSteps: 'ce-usage' };
/** Move the cursor to the first field with a problem. */
const focusFirst = (errs) => {
  const k = Object.keys(FIELD_IDS).find((f) => errs[f]);
  if (k) setTimeout(() => document.getElementById(FIELD_IDS[k])?.focus(), 0);
};
const FIELD_NAMES = { name: 'Name', singular: 'One item', nounPlural: 'Several items', slug: 'Web address', types: 'Types', fuels: 'Fuels', transmissions: 'Transmissions', priceSteps: 'Budget steps', usageSteps: 'Usage steps', maxUsage: 'Maximum usage', typeLabel: 'Type label' };

function CategoryEditor({ category, onClose }) {
  const { saveCategory } = useStore();
  const toast = useToast();
  const isNew = !category;
  const [d, setD] = useState(() => (category ? toDraft(category) : { ...BLANK }));
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (patch) => setD((x) => ({ ...x, ...patch }));
  const bind = (k) => ({ value: d[k], onChange: (e) => set({ [k]: e.target.value }), error: errs[k] });
  const preview = d.imageData === null ? null : d.imageData || category?.image;

  const used = new Map(d.specFields.map((f, i) => [f.key, i]));
  const toggleSpec = (key) =>
    set({ specFields: used.has(key) ? d.specFields.filter((f) => f.key !== key) : [...d.specFields, { key, required: false, filter: false }] });
  const patchSpec = (key, patch) => set({ specFields: d.specFields.map((f) => (f.key === key ? { ...f, ...patch } : f)) });
  const moveSpec = (i, dir) => {
    const arr = [...d.specFields];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set({ specFields: arr });
  };

  const save = async () => {
    const payload = toPayload(d);
    const e = {};
    if (payload.name.length < 2) e.name = 'Enter a name';
    if (payload.singular.length < 2) e.singular = 'Enter the name of one item';
    if (payload.nounPlural.length < 2) e.nounPlural = 'Enter the plural, e.g. buses';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(payload.slug)) e.slug = 'Use lowercase letters, numbers and hyphens';
    if (!payload.types.length) e.types = 'Add at least one type';
    if (!payload.fuels.length) e.fuels = 'Add at least one fuel';
    if (!payload.transmissions.length) e.transmissions = 'Add at least one transmission';
    if (payload.priceSteps.length < 2) e.priceSteps = 'Add at least two amounts';
    if (payload.usageSteps.length < 2) e.usageSteps = 'Add at least two amounts';
    setErrs(e);
    if (Object.keys(e).length) {
      focusFirst(e);
      return toast('Some fields need attention.', { tone: 'error' });
    }
    setBusy(true);
    try {
      await saveCategory(category?.key, payload);
      toast(isNew ? `${payload.name} added.` : `${payload.name} saved.`);
      onClose();
    } catch (err) {
      const fields = err.details?.fields || {};
      const next = Object.fromEntries(Object.keys(fields).map((k) => [k.split('.')[0], k.startsWith('slug') ? err.message : fields[k]]));
      setErrs(next);
      focusFirst(next);
      const names = Object.keys(fields).map((k) => FIELD_NAMES[k.split('.')[0]] || k.split('.')[0]);
      toast(names.length && !fields.slug ? `Check: ${[...new Set(names)].join(', ')}` : err.message, { tone: 'error', title: "Couldn't save" });
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Use a JPG, PNG or WebP image.', { tone: 'error' });
    if (file.size > 4 * 1048576) return toast('Keep the image under 4 MB.', { tone: 'error' });
    set({ imageData: await fileToDataUrl(file) });
  };

  return (
    <Modal
      open
      side
      onClose={onClose}
      title={isNew ? 'Add a category' : `Edit ${category.name}`}
      description={isNew ? 'It appears in the menus, search and the listing form as soon as you save.' : `Internal ID: ${category.key} (kept on listings, never shown to buyers)`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {isNew ? 'Add category' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        <fieldset className="space-y-4">
          <legend className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-mist-500">Name and web address</legend>
          <Field label="Name" required htmlFor="ce-name" error={errs.name} hint="Shown in menus and page titles, e.g. Trucks & Trailers">
            <Input
              id="ce-name"
              {...bind('name')}
              onChange={(e) => set({ name: e.target.value, ...(isNew && (!d.slug || d.slug === slugify(d.name)) ? { slug: slugify(e.target.value) } : {}) })}
              placeholder="Farm & Agricultural Machinery"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="One item" required htmlFor="ce-one" error={errs.singular} hint={'e.g. "Truck" in "Truck type"'}>
              <Input id="ce-one" {...bind('singular')} placeholder="Truck" />
            </Field>
            <Field label="Several items (lowercase)" required htmlFor="ce-many" error={errs.nounPlural} hint={'e.g. "24 trucks found"'}>
              <Input id="ce-many" {...bind('nounPlural')} placeholder="trucks" />
            </Field>
          </div>
          <Field label="Web address" required htmlFor="ce-slug" error={errs.slug} hint={!isNew && category.aliases?.length ? `Old addresses that still redirect here: ${category.aliases.map((a) => `/${a}`).join(', ')}` : !isNew ? 'If you change it, the old address keeps working and redirects here.' : undefined}>
            <Input id="ce-slug" prefix={<><span className="hidden sm:inline">autodealer.co.tz</span>/</>} {...bind('slug')} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="trucks-trailers" />
          </Field>
          <Field label="Short description" htmlFor="ce-tag" optional hint="Shown under the name in menus and on the home page">
            <Input id="ce-tag" {...bind('tagline')} placeholder="Light trucks, tippers, tankers and trailers" maxLength={120} />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-mist-500">Icon and pictures</legend>
          <div>
            <p className="label">Icon</p>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8" role="radiogroup" aria-label="Icon">
              {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={d.icon === name}
                  aria-label={name}
                  title={name}
                  onClick={() => set({ icon: name })}
                  className={cn('flex aspect-square items-center justify-center rounded-lg border transition', d.icon === name ? 'border-accent-500 bg-accent-50 text-accent-700 ring-2 ring-accent-100' : 'border-mist-200 text-ink-700 hover:border-mist-300')}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Illustration" htmlFor="ce-art" hint="Shown on listings that have no photos yet">
              <Select id="ce-art" value={d.art} onChange={(e) => set({ art: e.target.value })} options={ART_KINDS} />
            </Field>
            <div className="overflow-hidden rounded-lg border border-mist-200">
              <CarArt art={d.art} vehicle={{ category: category?.key, bodyType: lines(d.types)[0], colorHex: '#2C5AA3' }} className="aspect-[2/1] w-full" />
            </div>
          </div>
          <div>
            <p className="label">Home page picture <span className="font-normal text-mist-500">(optional)</span></p>
            <div className="flex items-center gap-3">
              <div className="flex aspect-[2/1] w-40 items-center justify-center overflow-hidden rounded-lg border border-dashed border-mist-300 bg-mist-50">
                {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-mist-400" />}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="btn btn-sm btn-secondary cursor-pointer">
                  <ImagePlus className="h-4 w-4" /> {preview ? 'Replace' : 'Upload'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pickImage} />
                </label>
                {preview && (
                  <button type="button" className="text-left text-[13px] font-semibold text-bad-600 hover:underline" onClick={() => set({ imageData: null })}>
                    Remove picture
                  </button>
                )}
                <p className="text-[12px] text-mist-500">Wide JPG or PNG, under 4 MB. Without one, the illustration is used.</p>
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-mist-500">Listing form and filters</legend>
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Field label="Type label" required htmlFor="ce-tl" error={errs.typeLabel}>
              <Input id="ce-tl" {...bind('typeLabel')} placeholder="Truck type" />
            </Field>
            <Field label="Types" required htmlFor="ce-types" error={errs.types} hint="One per line. Sellers pick one; buyers filter by it.">
              <Textarea id="ce-types" rows={4} {...bind('types')} placeholder={'Tipper\nTanker\nPrime mover'} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fuels" required htmlFor="ce-fuels" error={errs.fuels} hint="One per line">
              <Textarea id="ce-fuels" rows={3} {...bind('fuels')} />
            </Field>
            <Field label="Transmissions" required htmlFor="ce-trans" error={errs.transmissions} hint="One per line">
              <Textarea id="ce-trans" rows={3} {...bind('transmissions')} />
            </Field>
          </div>
          <div>
            <p className="label">Usage is measured in</p>
            <Segmented
              value={d.usage}
              onChange={(v) => set({ usage: v })}
              options={[
                { value: 'km', label: 'Kilometres (odometer)' },
                { value: 'hours', label: 'Hours (hour meter)' },
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Maximum ${d.usage === 'hours' ? 'hours' : 'kilometres'}`} htmlFor="ce-maxu" error={errs.maxUsage} hint="Higher values are refused in the listing form">
              <Input id="ce-maxu" inputMode="numeric" {...bind('maxUsage')} suffix={d.usage === 'hours' ? 'hours' : 'km'} />
            </Field>
            <Field label="Minimum price" htmlFor="ce-minp" hint="0 for no minimum">
              <Input id="ce-minp" inputMode="numeric" {...bind('minPrice')} prefix="TSh" />
            </Field>
          </div>
          <Field label="Budget steps (TSh)" required htmlFor="ce-price" error={errs.priceSteps} hint={numbers(d.priceSteps).length ? `Buyers see: ${numbers(d.priceSteps).map(tzsShort).join(' · ')}` : 'Comma separated amounts for the budget filter'}>
            <Input id="ce-price" {...bind('priceSteps')} />
          </Field>
          <Field label={`${d.usage === 'hours' ? 'Hours' : 'Kilometre'} steps`} required htmlFor="ce-usage" error={errs.usageSteps} hint={numbers(d.usageSteps).length ? `Buyers see: ${numbers(d.usageSteps).map((x) => `under ${num(x)}`).join(' · ')}` : 'Comma separated'}>
            <Input id="ce-usage" {...bind('usageSteps')} />
          </Field>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-mist-500">Specifications</legend>
          <p className="mb-3 text-[13px] text-mist-600">Choose what sellers fill in. The first two appear on listing cards. Tick "Filter" to let buyers search by it.</p>
          {d.specFields.length > 0 && (
            <ol className="mb-3 divide-y divide-mist-100 rounded-xl border border-mist-200">
              {d.specFields.map((f, i) => {
                const spec = SPEC_FIELDS[f.key];
                return (
                  <li key={f.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                    <span className="flex gap-0.5">
                      <button type="button" className="btn-icon h-7 w-7" disabled={i === 0} onClick={() => moveSpec(i, -1)} aria-label={`Move ${spec.label} up`}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" className="btn-icon h-7 w-7" disabled={i === d.specFields.length - 1} onClick={() => moveSpec(i, 1)} aria-label={`Move ${spec.label} down`}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-ink-900">
                      {spec.label}
                      {spec.unit && <span className="font-normal text-mist-500"> ({spec.unit})</span>}
                      {i < 2 && <Badge tone="blue" className="ml-2">On cards</Badge>}
                    </span>
                    <Checkbox label="Required" checked={f.required} onChange={(e) => patchSpec(f.key, { required: e.target.checked })} />
                    <Checkbox label="Filter" checked={f.filter} disabled={!spec.filter} onChange={(e) => patchSpec(f.key, { filter: e.target.checked })} className={!spec.filter ? 'opacity-50' : undefined} />
                    <button type="button" className="btn-icon h-7 w-7" onClick={() => toggleSpec(f.key)} aria-label={`Remove ${spec.label}`}>
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="label">Add a specification</p>
          <div className="flex flex-wrap gap-1.5">
            {SPEC_KEYS.filter((k) => !used.has(k)).map((k) => (
              <button key={k} type="button" onClick={() => toggleSpec(k)} className="inline-flex items-center gap-1 rounded-full border border-mist-200 px-2.5 py-1 text-[12.5px] font-semibold text-ink-700 hover:border-accent-300 hover:bg-accent-50">
                <Plus className="h-3 w-3" /> {SPEC_FIELDS[k].label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-mist-500">Brands and features</legend>
          <Field label="Brands" htmlFor="ce-makes" optional hint="One per line. Sellers can also type a brand that isn't listed.">
            <Textarea id="ce-makes" rows={5} {...bind('makes')} placeholder={'Massey Ferguson\nJohn Deere\nNew Holland'} />
          </Field>
          <Field label="Features sellers can tick" htmlFor="ce-feat" optional hint="One per line">
            <Textarea id="ce-feat" rows={4} {...bind('features')} placeholder={'Air-conditioned cab\nGPS tracking'} />
          </Field>
          <Field label="TRA vehicle classes" htmlFor="ce-reg" optional hint="Words in a TRA record's vehicle class that mean this category, one per line. Used when the registration lookup fills in a listing.">
            <Textarea id="ce-reg" rows={3} {...bind('registryTypes')} placeholder={'tractor\nagricultural'} />
          </Field>
        </fieldset>

        <Toggle checked={d.enabled} onChange={(v) => set({ enabled: v })} label="Show on the website" description="Hidden categories disappear from menus, search and the listing form. Their listings are hidden too." />
      </div>
    </Modal>
  );
}

function RemoveDialog({ category, count, onClose }) {
  const { state, deleteCategory } = useStore();
  const toast = useToast();
  const others = state.categories.filter((c) => c.key !== category.key);
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (count && !moveTo) return toast('Choose where to move the listings.', { tone: 'error' });
    setBusy(true);
    try {
      await deleteCategory(category.key, moveTo || undefined);
      toast(`${category.name} removed.`);
      onClose();
    } catch (e) {
      toast(e.message, { tone: 'error', title: "Couldn't remove" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={`Remove ${category.name}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" icon={Trash2} onClick={remove} loading={busy}>
            Remove category
          </Button>
        </>
      }
    >
      {count ? (
        <div className="space-y-4">
          <p className="text-sm text-mist-700">
            {num(count)} listing{count === 1 ? '' : 's'} use this category. Choose a category to move {count === 1 ? 'it' : 'them'} to. The old web address will lead there.
          </p>
          <Field label="Move listings to" required htmlFor="rm-to">
            <Select id="rm-to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} placeholder="Choose a category" options={others.map((c) => ({ value: c.key, label: c.name }))} />
          </Field>
          <p className="text-[12.5px] text-mist-500">Want to keep the listings where they are? Hide the category instead.</p>
        </div>
      ) : (
        <p className="text-sm text-mist-700">No listings use this category. This can't be undone, but you can add it again later.</p>
      )}
    </Modal>
  );
}

export default function AdminCategories() {
  const { state, reorderCategories, saveCategory } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // category, or 'new'
  const [removing, setRemoving] = useState(null);
  const cats = state.categories;
  const counts = useMemo(() => {
    const out = {};
    state.vehicles.forEach((v) => {
      const k = v.category && VEHICLE_TYPES[v.category] ? v.category : 'car';
      out[k] = out[k] || { total: 0, live: 0 };
      out[k].total += 1;
      if (v.status === 'live') out[k].live += 1;
    });
    return out;
  }, [state.vehicles]);

  const move = async (i, dir) => {
    const keys = cats.map((c) => c.key);
    const j = i + dir;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    try {
      await reorderCategories(keys);
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };
  const toggle = async (c) => {
    try {
      await saveCategory(c.key, { enabled: !c.enabled });
      toast(c.enabled ? `${c.name} is now hidden.` : `${c.name} is now shown on the website.`, { tone: 'info' });
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Marketplace"
        title="Vehicle categories"
        description="Add, rename, hide, reorder or remove categories. Menus, search, filters and the listing form follow these settings straight away."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Add category
          </Button>
        }
      />
      <Alert tone="info" icon={Info} title="Renaming is safe">
        Listings keep their category when you rename it or change its web address, and old addresses redirect to the new one. To retire a category, hide it, or remove it and move its listings to another category.
      </Alert>
      <Section title={`${cats.length} categories`} description="Shown in this order across the website." bodyClass="p-0">
        <ul className="divide-y divide-mist-100">
          {cats.map((c, i) => {
            const T = VEHICLE_TYPES[c.key];
            const Icon = T?.icon || CATEGORY_ICONS.Car;
            const n = counts[c.key] || { total: 0, live: 0 };
            return (
              <li key={c.key} className={cn('flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center', !c.enabled && 'bg-mist-50')}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex flex-col">
                    <button type="button" className="btn-icon h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.name} up`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="btn-icon h-7 w-7" disabled={i === cats.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${c.name} down`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </span>
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', c.enabled ? 'bg-ink-900 text-white' : 'bg-mist-200 text-mist-500')}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                      {c.name}
                      {c.enabled ? <Badge tone="green">Shown</Badge> : <Badge>Hidden</Badge>}
                    </p>
                    <p className="truncate text-[13px] text-mist-600">
                      <span className="font-mono">/{c.slug}</span>
                      {c.aliases?.length > 0 && <span className="text-mist-400"> · also /{c.aliases.join(', /')}</span>} · {c.types?.length || 0} types · {c.specFields?.length || 0} specifications
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 pl-[74px] sm:pl-0">
                  <p className="text-right text-[13px] leading-tight text-mist-600 num">
                    <span className="block font-semibold text-ink-900">{num(n.live)} live</span>
                    {num(n.total)} in total
                  </p>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                    <button type="button" className="btn-icon" onClick={() => toggle(c)} aria-label={c.enabled ? `Hide ${c.name}` : `Show ${c.name}`} title={c.enabled ? 'Hide from the website' : 'Show on the website'}>
                      {c.enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button type="button" className="btn-icon text-bad-600" onClick={() => setRemoving(c)} aria-label={`Remove ${c.name}`} title="Remove" disabled={cats.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
      {editing && <CategoryEditor category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {removing && <RemoveDialog category={removing} count={(counts[removing.key] || {}).total || 0} onClose={() => setRemoving(null)} />}
    </div>
  );
}
