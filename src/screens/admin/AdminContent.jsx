// Admin → Website content: the home page banner slides, trust indicators, the cities list and city photos.
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, BadgeCheck, Eye, EyeOff, ImagePlus, Images, Pencil, Plus, RotateCcw, Trash2, Type, Upload } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { api, fileToDataUrl } from '../../lib/api';
import { Alert, Badge, Button, Checkbox, ConfirmDialog, Field, Input, Modal, PageHeader, Section, Select, Textarea, useToast } from '../../components/ui';
import { HeadingEditor } from '../../components/ui/HeadingEditor';
import { HeadingPieces } from '../../components/layout/HeroHeading';
import { DEFAULT_HEADING, HEADING_MAX_CHARS, HEADING_MAX_LINES, cleanHeading, hasHeading, headingText } from '../../config/heading';
import { TRUST_ICON_OPTIONS, TrustIcon, TrustIndicators } from '../../components/layout/TrustIndicators';
import { DEFAULT_CONFIG, MAX_TRUST_INDICATORS } from '../../config/site';
import { CitiesManager } from './CitiesManager';
import { CityPhotos } from './AdminSettings';

const MAX_MB = 6;

function SlideEditor({ slide, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !slide.id;
  const [d, setD] = useState({ heading: slide.heading?.length ? slide.heading : slide.title ? [{ text: slide.title }] : [], subtitle: slide.subtitle || '', ctaLabel: slide.ctaLabel || '', ctaLink: slide.ctaLink || '', alt: slide.alt || '' });
  const headingCheck = cleanHeading(d.heading);
  const [image, setImage] = useState(null); // data URL of a newly chosen photo
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef(null);
  const pick = async (f) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setErr('Use a JPG, PNG or WebP photo.');
    if (f.size > MAX_MB * 1048576) return setErr(`Keep the photo under ${MAX_MB} MB.`);
    setErr('');
    setImage(await fileToDataUrl(f));
  };
  const save = async () => {
    if (isNew && !image) return setErr('Choose a photo for the slide.');
    if (d.ctaLabel && !d.ctaLink) return setErr('Add where the button goes, e.g. /cars or /dealers.');
    if (headingCheck.error) return setErr(headingCheck.error);
    setBusy(true);
    try {
      const body = { ...d, heading: headingCheck.segments, ...(image ? { imageData: image } : {}) };
      const r = isNew ? await api('POST', '/admin/banners', body) : await api('PATCH', `/admin/banners/${slide.id}`, body);
      onSaved(r);
      toast(isNew ? 'Slide added. It shows on the home page now.' : 'Slide updated.');
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const preview = image || slide.imageUrl;
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={isNew ? 'Add a banner slide' : 'Edit banner slide'}
      description="A wide landscape photo works best (at least 1920 × 800 px). Text is optional: without a headline the slide shows the standard heading."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {isNew ? 'Add slide' : 'Save slide'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && <Alert tone="error">{err}</Alert>}
        <button
          type="button"
          onClick={() => file.current?.click()}
          className="group relative block aspect-[12/5] w-full overflow-hidden rounded-xl border-2 border-dashed border-mist-300 bg-mist-50 hover:border-accent-400"
        >
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : null}
          <span className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm font-semibold ${preview ? 'bg-ink-950/45 text-white opacity-0 transition-opacity group-hover:opacity-100' : 'text-mist-600'}`}>
            <Upload className="h-6 w-6" /> {preview ? 'Replace photo' : 'Choose a photo'}
          </span>
        </button>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <div>
          <p className="label">
            Headline <span className="font-normal text-mist-500">(optional: empty uses the standard heading)</span>
          </p>
          <HeadingEditor id="sl-heading" value={d.heading} onChange={(h) => setD((x) => ({ ...x, heading: h }))} placeholder="e.g. Year-end deals on SUVs" error={headingCheck.error} />
          {headingCheck.error && <p className="field-error">{headingCheck.error}</p>}
        </div>
        <Field label="Photo description" htmlFor="sl-alt" optional hint="For screen readers, e.g. “Blue sports car on a mountain road”">
          <Input id="sl-alt" maxLength={140} value={d.alt} onChange={(e) => setD({ ...d, alt: e.target.value })} />
        </Field>
        <Field label="Text under the headline" htmlFor="sl-sub" optional>
          <Textarea id="sl-sub" rows={2} maxLength={220} value={d.subtitle} onChange={(e) => setD({ ...d, subtitle: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button text" htmlFor="sl-cta" optional hint="e.g. “See the offers”">
            <Input id="sl-cta" maxLength={30} value={d.ctaLabel} onChange={(e) => setD({ ...d, ctaLabel: e.target.value })} />
          </Field>
          <Field label="Button goes to" htmlFor="sl-link" optional hint="A page here (/cars, /dealers) or https://…">
            <Input id="sl-link" value={d.ctaLink} onChange={(e) => setD({ ...d, ctaLink: e.target.value })} placeholder="/cars" className="font-mono text-[13px]" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function BannerManager() {
  const { setConfig } = useStore();
  const toast = useToast();
  const [slides, setSlides] = useState(null);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const apply = (r) => {
    setSlides(r.slides);
    setConfig(r.config); // the home page updates at once
  };
  useEffect(() => {
    api('GET', '/admin/banners').then(apply).catch((e) => toast(e.message, { tone: 'error' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (p, msg) => {
    try {
      apply(await p);
      if (msg) toast(msg, { tone: 'info' });
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };
  const move = (i, dir) => {
    const ids = slides.map((x) => x.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    run(api('POST', '/admin/banners/reorder', { ids }));
  };
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Images className="h-4 w-4" /> Home page banner
        </span>
      }
      description="Photos that slide behind the home page headline, in this order. Hidden slides stay here for later."
      actions={
        <Button size="sm" icon={ImagePlus} onClick={() => setEditing({})} disabled={!slides || slides.length >= 10}>
          Add slide
        </Button>
      }
      bodyClass="p-0"
    >
      {!slides ? (
        <p className="p-5 text-sm text-mist-500">Loading…</p>
      ) : (
        <ul className="divide-y divide-mist-100">
          {slides.map((sl, i) => (
            <li key={sl.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <img src={sl.imageUrl} alt={sl.alt || ''} className={`aspect-[12/5] w-full shrink-0 rounded-lg bg-mist-100 object-cover sm:w-48 ${sl.enabled === false ? 'opacity-40 grayscale' : ''}`} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                  Slide {i + 1} {sl.enabled === false && <Badge>Hidden</Badge>}
                </p>
                <p className="truncate text-[13.5px] text-mist-700">{sl.title || <span className="text-mist-500">Standard headline</span>}</p>
                {sl.ctaLabel && (
                  <p className="text-[12.5px] text-mist-500">
                    Button “{sl.ctaLabel}” → <span className="font-mono">{sl.ctaLink}</span>
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" className="btn-icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" className="btn-icon" aria-label="Move down" disabled={i === slides.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button type="button" className="btn-icon" aria-label={sl.enabled === false ? 'Show slide' : 'Hide slide'} title={sl.enabled === false ? 'Show' : 'Hide'} onClick={() => run(api('PATCH', `/admin/banners/${sl.id}`, { enabled: sl.enabled === false }), sl.enabled === false ? 'Slide shown.' : 'Slide hidden.')}>
                  {sl.enabled === false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button type="button" className="btn-icon" aria-label="Edit slide" onClick={() => setEditing(sl)}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" className="btn-icon text-bad-600" aria-label="Remove slide" onClick={() => setRemoving(sl)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <SlideEditor slide={editing} onClose={() => setEditing(null)} onSaved={apply} />}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove this slide?"
        message="It disappears from the home page. To keep it for later, hide it instead."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => run(api('DELETE', `/admin/banners/${removing.id}`), 'Slide removed.')}
      />
    </Section>
  );
}

const SELL_ACTIONS = [
  { value: 'smart', label: 'Smart: sellers to their listing form, others to the Sell page' },
  { value: 'sell', label: 'Always the Sell page (/how-it-works)' },
  { value: 'register', label: 'Registration page (/register)' },
  { value: 'link', label: 'A link I choose' },
];

/** How the heading and buttons look on the banner, at desktop or phone size. */
function BannerPreview({ heading, sellBtn, image, phone }) {
  return (
    <div className={phone ? 'w-[343px] max-w-full' : 'min-w-0 flex-1'}>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-mist-500">{phone ? 'Phone' : 'Desktop'}</p>
      <div className="relative overflow-hidden rounded-xl bg-[#13282D]" style={{ backgroundImage: image ? `url(${image})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B191D]/90 via-[#13282D]/70 to-[#13282D]/40" />
        <div className="relative px-4 py-5" style={phone ? undefined : { zoom: 0.55 }}>
          <div style={phone ? undefined : { width: 768 }}>
            <p className={`font-display font-extrabold leading-[1.08] tracking-tight text-white ${phone ? 'text-[34px]' : 'text-[60px]'}`}>
              <HeadingPieces segments={heading} />
            </p>
            <div className={`mt-4 grid gap-2 ${sellBtn.enabled ? 'grid-cols-2' : 'grid-cols-1'} ${phone ? '' : 'w-max grid-flow-col'}`}>
              <span className="btn btn-lg btn-primary pointer-events-none px-4">Explore cars</span>
              {sellBtn.enabled && <span className="btn btn-lg btn-sun pointer-events-none truncate px-4 uppercase tracking-wide">{sellBtn.label || 'Sell your car'}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The standard banner heading (coloured words, line breaks) and the "Sell your car" button. */
function BannerTextManager() {
  const { state, setConfig } = useStore();
  const toast = useToast();
  const savedHeading = hasHeading(state.config.heroHeading) ? state.config.heroHeading : DEFAULT_HEADING;
  const savedBtn = { ...DEFAULT_CONFIG.heroSellButton, ...(state.config.heroSellButton || {}) };
  const [heading, setHeading] = useState(savedHeading);
  const [btn, setBtn] = useState(savedBtn);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState({});
  useEffect(() => setHeading(hasHeading(state.config.heroHeading) ? state.config.heroHeading : DEFAULT_HEADING), [state.config.heroHeading]);
  useEffect(() => setBtn({ ...DEFAULT_CONFIG.heroSellButton, ...(state.config.heroSellButton || {}) }), [state.config.heroSellButton]);
  const check = cleanHeading(heading, { required: true });
  const changed = JSON.stringify(check.segments) !== JSON.stringify(cleanHeading(savedHeading).segments) || JSON.stringify(btn) !== JSON.stringify(savedBtn);
  const image = (state.config.heroSlides || []).find((h) => h.enabled !== false)?.image;
  const save = async () => {
    const e = {};
    if (check.error) e.heading = check.error;
    if (btn.enabled && (btn.label.trim().length < 2 || btn.label.trim().length > 24)) e.label = 'Use 2–24 characters';
    if (btn.action === 'link' && !/^\/(?!\/)/.test(btn.link.trim()) && !/^https:\/\//.test(btn.link.trim())) e.link = 'Start with / (a page on this site) or https://';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await api('PATCH', '/admin/config', { heroHeading: check.segments, heroSellButton: { ...btn, label: btn.label.trim(), link: btn.link.trim() } });
      setConfig(r.config);
      toast('Banner heading and button saved. The home page shows them straight away.');
    } catch (x) {
      setErr({ form: x.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Type className="h-4 w-4" /> Banner heading &amp; Sell button
        </span>
      }
      description="The big heading on the home banner (used on every slide that has no headline of its own) and the yellow “Sell your car” button. Size and weight stay the same on desktop and phones; only the words, line breaks and colours change."
    >
      <div className="space-y-5">
        {err.form && <Alert tone="error">{err.form}</Alert>}
        <div>
          <p className="label">Heading</p>
          <HeadingEditor id="hero-heading" value={heading} onChange={setHeading} error={err.heading || check.error} />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
            <span className={err.heading || check.error ? 'text-bad-600' : 'text-mist-500'}>
              {err.heading || check.error || `${headingText(heading).replace(/\n/g, '').length}/${HEADING_MAX_CHARS} characters · ${headingText(heading).split('\n').length}/${HEADING_MAX_LINES} lines`}
            </span>
            <button type="button" className="inline-flex items-center gap-1 font-semibold text-mist-600 hover:text-ink-900" onClick={() => setHeading(DEFAULT_HEADING)}>
              <RotateCcw className="h-3.5 w-3.5" /> Use the standard heading
            </button>
          </div>
        </div>

        <fieldset className="rounded-xl border border-mist-200 p-4">
          <legend className="label px-1">“Sell your car” button</legend>
          <div className="space-y-3">
            <Checkbox checked={btn.enabled} onChange={() => setBtn({ ...btn, enabled: !btn.enabled })} label="Show the button on the banner" />
            {btn.enabled && (
              <div className="grid gap-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                <Field label="Button text" htmlFor="sell-label" error={err.label}>
                  <Input id="sell-label" maxLength={24} value={btn.label} onChange={(e) => setBtn({ ...btn, label: e.target.value })} error={err.label} />
                </Field>
                <Field label="When clicked, go to" htmlFor="sell-action">
                  <Select id="sell-action" value={btn.action} onChange={(e) => setBtn({ ...btn, action: e.target.value })} options={SELL_ACTIONS} />
                </Field>
                {btn.action === 'link' && (
                  <Field label="Link" htmlFor="sell-link" error={err.link} hint="A page here (/dealers, /how-it-works) or https://… (opens in a new tab)" className="md:col-span-2">
                    <Input id="sell-link" value={btn.link} placeholder="/how-it-works" onChange={(e) => setBtn({ ...btn, link: e.target.value })} error={err.link} className="font-mono text-[13px]" />
                  </Field>
                )}
              </div>
            )}
          </div>
        </fieldset>

        <div>
          <p className="label">Preview</p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <BannerPreview heading={check.segments.length ? check.segments : heading} sellBtn={btn} image={image} />
            <BannerPreview heading={check.segments.length ? check.segments : heading} sellBtn={btn} image={image} phone />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {changed && (
            <Button variant="ghost" onClick={() => { setHeading(savedHeading); setBtn(savedBtn); setErr({}); }}>
              Discard changes
            </Button>
          )}
          <Button onClick={save} loading={busy} disabled={!changed}>
            Save heading &amp; button
          </Button>
        </div>
      </div>
    </Section>
  );
}

/** Trust indicators: the short lines with icons under the home banner buttons. */
function TrustManager() {
  const { state, setConfig } = useStore();
  const toast = useToast();
  const saved = state.config.trustIndicators || DEFAULT_CONFIG.trustIndicators;
  const [rows, setRows] = useState(saved);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setRows(state.config.trustIndicators || DEFAULT_CONFIG.trustIndicators), [state.config.trustIndicators]);
  const changed = JSON.stringify(rows) !== JSON.stringify(saved);
  const set = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i, d) => setRows((r) => {
    const n = [...r];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    return n;
  });
  const add = () => setRows((r) => [...r, { id: `ti_new${Date.now().toString(36)}`, text: '', icon: 'badge-check', link: '', enabled: true }]);
  const save = async () => {
    const e = {};
    rows.forEach((t, i) => {
      const n = t.text.trim().length;
      if (n < 2 || n > 40) e[i] = 'Use 2–40 characters';
      else if (t.link && !/^\/(?!\/)/.test(t.link) && !/^https:\/\//.test(t.link)) e[i] = 'Links start with / (a page on this site) or https://';
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await api('PATCH', '/admin/config', { trustIndicators: rows.map((t) => ({ ...t, text: t.text.trim(), link: (t.link || '').trim() })) });
      setConfig(r.config);
      toast('Trust indicators saved. The home page shows them straight away.');
    } catch (x) {
      toast(x.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const shown = rows.filter((t) => t.enabled !== false && t.text.trim());
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4" /> Trust indicators
        </span>
      }
      description={`The short lines with icons under the banner buttons on the home page. Up to ${MAX_TRUST_INDICATORS}; hidden ones stay here for later.`}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-[#13282D] px-5 py-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">Preview</p>
          {shown.length ? <TrustIndicators items={shown} /> : <p className="text-sm text-white/60">Nothing is shown under the banner.</p>}
        </div>
        <ul className="space-y-2">
          {rows.map((t, i) => (
            <li key={t.id} className={`rounded-xl border p-3 ${t.enabled === false ? 'border-dashed border-mist-200 bg-mist-50/60' : 'border-mist-200'}`}>
              <div className="flex flex-col gap-2 md:flex-row md:items-start">
                <div className="flex shrink-0 items-center gap-2 md:w-44">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#13282D]">
                    <TrustIcon name={t.icon} className="h-4 w-4 text-[#F8D000]" />
                  </span>
                  <Select aria-label={`Icon for indicator ${i + 1}`} value={t.icon} onChange={(e) => set(i, { icon: e.target.value })} options={TRUST_ICON_OPTIONS.map(({ value, label }) => ({ value, label }))} />
                </div>
                <div className="min-w-0 flex-1">
                  <Input aria-label={`Text for indicator ${i + 1}`} value={t.text} maxLength={40} placeholder="e.g. Verified documents" onChange={(e) => set(i, { text: e.target.value })} error={errors[i]} />
                  {errors[i] && <p className="field-error">{errors[i]}</p>}
                </div>
                <div className="md:w-56">
                  <Input aria-label={`Link for indicator ${i + 1}`} value={t.link || ''} placeholder="Link (optional), e.g. /how-it-works" onChange={(e) => set(i, { link: e.target.value })} />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {t.enabled === false && <Badge>Hidden</Badge>}
                  <button type="button" className="btn-icon" aria-label={t.enabled === false ? 'Show on the home page' : 'Hide from the home page'} title={t.enabled === false ? 'Show' : 'Hide'} onClick={() => set(i, { enabled: t.enabled === false })}>
                    {t.enabled === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button type="button" className="btn-icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-icon" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-icon text-bad-600" aria-label="Remove" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
          {!rows.length && <li className="rounded-xl border border-dashed border-mist-200 p-4 text-sm text-mist-500">No trust indicators. Add one, or leave it empty to show none.</li>}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon={Plus} onClick={add} disabled={rows.length >= MAX_TRUST_INDICATORS}>
            Add indicator
          </Button>
          <Button variant="ghost" icon={RotateCcw} onClick={() => setRows(DEFAULT_CONFIG.trustIndicators)}>
            Use the standard three
          </Button>
          <span className="flex-1" />
          {changed && (
            <Button variant="ghost" onClick={() => { setRows(saved); setErrors({}); }}>
              Discard changes
            </Button>
          )}
          <Button onClick={save} loading={busy} disabled={!changed}>
            Save trust indicators
          </Button>
        </div>
      </div>
    </Section>
  );
}

export default function AdminContent() {
  return (
    <div className="space-y-6">
      <PageHeader title="Website content" description="What visitors see: the home page banner (slides, heading, Sell button and trust indicators), the cities people can choose, and the photos on the Dealers page." />
      <BannerManager />
      <BannerTextManager />
      <TrustManager />
      <CitiesManager />
      <CityPhotos />
    </div>
  );
}
