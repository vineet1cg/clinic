import { CLINIC_BRAND } from '../../constants/branding.js';

export function ClinicBrand({ inverse = false, subtitle = CLINIC_BRAND.descriptor }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <img
        src={CLINIC_BRAND.logo}
        alt="Maitri mother and child emblem"
        width="827"
        height="1024"
        className="clinic-logo h-14 w-12 shrink-0 rounded-lg object-contain p-1"
      />
      <span className="min-w-0">
        <span
          className={`block font-display text-xl font-bold tracking-wide ${inverse ? 'text-white' : 'text-clinic-text'}`}
        >
          {CLINIC_BRAND.name}
        </span>
        <span
          className={`block text-xs leading-5 ${inverse ? 'text-cyan-100' : 'text-clinic-muted'}`}
        >
          {subtitle}
        </span>
      </span>
    </span>
  );
}
