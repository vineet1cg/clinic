import { useController } from 'react-hook-form';
import { formatClinicDate, parseDisplayDate } from '../../utils/format.js';
import { inputClassName } from './FormField.jsx';

export function DateField({ control, name, id, disabled = false }) {
  const { field, fieldState } = useController({ control, name });
  const value = field.value || '';
  return (
    <input
      {...field}
      id={id}
      disabled={disabled}
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/yyyy"
      maxLength={10}
      className={inputClassName}
      aria-invalid={Boolean(fieldState.error)}
      value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? formatClinicDate(value) : value}
      onChange={(event) => field.onChange(parseDisplayDate(event.target.value) || undefined)}
    />
  );
}
