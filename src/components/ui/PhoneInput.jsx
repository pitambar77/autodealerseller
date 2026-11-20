// Phone number field with a country-code picker (every country; Tanzania, Kenya, Uganda, Rwanda,
// Burundi and India first). `value` and `onChange` use the international number, e.g. "+91 98610 21001".
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/format';
import { COUNTRIES, DEFAULT_COUNTRY, PINNED_COUNT, countryByCode, parsePhone, splitPhone } from '../../lib/phone';

/** The country picker on its own (sign-in and registration keep the country and number separately). */
export function CountrySelect({ value, onChange, className, id, disabled }) {
  const c = countryByCode(value);
  return (
    <span className={cn('relative block shrink-0', className)}>
      <select
        id={id}
        aria-label={`Country code: ${c.name} ${c.dial}`}
        value={c.code}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="input h-full w-full cursor-pointer appearance-none pr-6 text-transparent [&>*]:text-ink-900"
      >
        <optgroup label="Common">
          {COUNTRIES.slice(0, PINNED_COUNT).map((x) => (
            <option key={x.code} value={x.code}>
              {x.flag} {x.name} ({x.dial})
            </option>
          ))}
        </optgroup>
        <optgroup label="All countries">
          {COUNTRIES.slice(PINNED_COUNT).map((x) => (
            <option key={x.code} value={x.code}>
              {x.flag} {x.name} ({x.dial})
            </option>
          ))}
        </optgroup>
      </select>
      {/* What the closed picker shows: flag and code only */}
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center gap-1.5 text-[14.5px] text-ink-900" aria-hidden="true">
        <span className="text-[17px] leading-none">{c.flag}</span>
        <span className="font-medium num">{c.dial}</span>
      </span>
      <svg className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
      </svg>
    </span>
  );
}

/**
 * <PhoneInput id="x" value={phone} onChange={setPhone} error={err} />
 * Typing a full number with "+" also works and switches the country.
 */
export function PhoneInput({ id, value = '', onChange, onBlur, error, defaultCountry = DEFAULT_COUNTRY, placeholder, disabled, className, autoComplete = 'tel-national', name }) {
  const [state, setState] = useState(() => splitPhone(value, defaultCountry));
  const emitted = useRef(value);

  // A new value from outside (form reset, prefill): show it.
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setState(splitPhone(value, defaultCountry));
    }
  }, [value, defaultCountry]);

  const emit = (country, national) => {
    setState({ country, national });
    const raw = national.trim();
    const p = parsePhone(raw, country);
    const out = !raw ? '' : p ? p.formatInternational() : `${countryByCode(country).dial} ${raw}`;
    emitted.current = out;
    onChange?.(out);
  };

  return (
    <div className={cn('flex gap-2', className)}>
      <CountrySelect value={state.country} onChange={(c) => emit(c, state.national)} disabled={disabled} className="w-[104px]" />
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        disabled={disabled}
        value={state.national}
        placeholder={placeholder || (state.country === 'IN' ? '98765 43210' : state.country === 'TZ' ? '0712 345 678' : 'Mobile number')}
        aria-invalid={error ? true : undefined}
        onBlur={onBlur}
        onChange={(e) => {
          const v = e.target.value;
          // A pasted international number picks its own country.
          if (v.trim().startsWith('+')) {
            const p = parsePhone(v, state.country);
            if (p?.country) return emit(p.country, p.formatNational());
          }
          return emit(state.country, v);
        }}
        className={cn('input min-w-0 flex-1 font-mono text-[15px]', error && 'input-error')}
      />
    </div>
  );
}
