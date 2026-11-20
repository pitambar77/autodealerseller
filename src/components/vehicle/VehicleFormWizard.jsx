import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from '@/lib/router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, CreditCard, DatabaseZap, PencilLine, Save, Search, XCircle } from 'lucide-react';
import { TYPE_KEYS, VEHICLE_TYPES, defaultCategory, typeFor, usageLabel, usageText } from '../../data/vehicleTypes';
import { SPEC_FIELDS, SPEC_KEYS } from '../../data/specFields';
import { Alert, Button, Checkbox, Field, Input, Modal, MockNotice, PhoneInput, PhotoUploader, Plate, RadioCards, Select, Stepper, Textarea, useToast, DL } from '../ui';
import { VehicleCard } from './VehicleCard';
import { useStore, useDuplicateCheck, ACTIVE_STATUSES } from '../../store/AppStore';
import { CITIES, COLORS, CONDITIONS, OWNERSHIP, findModel, makesFor, modelsFor } from '../../data/catalog';
import { cn, km, tzs, normId, prettyReg, REG_RE, REG_HINT } from '../../utils/format';
import { formatPhone, isValidPhone } from '../../lib/phone';
import { packSummary } from '../../utils/packs';
import { offerOf } from './OfferPrice';

// Tanzanian registration numbers (REG_RE in utils/format): T 123 ABC, MC 123 ABC, Z 123 AB.
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const OTHER = '__other';
// Every specification field is a text value in the form; each category decides which ones it shows.
const specSchema = Object.fromEntries(SPEC_KEYS.map((k) => [k, z.string().optional()]));
const thisYear = 2026;
const numStr = (msg, min, max) =>
  z
    .string()
    .trim()
    .min(1, msg)
    .refine((v) => !Number.isNaN(Number(v.replace(/,/g, ''))), 'Enter numbers only')
    .refine((v) => Number(v.replace(/,/g, '')) >= min, `Must be at least ${min.toLocaleString('en-US')}`)
    .refine((v) => Number(v.replace(/,/g, '')) <= max, `Must be ${max.toLocaleString('en-US')} or less`);

const schema = z
  .object({
    category: z.string().min(1, 'Choose what you are selling'),
    make: z.string().min(1, 'Choose a brand'),
    model: z.string().min(1, 'Choose a model'),
    variant: z.string().trim().min(1, 'Enter the variant, e.g. VXi or SX (O)'),
    year: z.string().min(1, 'Choose the model year'),
    bodyType: z.string().min(1, 'Choose a body type'),
    color: z.string().min(1, 'Choose a colour'),
    price: numStr('Enter your asking price', 200000, 3000000000),
    mileage: numStr('Enter how much it has been used', 0, 5000000),
    condition: z.string().min(1, 'Choose the condition'),
    fuel: z.string().min(1, 'Choose the fuel type'),
    transmission: z.string().min(1, 'Choose the transmission'),
    owners: z.string().min(1, 'Choose ownership'),
    city: z.string().min(1, 'Choose the city where the vehicle is'),
    regNumber: z.string().trim().optional(),
    vin: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => VIN_RE.test(v), 'VIN / chassis number must be 17 characters (letters I, O and Q are not used)'),
    engineNo: z.string().trim().min(6, 'Enter the engine number from the registration card'),
    insuranceUntil: z.string().optional(),
    ownerName: z.string().optional(),
    ownerPhone: z.string().optional(),
    ownerRelation: z.string().optional(),
    modifications: z.string().max(400, 'Keep it under 400 characters').optional(),
    authorised: z.boolean().optional(),
    ...specSchema,
    features: z.array(z.string()).optional(),
    description: z.string().trim().min(40, 'Write at least 40 characters — buyers skip listings with thin descriptions').max(1500, 'Keep it under 1,500 characters'),
    photos: z.array(z.string()).optional(),
    mode: z.string(),
  })
  .superRefine((d, ctx) => {
    const num = (x) => Number(String(x || '').replace(/,/g, ''));
    // Limits and required specifications come from the category (Admin → Categories).
    const T = typeFor(d.category);
    if (T.minPrice && d.price && num(d.price) < T.minPrice) ctx.addIssue({ code: 'custom', path: ['price'], message: `Must be at least TSh ${T.minPrice.toLocaleString('en-US')}` });
    if (T.maxUsage && d.mileage && num(d.mileage) > T.maxUsage) ctx.addIssue({ code: 'custom', path: ['mileage'], message: `Must be ${T.maxUsage.toLocaleString('en-US')} ${T.usage === 'hours' ? 'hours' : 'km'} or less` });
    T.specFields.forEach(({ key, required }) => {
      const f = SPEC_FIELDS[key];
      const val = (d[key] || '').trim();
      if (required && !val) ctx.addIssue({ code: 'custom', path: [key], message: `Enter the ${f.label.toLowerCase()}` });
      else if (val && (f.type === 'number' || f.type === 'decimal') && (Number.isNaN(num(val)) || num(val) < 0)) ctx.addIssue({ code: 'custom', path: [key], message: 'Enter numbers only' });
    });
    if (d.condition !== 'New') {
      if (!d.regNumber || !REG_RE.test(normId(d.regNumber))) ctx.addIssue({ code: 'custom', path: ['regNumber'], message: `Enter a valid Tanzanian registration number, ${REG_HINT}` });
    }
    if (d.mode === 'agent') {
      if (!d.ownerName || d.ownerName.trim().length < 3) ctx.addIssue({ code: 'custom', path: ['ownerName'], message: "Enter the registered owner's full name as on the RC" });
      if (!d.ownerPhone || !isValidPhone(d.ownerPhone)) ctx.addIssue({ code: 'custom', path: ['ownerPhone'], message: "Enter the owner's mobile number, e.g. +255 712 345 678" });
      if (!d.authorised) ctx.addIssue({ code: 'custom', path: ['authorised'], message: 'Confirm the owner has authorised you to sell this vehicle' });
    }
  });

const STEP_FIELDS = {
  basics: ['category', 'make', 'model', 'variant', 'year', 'bodyType', 'color'],
  pricing: ['price', 'mileage', 'condition', 'fuel', 'transmission', 'owners', 'city'],
  registration: ['regNumber', 'vin', 'engineNo', 'insuranceUntil'],
  owner: ['ownerName', 'ownerPhone', 'ownerRelation', 'modifications', 'authorised'],
  specs: [...SPEC_KEYS, 'features', 'description'],
  photos: ['photos'],
  preview: [],
};
const STEP_LABELS = { basics: 'Make & model', pricing: 'Price & condition', registration: 'Vehicle identification', owner: 'Owner details', specs: 'Specs & description', photos: 'Photos', preview: 'Preview & publish' };
const STEP_SHORT = { registration: 'Identify', basics: 'Model', pricing: 'Price', owner: 'Owner', specs: 'Specs', photos: 'Photos', preview: 'Publish' };

/** Fields a registry lookup can fill, with their labels for the review card. */
const LOOKUP_FIELDS = [
  ['category', 'Vehicle type'],
  ['make', 'Brand'],
  ['model', 'Model'],
  ['variant', 'Variant'],
  ['year', 'Model year'],
  ['color', 'Colour'],
  ['bodyType', 'Body type'],
  ['fuel', 'Fuel'],
  ['transmission', 'Transmission'],
  ['engineCc', 'Engine (cc)'],
  ['seats', 'Seats'],
  ['ownerName', 'Registered owner'],
];

function toForm(v, mode, type) {
  const str = (x) => (x == null || x === '' ? '' : String(x));
  return {
    mode,
    category: v?.category || (VEHICLE_TYPES[type]?.enabled ? type : defaultCategory()),
    ...Object.fromEntries(SPEC_KEYS.map((k) => [k, str(v?.specs?.[k])])),
    make: v?.make || '',
    model: v?.model || '',
    variant: v?.variant || '',
    year: v?.year ? String(v.year) : '',
    bodyType: v?.bodyType || '',
    color: v?.color || '',
    price: v?.price ? String(v.price) : '',
    mileage: v?.mileage != null ? String(v.mileage) : '',
    condition: v?.condition || (mode === 'dealer' ? '' : 'Used'),
    fuel: v?.fuel || '',
    transmission: v?.transmission || '',
    owners: v?.owners || '',
    city: v?.city || '',
    regNumber: v?.regNumber ? prettyReg(v.regNumber) : '',
    vin: v?.vin || '',
    engineNo: v?.engineNo || '',
    insuranceUntil: v?.insuranceUntil ? v.insuranceUntil.slice(0, 10) : '',
    ownerName: v?.ownerInfo?.name || '',
    ownerPhone: v?.ownerInfo?.phone || '',
    ownerRelation: v?.ownerInfo?.relation || 'Registered owner',
    modifications: v?.modifications || '',
    authorised: !!v?.ownerInfo,
    features: v?.specs?.features || [],
    description: v?.description || '',
    photos: v?.photos || [],
  };
}

function toVehicle(d) {
  const color = COLORS.find((c) => c.name === d.color);
  const n = (s) => (s === '' || s == null ? null : Number(String(s).replace(/,/g, '')));
  // Only the specification fields this category uses are saved.
  const specs = { features: d.features || [] };
  typeFor(d.category).specFields.forEach(({ key }) => {
    const f = SPEC_FIELDS[key];
    const raw = (d[key] ?? '').toString().trim();
    specs[key] = raw === '' ? null : f.type === 'number' || f.type === 'decimal' ? n(raw) : raw;
  });
  return {
    category: d.category || defaultCategory(),
    make: d.make,
    model: d.model,
    variant: d.variant.trim(),
    year: Number(d.year),
    bodyType: d.bodyType,
    color: d.color,
    colorHex: color?.hex || '#8A919C',
    price: n(d.price),
    mileage: n(d.mileage),
    condition: d.condition,
    fuel: d.fuel,
    transmission: d.transmission,
    owners: d.owners,
    city: d.city,
    regNumber: d.condition === 'New' ? normId(d.regNumber) : normId(d.regNumber),
    vin: d.vin.toUpperCase(),
    engineNo: d.engineNo.toUpperCase(),
    insuranceUntil: d.insuranceUntil ? new Date(d.insuranceUntil).toISOString() : null,
    ownerInfo: d.mode === 'agent' ? { name: d.ownerName.trim(), phone: formatPhone(d.ownerPhone), relation: d.ownerRelation || 'Registered owner' } : null,
    modifications: d.mode === 'agent' ? (d.modifications || '').trim() : '',
    specs,
    description: d.description.trim(),
    photos: d.photos || [],
  };
}

/** Which uploaded documents are required before a listing can go to payment. */
export function requiredDocsFor(mode, config) {
  if (mode === 'dealer') return [['business_certificate', 'Business registration certificate', '/dealer/documents']];
  if (mode === 'seller') return [['personal_id', 'Personal ID document', '/seller/identity']];
  return [
    ['personal_id', 'Agent identity document', '/agent/documents'],
    ...(config.agentAuthorizationRequired ? [['owner_authorization', 'Owner authorisation letter', '/agent/documents']] : []),
  ];
}

export function DuplicateModal({ open, onClose, duplicates, regNumber, vin, supportTo = '/support' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="This vehicle is already listed on AutoDealer"
      description="We blocked publication to protect buyers from duplicate or fraudulent listings."
      footer={
        <>
          <Button variant="secondary" to={supportTo}>
            Contact support
          </Button>
          <Button onClick={onClose}>Review my details</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone="error" icon={XCircle} title="Publication blocked">
          An active listing uses the same {duplicates?.[0]?.matchedOn.join(' and ')}. Each registration number and VIN can only appear in one active listing.
        </Alert>
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-mist-50 p-3 text-sm">
          <Plate value={regNumber} />
          <span className="font-mono text-[12.5px] text-mist-600">VIN {vin}</span>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold">What you can do</p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-mist-700">
            <li>Check for a typing mistake in the registration number or VIN — compare with the RC.</li>
            <li>If you sold this vehicle to a dealer or listed it before, ask them to remove that listing, or mark yours sold.</li>
            <li>If you believe someone else listed your vehicle without permission, contact support with a photo of your RC. We'll investigate.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

export default function VehicleFormWizard({ mode, listingId, onCancelTo }) {
  const { state, me, saveListing, submitListing, vehicle, lookupVehicle } = useStore();
  const credits = packSummary(me).listings;
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const existing = listingId ? vehicle(listingId) : null;
  // Identification comes first: the registration number, VIN and engine number identify the vehicle,
  // and (once the TRA connection is live) fill in its details for the seller to confirm.
  const steps = ['registration', 'basics', 'pricing', ...(mode === 'agent' ? ['owner'] : []), 'specs', 'photos', 'preview'];
  const [step, setStep] = useState(0);
  const [dups, setDups] = useState(null);
  const [busy, setBusy] = useState(false);
  // Registry lookup: { status, source, vehicle, message } from the API; `applied` once the seller confirms.
  const [lookup, setLookup] = useState(null);
  const [looking, setLooking] = useState(false);
  const [applied, setApplied] = useState(null);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: toForm(existing, mode, params.get('type')), mode: 'onTouched' });

  const category = watch('category') || defaultCategory();
  const T = typeFor(category);
  const make = watch('make');
  const model = watch('model');
  // Brands and models outside the catalogue can be typed in.
  const [customMake, setCustomMake] = useState(false);
  const knownModels = make ? modelsFor(make, category) : [];
  const condition = watch('condition');
  const regNumber = watch('regNumber');
  const vin = watch('vin');

  // Prefill specs from the catalogue when a model is picked on a new listing.
  useEffect(() => {
    const m = findModel(make, model, category);
    if (!m || existing) return;
    setValue('bodyType', m.body);
    const fill = (k, val) => val != null && !getValues(k) && setValue(k, String(val));
    typeFor(category).specFields.forEach(({ key }) => fill(key, m.specs?.[key]));
  }, [make, model, category, existing, setValue, getValues]);

  // Switching vehicle type clears the choices that depend on it.
  const switchCategory = (c) => {
    if (c === category) return;
    setValue('category', c);
    ['make', 'model', 'variant', 'bodyType', 'fuel', 'transmission', ...SPEC_KEYS].forEach((k) => setValue(k, ''));
    setValue('features', []);
    setCustomMake(false);
  };

  const runLookup = async () => {
    const ok = await trigger(['regNumber', 'vin']);
    const reg = normId(getValues('regNumber'));
    const v = (getValues('vin') || '').toUpperCase();
    if (!reg && !v) return toast('Enter the registration number or VIN first.', { tone: 'error' });
    if (!ok && !(reg && REG_RE.test(reg))) return undefined;
    setLooking(true);
    try {
      const res = await lookupVehicle({ regNumber: reg, vin: VIN_RE.test(v) ? v : '' });
      setLookup(res);
      // The record's VIN and engine number fill the identification fields that are still empty.
      if (res.status === 'found') {
        if (res.vehicle?.vin && !getValues('vin')) setValue('vin', res.vehicle.vin, { shouldValidate: true });
        if (res.vehicle?.engineNo && !getValues('engineNo')) setValue('engineNo', res.vehicle.engineNo, { shouldValidate: true });
      }
    } catch (e) {
      setLookup({ status: 'unavailable', message: e.message });
    } finally {
      setLooking(false);
    }
    return undefined;
  };

  /** Seller confirmed the registry details: fill the form, then continue to check them. */
  const applyLookup = async () => {
    const d = lookup?.vehicle || {};
    if (d.category && VEHICLE_TYPES[d.category] && !existing) setValue('category', d.category);
    ['make', 'model', 'variant', 'year', 'color', 'fuel', 'transmission', 'engineCc', 'seats'].forEach((k) => d[k] && setValue(k, String(d[k])));
    if (d.bodyType) setTimeout(() => setValue('bodyType', d.bodyType), 0); // after the model's catalogue defaults
    if (d.vin && !getValues('vin')) setValue('vin', d.vin);
    if (d.engineNo && !getValues('engineNo')) setValue('engineNo', d.engineNo);
    if (mode === 'agent' && d.ownerName) setValue('ownerName', d.ownerName);
    setApplied({ source: lookup.source, fields: LOOKUP_FIELDS.filter(([k]) => d[k]).map(([, l]) => l) });
    toast(`Details filled from ${lookup.source}. Check each step before publishing.`, { tone: 'info' });
    // Move on once the identification fields are valid (the record may not include everything).
    if (await trigger(STEP_FIELDS.registration)) setStep(1);
  };

  // Live duplicate hint on the registration step (checked by the API against every active listing).
  const dupQuery = useMemo(() => {
    const reg = normId(regNumber);
    const v = (vin || '').toUpperCase();
    if (reg.length < 8 && v.length < 17) return null;
    return { regNumber: reg.length >= 8 ? reg : '', vin: v.length === 17 ? v : '' };
  }, [regNumber, vin]);
  const liveDups = useDuplicateCheck(dupQuery, listingId);

  const docsNeeded = requiredDocsFor(mode, state.config);
  const myDocs = state.documents.filter((d) => d.userId === me?.id);
  const missingDocs = docsNeeded.filter(([type]) => !myDocs.some((d) => d.type === type && d.status !== 'rejected'));

  const key = steps[step];
  const next = async () => {
    const ok = await trigger(STEP_FIELDS[key]);
    if (!ok) {
      toast('Fix the highlighted fields to continue.', { tone: 'error' });
      return;
    }
    setStep((s) => Math.min(steps.length - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const persist = (data) => saveListing(toVehicle(data), listingId);

  const saveDraft = handleSubmit(
    async (data) => {
      setBusy(true);
      try {
        const id = await persist(data);
        toast(existing ? 'Changes saved.' : 'Draft saved. It stays private until you pay and publish.');
        nav(onCancelTo, { replace: true, state: { highlight: id } });
      } catch (e) {
        toast(e.message, { tone: 'error', title: "Couldn't save" });
      } finally {
        setBusy(false);
      }
    },
    () => toast('Some fields need attention before saving.', { tone: 'error' }),
  );

  const publish = handleSubmit(
    async (data) => {
      setBusy(true);
      let id;
      let res;
      try {
        id = await persist(data);
        res = await submitListing(id);
      } catch (e) {
        toast(e.message, { tone: 'error', title: "Couldn't save" });
        return;
      } finally {
        setBusy(false);
      }
      if (res.problems.length) {
        toast(res.problems.join(' '), { tone: 'error', title: 'This listing is missing some details' });
        return;
      }
      if (!res.ok) {
        setDups({ list: res.duplicates, id });
        return;
      }
      const v = vehicle(id);
      if (existing && existing.paymentStatus === 'paid') {
        toast('Listing updated. Changes are live.');
        nav(onCancelTo);
      } else {
        nav(`/checkout/${id}`, { state: { fromForm: true, wasPaid: v?.paymentStatus === 'paid' } });
      }
    },
    (errs) => {
      const first = Object.keys(errs)[0];
      const stepIdx = steps.findIndex((s) => STEP_FIELDS[s].includes(first));
      if (stepIdx >= 0) setStep(stepIdx);
      toast('Some details are missing or invalid. We took you to the first one.', { tone: 'error' });
    },
  );

  const preview = { ...toVehicle({ ...getValues(), price: getValues('price') || '0', mileage: getValues('mileage') || '0', description: getValues('description') || '' }), id: listingId || 'preview', sellerRole: mode, verification: 'unverified', featured: false, status: 'draft' };
  const years = Array.from({ length: 20 }, (_, i) => String(thisYear - i));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <form onSubmit={(e) => e.preventDefault()} noValidate className="card min-w-0">
        <div className="border-b border-mist-100 px-5 py-4">
          <Stepper steps={steps.map((s) => STEP_SHORT[s])} current={step} onStepClick={setStep} />
          <p className="mt-2 text-[13px] text-mist-500 lg:hidden">
            Step {step + 1} of {steps.length}: <span className="font-semibold text-ink-800">{STEP_LABELS[key]}</span>
          </p>
        </div>

        <div className="space-y-5 p-5 md:p-6">
          {key === 'basics' && (
            <div className="grid gap-4 md:grid-cols-2">
              {applied && (
                <Alert tone="success" title={`Filled from ${applied.source}`} className="md:col-span-2">
                  Check {applied.fields.slice(0, 4).join(', ').toLowerCase()}
                  {applied.fields.length > 4 ? ' and the rest' : ''} below and correct anything that doesn't match the vehicle.
                </Alert>
              )}
              <div className="md:col-span-2">
                <p className="label">What are you selling?</p>
                {existing ? (
                  <p className="flex items-center gap-2 rounded-xl border border-mist-200 bg-mist-50 px-3.5 py-3 text-sm font-semibold text-ink-900">
                    <T.icon className="h-5 w-5 text-accent-600" /> {T.label}
                    <span className="font-normal text-mist-500">· the type can't be changed after listing</span>
                  </p>
                ) : (
                  <RadioCards name="vf-category" columns={3} value={category} onChange={switchCategory} options={TYPE_KEYS.map((k) => ({ value: k, label: VEHICLE_TYPES[k].label, description: VEHICLE_TYPES[k].tagline, icon: VEHICLE_TYPES[k].icon }))} />
                )}
              </div>
              <Field label="Brand" required error={errors.make?.message} htmlFor="vf-make" hint={customMake ? <button type="button" className="font-semibold text-accent-700 hover:underline" onClick={() => { setCustomMake(false); setValue('make', ''); setValue('model', ''); }}>Choose from the list instead</button> : undefined}>
                {customMake ? (
                  <Input id="vf-make" {...register('make', { onChange: () => setValue('model', '') })} error={errors.make} placeholder="Type the brand" autoFocus />
                ) : (
                  <Select
                    id="vf-make"
                    {...register('make', {
                      onChange: (e) => {
                        setValue('model', '');
                        if (e.target.value === OTHER) {
                          setCustomMake(true);
                          setValue('make', '');
                        }
                      },
                    })}
                    placeholder="Select brand"
                    options={[...makesFor(category), ...(make && !makesFor(category).includes(make) ? [make] : []), { value: OTHER, label: 'Other brand (type it)' }]}
                    error={errors.make}
                  />
                )}
              </Field>
              <Field label="Model" required error={errors.model?.message} htmlFor="vf-model" hint={make && !knownModels.length ? 'Type the model as written on the registration card' : undefined}>
                {make && !knownModels.length ? (
                  <Input id="vf-model" {...register('model')} error={errors.model} placeholder="e.g. 320 GC" />
                ) : (
                  <Select id="vf-model" {...register('model')} placeholder={make ? 'Select model' : 'Select a brand first'} options={[...knownModels, ...(model && !knownModels.includes(model) ? [model] : [])]} disabled={!make} error={errors.model} />
                )}
              </Field>
              <Field label="Variant" required error={errors.variant?.message} htmlFor="vf-variant" hint={findModel(make, model, category) ? `Common variants: ${findModel(make, model, category).variants.join(', ')}` : 'As written on the badge or invoice'}>
                <Input id="vf-variant" {...register('variant')} error={errors.variant} placeholder="e.g. ZXi+" list="vf-variants" />
                <datalist id="vf-variants">
                  {(findModel(make, model, category)?.variants || []).map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </Field>
              <Field label="Model year" required error={errors.year?.message} htmlFor="vf-year">
                <Select id="vf-year" {...register('year')} placeholder="Select year" options={years} error={errors.year} />
              </Field>
              <Field label={T.bodyLabel} required error={errors.bodyType?.message} htmlFor="vf-body" hint="Filled in from the model; change it if needed">
                <Select id="vf-body" {...register('bodyType')} placeholder={`Select ${T.bodyLabel.toLowerCase()}`} options={T.bodies} error={errors.bodyType} />
              </Field>
              <Field label="Colour" required error={errors.color?.message} htmlFor="vf-color">
                <Select id="vf-color" {...register('color')} placeholder="Select colour" options={COLORS.map((c) => c.name)} error={errors.color} />
              </Field>
            </div>
          )}

          {key === 'pricing' && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Asking price" required error={errors.price?.message} htmlFor="vf-price" hint={watch('price') && !errors.price ? `Shown to buyers as ${tzs(Number(String(watch('price')).replace(/,/g, '')))}` : 'Enter the full amount in Tanzanian shillings'}>
                <Input id="vf-price" prefix="TSh" inputMode="numeric" {...register('price')} error={errors.price} placeholder="19850000" />
                {offerOf(existing)?.kind === 'discount' && (
                  <p className="mt-1.5 rounded-lg bg-warn-50 px-2.5 py-1.5 text-[12.5px] text-warn-700">
                    This is the discounted price (original {tzs(offerOf(existing).originalPrice)}). Changing it ends the discount. To change only the discount, use “Change the offer” in Listings.
                  </p>
                )}
              </Field>
              <Field label={usageLabel(T)} required error={errors.mileage?.message} htmlFor="vf-km" hint={T.usage === 'hours' ? 'Read it from the hour meter' : 'Read it from the odometer'}>
                <Input id="vf-km" suffix={T.usage === 'hours' ? 'hours' : 'km'} inputMode="numeric" {...register('mileage')} error={errors.mileage} placeholder={T.usage === 'hours' ? '4200' : '38420'} />
              </Field>
              <Field label="Condition" required error={errors.condition?.message} htmlFor="vf-cond">
                <Select id="vf-cond" {...register('condition')} placeholder="Select condition" options={mode === 'dealer' ? CONDITIONS : CONDITIONS.filter((c) => c !== 'New')} error={errors.condition} />
              </Field>
              <Field label="Ownership" required error={errors.owners?.message} htmlFor="vf-own">
                <Select id="vf-own" {...register('owners')} placeholder="Select ownership" options={condition === 'New' ? ['New'] : OWNERSHIP} error={errors.owners} />
              </Field>
              <Field label="Fuel type" required error={errors.fuel?.message} htmlFor="vf-fuel">
                <Select id="vf-fuel" {...register('fuel')} placeholder="Select fuel" options={T.fuels} error={errors.fuel} />
              </Field>
              <Field label="Transmission" required error={errors.transmission?.message} htmlFor="vf-trans">
                <Select id="vf-trans" {...register('transmission')} placeholder="Select transmission" options={T.transmissions} error={errors.transmission} />
              </Field>
              <Field label={`${T.label} location`} required error={errors.city?.message} htmlFor="vf-city" className="md:col-span-2">
                <Select id="vf-city" {...register('city')} placeholder="Select city" options={CITIES.map((c) => c.name)} error={errors.city} />
              </Field>
            </div>
          )}

          {key === 'registration' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-ink-900">Start with the vehicle's identity</h2>
                <p className="mt-1 text-sm text-mist-600">
                  Copy these exactly from the registration card. We use them to block duplicate listings, buyers use them to check the vehicle, and we can fill in its details from the official records.
                </p>
              </div>
              <Controller
                control={control}
                name="condition"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value === 'New'}
                    onChange={(e) => field.onChange(e.target.checked ? 'New' : mode === 'dealer' ? '' : 'Used')}
                    label="This is a brand-new vehicle that isn't registered yet"
                    description="New vehicles can be listed with the VIN and engine number only."
                  />
                )}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Registration number" required={condition !== 'New'} optional={condition === 'New'} error={errors.regNumber?.message} htmlFor="vf-reg" hint={condition === 'New' ? 'Leave empty until the vehicle is registered' : 'e.g. T 123 ABC'}>
                  <Input id="vf-reg" {...register('regNumber')} error={errors.regNumber} className="font-mono uppercase" placeholder="T 123 ABC" autoCapitalize="characters" autoFocus={!existing} />
                </Field>
                <Field label="VIN / chassis number" required error={errors.vin?.message} htmlFor="vf-vin" hint={`${(vin || '').length}/17 characters`}>
                  <Input id="vf-vin" {...register('vin')} error={errors.vin} className="font-mono uppercase" placeholder="MA3EWDE1S00123456" maxLength={17} autoCapitalize="characters" />
                </Field>
                <Field label="Engine number" required error={errors.engineNo?.message} htmlFor="vf-eng">
                  <Input id="vf-eng" {...register('engineNo')} error={errors.engineNo} className="font-mono uppercase" placeholder="K12MN1234567" autoCapitalize="characters" />
                </Field>
                <Field label="Insurance valid until" optional htmlFor="vf-ins">
                  <Input id="vf-ins" type="date" {...register('insuranceUntil')} />
                </Field>
              </div>
              {liveDups.length > 0 && (
                <Alert tone="warn" title="Possible duplicate" icon={AlertTriangle}>
                  This {liveDups[0].matchedOn.join(' and ')} matches an active listing ({liveDups[0].title}, {liveDups[0].city}). You can continue, but publishing will be blocked until it's resolved.
                </Alert>
              )}

              {/* Registry lookup, with typing the details as the fallback */}
              <div className="rounded-xl border border-mist-200 bg-mist-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-white">
                      <DatabaseZap className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-ink-900">Fill in the details from official records</p>
                      <p className="text-[13px] text-mist-600">We look up the make, model, year and more from the registration number or VIN. You check everything before it's used.</p>
                    </div>
                  </div>
                  <Button variant="dark" icon={Search} onClick={runLookup} loading={looking} className="w-full shrink-0 sm:w-auto">
                    Look up details
                  </Button>
                </div>

                {lookup?.status === 'found' && (
                  <div className="mt-4 rounded-lg border border-ok-600/30 bg-white p-4">
                    <p className="flex items-center gap-2 font-semibold text-ink-900">
                      <CheckCircle2 className="h-5 w-5 text-ok-600" /> Record found · {lookup.source}
                    </p>
                    <p className="mt-0.5 text-[13px] text-mist-600">Check these details. If anything is wrong, choose "Enter manually" and type the correct details.</p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                      {LOOKUP_FIELDS.filter(([k]) => lookup.vehicle?.[k] && (k !== 'ownerName' || mode === 'agent')).map(([k, l]) => (
                        <div key={k} className="min-w-0">
                          <dt className="text-[12px] text-mist-500">{l}</dt>
                          <dd className="truncate font-semibold text-ink-900">{k === 'category' ? VEHICLE_TYPES[lookup.vehicle[k]]?.label || lookup.vehicle[k] : lookup.vehicle[k]}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button icon={CheckCircle2} onClick={applyLookup}>
                        Use these details
                      </Button>
                      <Button variant="secondary" icon={PencilLine} onClick={() => { setLookup(null); next(); }}>
                        Enter manually
                      </Button>
                    </div>
                  </div>
                )}
                {lookup && lookup.status !== 'found' && (
                  <Alert tone={lookup.status === 'not_found' ? 'warn' : 'info'} title={lookup.status === 'not_found' ? 'No record found' : 'Automatic lookup unavailable'} className="mt-4">
                    {lookup.message} You can enter the details yourself in the next steps.
                  </Alert>
                )}
                {!lookup && (
                  <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-mist-500">
                    <PencilLine className="h-3.5 w-3.5" /> Prefer to type everything? Choose Continue to enter the details manually.
                  </p>
                )}
              </div>
              {state.demo?.login && (
                <MockNotice>
                  Test lookup: <span className="font-mono font-semibold">T 123 DEF</span>, <span className="font-mono font-semibold">T 456 DCB</span> or <span className="font-mono font-semibold">MC 456 ABC</span>. Duplicate check: <span className="font-mono font-semibold">{prettyReg(state.vehicles.find((v) => v.status === 'live' && v.regNumber)?.regNumber)}</span>.
                </MockNotice>
              )}
            </div>
          )}

          {key === 'owner' && (
            <div className="space-y-4">
              <Alert tone="info" title="Owner details stay private">
                Buyers see you as the contact. The owner's details are only visible to you and AutoDealer's verification team.
              </Alert>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Registered owner's name" required error={errors.ownerName?.message} htmlFor="vf-oname" hint="As printed on the RC">
                  <Input id="vf-oname" {...register('ownerName')} error={errors.ownerName} />
                </Field>
                <Field label="Owner's mobile number" required error={errors.ownerPhone?.message} htmlFor="vf-ophone">
                  <Controller control={control} name="ownerPhone" render={({ field }) => <PhoneInput id="vf-ophone" value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur} error={errors.ownerPhone} />} />
                </Field>
                <Field label="Owner type" htmlFor="vf-orel">
                  <Select id="vf-orel" {...register('ownerRelation')} options={['Registered owner', 'Company-owned (authorised signatory)', 'Legal heir of owner']} />
                </Field>
              </div>
              <Field label="Modifications" optional error={errors.modifications?.message} htmlFor="vf-mods" hint="Aftermarket parts, CNG kit, wraps, lift kits. Say whether they're endorsed on the RC.">
                <Textarea id="vf-mods" rows={3} {...register('modifications')} error={errors.modifications} placeholder="e.g. Company-fitted CNG kit, endorsed on RC" />
              </Field>
              <Controller
                control={control}
                name="authorised"
                render={({ field }) => (
                  <div>
                    <Checkbox
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      label="The owner has authorised me to list and sell this vehicle"
                      description={state.config.agentAuthorizationRequired ? 'Upload the signed authorisation letter under ID & authorisation before publishing.' : 'A signed letter is optional under the current policy, but speeds up verification.'}
                    />
                    {errors.authorised && <p className="field-error">{errors.authorised.message}</p>}
                  </div>
                )}
              />
            </div>
          )}

          {key === 'specs' && (
            <div className="space-y-4">
              {/* The specification fields chosen for this category in Admin → Categories */}
              {T.specFields.length > 0 && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {T.specFields.map(({ key: k, required }) => {
                    const f = SPEC_FIELDS[k];
                    return (
                      <Field key={k} label={f.label} required={required} optional={!required} error={errors[k]?.message} htmlFor={`vf-${k}`} hint={f.hint} className={f.type === 'text' ? 'col-span-2' : undefined}>
                        {f.type === 'select' ? (
                          <Select id={`vf-${k}`} {...register(k)} placeholder="Select" options={f.options} error={errors[k]} />
                        ) : (
                          <Input id={`vf-${k}`} {...register(k)} inputMode={f.type === 'number' ? 'numeric' : f.type === 'decimal' ? 'decimal' : undefined} suffix={f.unit} error={errors[k]} />
                        )}
                      </Field>
                    );
                  })}
                </div>
              )}
              <Controller
                control={control}
                name="features"
                render={({ field }) => (
                  <fieldset>
                    <legend className="label">Features</legend>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {T.features.map((f) => (
                        <Checkbox
                          key={f}
                          label={f}
                          checked={field.value?.includes(f)}
                          onChange={(e) => field.onChange(e.target.checked ? [...(field.value || []), f] : field.value.filter((x) => x !== f))}
                        />
                      ))}
                    </div>
                  </fieldset>
                )}
              />
              <Field label="Description" required error={errors.description?.message} htmlFor="vf-desc" hint={`${(watch('description') || '').length}/1,500 · Mention service history, accidents, tyres and why you're selling`}>
                <Textarea id="vf-desc" rows={6} {...register('description')} error={errors.description} />
              </Field>
            </div>
          )}

          {key === 'photos' && (
            <div className="space-y-4">
              <Controller control={control} name="photos" render={({ field }) => <PhotoUploader photos={field.value || []} onChange={field.onChange} />} />
              {(watch('photos') || []).length === 0 && (
                <Alert tone="warn" title="Listings with photos get far more calls">
                  You can publish without photos, but add at least the front, side, rear, cabin and odometer. Until you do, buyers see an illustrated placeholder.
                </Alert>
              )}
            </div>
          )}

          {key === 'preview' && (
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-[280px_1fr]">
                <div className="pointer-events-none">
                  <VehicleCard vehicle={preview} />
                </div>
                <DL
                  cols={2}
                  items={[
                    ['Price', tzs(preview.price)],
                    [T.usage === 'hours' ? 'Hours used' : 'Kilometres', usageText(preview)],
                    ['Fuel / gearbox', `${preview.fuel} · ${preview.transmission}`],
                    ['Ownership', preview.owners],
                    ['Registration', <Plate key="p" value={preview.regNumber} size="sm" />],
                    ['VIN', <span key="v" className="font-mono text-[12.5px]">{preview.vin}</span>],
                    ['Location', preview.city],
                    ['Photos', `${preview.photos.length} uploaded`],
                    mode === 'agent' && ['Owner (private)', preview.ownerInfo?.name],
                  ]}
                />
              </div>
              <div className="rounded-xl border border-mist-200">
                <p className="border-b border-mist-100 px-4 py-3 text-sm font-bold">Before your listing goes live</p>
                <ul className="divide-y divide-mist-100 text-sm">
                  <li className="flex items-start gap-3 px-4 py-3">
                    {liveDups.length ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok-600" />}
                    <span>{liveDups.length ? 'Duplicate check: matches an active listing — publishing will be blocked' : 'Duplicate check: no active listing uses this registration number or VIN'}</span>
                  </li>
                  {docsNeeded.map(([type, label, to]) => {
                    const missing = missingDocs.some(([t]) => t === type);
                    return (
                      <li key={type} className="flex items-start gap-3 px-4 py-3">
                        {missing ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok-600" />}
                        <span className="flex-1">
                          {label}: {missing ? 'not uploaded yet' : 'uploaded (review happens after publishing)'}
                          {missing && (
                            <Button variant="ghost" size="sm" to={to} className="ml-1 h-auto px-1 py-0 text-accent-700 underline">
                              Upload now
                            </Button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                  <li className="flex items-start gap-3 px-4 py-3">
                    {existing?.paymentStatus === 'paid' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok-600" /> : <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />}
                    <span>{existing?.paymentStatus === 'paid' ? 'Listing fee: already paid' : 'Listing fee: paid on the next screen. The listing goes live automatically once payment succeeds.'}</span>
                  </li>
                </ul>
              </div>
              {missingDocs.length > 0 && (
                <Alert tone="warn" title="Upload your documents to publish">
                  You can save this as a draft now. Publishing needs the documents above to be uploaded; our team verifies them after the listing goes live.
                </Alert>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-mist-100 bg-mist-50/60 px-5 py-3.5">
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="secondary" icon={ArrowLeft} onClick={back}>
                Back
              </Button>
            ) : (
              <Button variant="ghost" to={onCancelTo}>
                Cancel
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {key === 'preview' ? (
              <>
                <Button variant="secondary" icon={Save} onClick={saveDraft}>
                  {existing ? 'Save changes' : 'Save as draft'}
                </Button>
                <Button icon={CreditCard} onClick={publish} loading={busy} disabled={missingDocs.length > 0}>
                  {existing?.paymentStatus === 'paid' ? 'Save & keep live' : credits > 0 ? `Continue to publish · ${credits} credit${credits === 1 ? '' : 's'} left` : 'Continue to payment'}
                </Button>
              </>
            ) : (
              <Button iconRight={ArrowRight} onClick={next}>
                Continue
              </Button>
            )}
          </div>
        </div>
      </form>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <div className="card p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-mist-500">Live preview</p>
          <p className="mt-2 font-display text-lg font-bold" style={{ fontStretch: '108%' }}>
            {[watch('year'), make, model].filter(Boolean).join(' ') || `Your ${T.noun}`}
          </p>
          <p className="text-sm text-mist-500">{watch('variant') || 'Variant'}</p>
          <p className="mt-2 font-display text-xl font-bold num">{watch('price') ? tzs(Number(String(watch('price')).replace(/,/g, ''))) : 'TSh —'}</p>
          {regNumber && (
            <div className="mt-3">
              <Plate value={regNumber} size="sm" />
            </div>
          )}
        </div>
        <div className={cn('card p-4 text-[13px] text-mist-600')}>
          <p className="mb-1.5 font-semibold text-ink-900">How publishing works</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Fill in details and check the preview.</li>
            <li>{credits > 0 ? 'Publish with a credit from your pack (or pay the listing fee).' : 'Pay the listing fee.'}</li>
            <li>Your listing goes live straight away.</li>
            <li>Our team reviews your documents and adds a "Verified" badge.</li>
          </ol>
        </div>
      </aside>

      <DuplicateModal open={!!dups} onClose={() => setDups(null)} duplicates={dups?.list} regNumber={normId(regNumber)} vin={(vin || '').toUpperCase()} supportTo={mode === 'seller' ? '/seller/listing-status' : '/support'} />
    </div>
  );
}

export { ACTIVE_STATUSES };
