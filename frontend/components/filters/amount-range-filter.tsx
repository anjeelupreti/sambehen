'use client';

import { useEffect, useState } from 'react';
import { BanknoteIcon } from 'lucide-react';

import { useFilterParams } from '@/hooks/use-filter-params';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { formatMoney, toPlotValue } from '@/lib/money';

/**
 * Min/max amount filter.
 *
 * The values stay strings the whole way through — they are money, and the
 * API matches them against `numeric(18,2)`. Typing them into a number input
 * would round-trip them through a float for no benefit.
 *
 * The API accepts a positive decimal only, so anything else is held back
 * rather than sent and bounced as a 422 the user cannot act on.
 *
 * The slider is a coarse companion to the text inputs, not a replacement —
 * `toPlotValue` is the one sanctioned path from a money string to a number
 * (see lib/money.ts), used here for thumb position exactly as it is for a
 * chart coordinate. It is capped at $1,500, comfortably above what this
 * platform's transactions actually reach; a figure beyond that is still
 * reachable by typing it, just not by dragging.
 */
const DECIMAL = /^\d+(\.\d{1,2})?$/;
const SLIDER_MIN = 0;
const SLIDER_MAX = 1500;
const SLIDER_STEP = 10;

const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi);

export function AmountRangeFilter() {
  const { get, setMany } = useFilterParams();

  const min = get('minAmount');
  const max = get('maxAmount');
  const active = Boolean(min || max);

  const [draftMin, setDraftMin] = useState(min ?? '');
  const [draftMax, setDraftMax] = useState(max ?? '');

  useEffect(() => setDraftMin(min ?? ''), [min]);
  useEffect(() => setDraftMax(max ?? ''), [max]);

  const minValid = draftMin === '' || DECIMAL.test(draftMin);
  const maxValid = draftMax === '' || DECIMAL.test(draftMax);
  const ordered =
    draftMin === '' || draftMax === '' || !minValid || !maxValid
      ? true
      : Number(draftMin) <= Number(draftMax);

  const canApply = minValid && maxValid && ordered;

  const sliderValue: [number, number] = [
    draftMin && minValid ? clamp(toPlotValue(draftMin), SLIDER_MIN, SLIDER_MAX) : SLIDER_MIN,
    draftMax && maxValid ? clamp(toPlotValue(draftMax), SLIDER_MIN, SLIDER_MAX) : SLIDER_MAX,
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={active ? 'secondary' : 'outline'} size="sm" className="gap-2">
          <BanknoteIcon className="size-4" />
          {active ? (
            <span className="tabular">
              {min ? formatMoney(min) : 'Any'} – {max ? formatMoney(max) : 'Any'}
            </span>
          ) : (
            'Amount'
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 space-y-3">
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="minAmount" className="text-xs">
              Minimum
            </Label>
            <Input
              id="minAmount"
              inputMode="decimal"
              placeholder="0.00"
              value={draftMin}
              aria-invalid={!minValid}
              onChange={(event) => setDraftMin(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="maxAmount" className="text-xs">
              Maximum
            </Label>
            <Input
              id="maxAmount"
              inputMode="decimal"
              placeholder="0.00"
              value={draftMax}
              aria-invalid={!maxValid}
              onChange={(event) => setDraftMax(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2 px-1">
          <Slider
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={SLIDER_STEP}
            value={sliderValue}
            onValueChange={([lo, hi]) => {
              setDraftMin(lo <= SLIDER_MIN ? '' : lo.toFixed(2));
              setDraftMax(hi >= SLIDER_MAX ? '' : hi.toFixed(2));
            }}
          />
          <div className="text-muted-foreground flex justify-between text-[10px] tabular">
            <span>{formatMoney(String(SLIDER_MIN))}</span>
            <span>{formatMoney(String(SLIDER_MAX))}+</span>
          </div>
        </div>

        {!minValid || !maxValid ? (
          <p className="text-destructive text-xs">Use a positive amount, up to two decimals.</p>
        ) : !ordered ? (
          <p className="text-destructive text-xs">The minimum is above the maximum.</p>
        ) : null}

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={!canApply}
            onClick={() =>
              setMany({ minAmount: draftMin || undefined, maxAmount: draftMax || undefined })
            }
          >
            Apply
          </Button>
          {active ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMany({ minAmount: undefined, maxAmount: undefined })}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
