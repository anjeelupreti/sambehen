'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * A labelled field that shows the API's own validation message.
 *
 * The API returns 422 with `{ field, constraint, message }` per failure, and
 * that message is the accurate one — it knows the real constraint. Showing
 * it beside the input, rather than paraphrasing it in a toast, is what makes
 * a rejected form fixable: the user sees which box is wrong and why.
 *
 * `aria-invalid` and `aria-describedby` are wired so the error is announced
 * rather than only shown in red.
 */
export function FormField({
  name,
  label,
  error,
  hint,
  required,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => React.ReactNode;
}) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>
        {label}
        {required ? (
          <span className="text-muted-foreground" aria-hidden>
            *
          </span>
        ) : null}
      </Label>

      {children({ id: name, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}

      {error ? (
        <p id={`${name}-error`} className="text-destructive text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The common case: a labelled text input bound to a field name. */
export function TextField({
  name,
  label,
  value,
  onChange,
  error,
  hint,
  required,
  type = 'text',
  placeholder,
  maxLength,
  inputMode,
  autoFocus,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'email' | 'tel';
  autoFocus?: boolean;
}) {
  return (
    <FormField name={name} label={label} error={error} hint={hint} required={required}>
      {(props) => (
        <Input
          {...props}
          name={name}
          type={type}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormField>
  );
}

/** A labelled select bound to a field name. */
export function SelectField({
  name,
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  error,
  hint,
  required,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <FormField name={name} label={label} error={error} hint={hint} required={required}>
      {(props) => (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger
            id={props.id}
            aria-invalid={props['aria-invalid']}
            aria-describedby={props['aria-describedby']}
            className={cn('w-full')}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}
