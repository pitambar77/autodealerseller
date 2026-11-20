import { RotateCcw } from 'lucide-react';
import { Select, Checkbox } from '../ui';
import { CITIES, CONDITIONS, makesFor, modelsFor } from '../../data/catalog';
import { typeFor, usageLabel } from '../../data/vehicleTypes';
import { SPEC_FIELDS } from '../../data/specFields';
import { num, tzsShort } from '../../utils/format';

const YEARS = Array.from({ length: 13 }, (_, i) => 2026 - i);

function Group({ title, children }) {
  return (
    <fieldset className="space-y-2.5 border-b border-mist-100 pb-5 last:border-0">
      <legend className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-mist-500">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Filters for one category: brands, budgets, types, fuels and spec filters all come from the category's settings. */
export function FilterPanel({ filters, onChange, onReset, category = 'car' }) {
  const T = typeFor(category);
  const set = (k) => (e) => onChange({ [k]: e.target.value, ...(k === 'make' ? { model: '' } : {}) });
  const fuels = filters.fuel ? filters.fuel.split(',') : [];
  const toggleFuel = (f) => {
    const next = fuels.includes(f) ? fuels.filter((x) => x !== f) : [...fuels, f];
    onChange({ fuel: next.join(',') });
  };
  const priceOptions = T.priceSteps.map((p) => ({ value: String(p), label: tzsShort(p) }));
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Filters</h2>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-700 hover:underline">
          <RotateCcw className="h-3.5 w-3.5" /> Reset all
        </button>
      </div>
      <Group title="Brand & model">
        <Select aria-label="Brand" value={filters.make || ''} onChange={set('make')} placeholder="Any brand" options={makesFor(category)} />
        <Select aria-label="Model" value={filters.model || ''} onChange={set('model')} placeholder={filters.make ? 'Any model' : 'Choose a brand first'} options={filters.make ? modelsFor(filters.make, category) : []} disabled={!filters.make} />
      </Group>
      <Group title="Budget">
        <div className="grid grid-cols-2 gap-2">
          <Select aria-label="Minimum price" value={filters.minPrice || ''} onChange={set('minPrice')} placeholder="Min" options={priceOptions} />
          <Select aria-label="Maximum price" value={filters.maxPrice || ''} onChange={set('maxPrice')} placeholder="Max" options={priceOptions} />
        </div>
      </Group>
      <Group title={T.bodyLabel}>
        <Select aria-label={T.bodyLabel} value={filters.body || ''} onChange={set('body')} placeholder={`Any ${T.bodyLabel.toLowerCase()}`} options={T.bodies} />
      </Group>
      {/* Specification filters chosen for this category in Admin → Categories */}
      {T.specFields
        .filter((f) => f.filter && SPEC_FIELDS[f.key].filter)
        .map(({ key }) => {
          const spec = SPEC_FIELDS[key];
          const legacy = { engineCc: 'cc', payloadT: 'payload' }[key];
          const value = filters[key] || (legacy && filters[legacy]) || '';
          const options = spec.filter.kind === 'exact' ? spec.options : spec.filter.options;
          return (
            <Group key={key} title={spec.label}>
              <Select aria-label={spec.label} value={value} onChange={(e) => onChange({ [key]: e.target.value, ...(legacy ? { [legacy]: '' } : {}) })} placeholder="Any" options={options} />
            </Group>
          );
        })}
      <Group title="Model year">
        <div className="grid grid-cols-2 gap-2">
          <Select aria-label="From year" value={filters.minYear || ''} onChange={set('minYear')} placeholder="From" options={YEARS.map(String)} />
          <Select aria-label="To year" value={filters.maxYear || ''} onChange={set('maxYear')} placeholder="To" options={YEARS.map(String)} />
        </div>
      </Group>
      <Group title={usageLabel(T)}>
        <Select aria-label={usageLabel(T)} value={filters.maxKm || ''} onChange={set('maxKm')} placeholder="Any" options={T.kmSteps.map((k) => ({ value: String(k), label: `Under ${num(k)} ${T.usage === 'hours' ? 'hours' : 'km'}` }))} />
      </Group>
      <Group title="Fuel type">
        <div className="grid grid-cols-2 gap-2">
          {T.fuels.map((f) => (
            <Checkbox key={f} label={f} checked={fuels.includes(f)} onChange={() => toggleFuel(f)} />
          ))}
        </div>
      </Group>
      <Group title="Transmission">
        <div className="grid grid-cols-3 gap-1.5">
          {['', ...T.transmissions].map((t) => (
            <button
              key={t || 'any'}
              type="button"
              onClick={() => onChange({ transmission: t })}
              className={`rounded-lg border px-2 py-1.5 text-[13px] font-semibold ${(filters.transmission || '') === t ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-mist-200 text-mist-700 hover:border-mist-300'}`}
            >
              {t || 'Any'}
            </button>
          ))}
        </div>
      </Group>
      <Group title="Location">
        <Select aria-label="City" value={filters.city || ''} onChange={set('city')} placeholder="All cities" options={CITIES.map((c) => c.name)} />
      </Group>
      <Group title="Condition">
        <Select aria-label="Condition" value={filters.condition || ''} onChange={set('condition')} placeholder="Any condition" options={CONDITIONS} />
      </Group>
    </div>
  );
}
