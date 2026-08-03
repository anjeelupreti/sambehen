'use client';

import { useFilterParams } from '@/hooks/use-filter-params';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * A single-choice filter bound to one query parameter.
 *
 * "Any" is modelled as a sentinel value rather than an empty string: Radix
 * Select treats `''` as "no selection" and would render the placeholder
 * instead of the option, leaving the user unable to see what they picked.
 * The sentinel never reaches the URL — it deletes the parameter instead.
 */
const ANY = '__any__';

export function FilterSelect({
  param,
  label,
  options,
  anyLabel = `All ${label.toLowerCase()}`,
  className = 'w-[150px]',
}: {
  param: string;
  label: string;
  options: FilterOption[];
  anyLabel?: string;
  className?: string;
}) {
  const { get, setParam } = useFilterParams();
  const current = get(param) ?? ANY;

  return (
    <Select
      value={current}
      onValueChange={(value) => setParam(param, value === ANY ? undefined : value)}
    >
      <SelectTrigger size="sm" className={className} aria-label={label}>
        <SelectValue placeholder={anyLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{anyLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
