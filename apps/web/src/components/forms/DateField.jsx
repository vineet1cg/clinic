import { useController } from 'react-hook-form';
import { formatClinicDate, formatDateInput, parseDisplayDate } from '../../utils/format.js';
import { inputClassName } from './FormField.jsx';

export function DateField({ control, name, id, disabled = false }) {
  const { field, fieldState } = useController({ control, name });
  const value = field.value || '';
  const displayValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatClinicDate(value) : value;

  function handleChange(event) {
    const isDeletingSeparator =
      event.nativeEvent.inputType === 'deleteContentBackward' &&
      displayValue.endsWith('/') &&
      event.target.value === displayValue.slice(0, -1);
    const nextDisplayValue = isDeletingSeparator
      ? event.target.value.slice(0, -1)
      : formatDateInput(event.target.value);
    field.onChange(parseDisplayDate(nextDisplayValue) || undefined);
  }

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
      value={displayValue}
      onChange={handleChange}
    />
  );
}
