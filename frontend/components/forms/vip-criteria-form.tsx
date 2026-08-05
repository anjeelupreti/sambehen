'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { createVipCriteria, updateVipCriteria } from '@/app/(app)/vip-criteria/actions';
import { useAction } from '@/hooks/use-action';
import type { VipCriteria } from '@/lib/types';
import { format } from 'date-fns';

const criteriaSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  tier: z.coerce.number().min(1, 'Tier must be at least 1'),
  thresholdAmount: z.coerce.number().min(0, 'Threshold must be positive'),
  periodStart: z.string().min(1, 'Start date is required'),
  periodEnd: z.string().min(1, 'End date is required'),
  // No `.default()`: it makes the field optional on input but required on
  // output, which zodResolver cannot reconcile with a single form type.
  // The default lives in defaultValues instead.
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof criteriaSchema>;

export function VipCriteriaForm({
  initialData,
  onSaved,
}: {
  initialData?: VipCriteria;
  /** Called after a successful save — lets a modal close itself. */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(criteriaSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      tier: initialData?.tier ?? 1,
      // Money arrives as a string from the API; the number input needs a
      // number. It goes back out as a string on submit.
      thresholdAmount: Number(initialData?.thresholdAmount ?? 0),
      periodStart: initialData?.periodStart
        ? format(new Date(initialData.periodStart), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd'),
      periodEnd: initialData?.periodEnd
        ? format(new Date(initialData.periodEnd), 'yyyy-MM-dd')
        : format(new Date(new Date().setMonth(new Date().getMonth() + 1)), 'yyyy-MM-dd'),
      isActive: initialData?.isActive ?? true,
    },
  });

  const create = useAction(createVipCriteria);
  const update = useAction(updateVipCriteria);
  const fieldErrors = initialData ? update.fieldErrors : create.fieldErrors;
  const error = Object.values(fieldErrors)[0];

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      // Money leaves as a string: it is `numeric(18,2)` on the API side and
      // a float cannot hold every 2dp value exactly.
      const payload = {
        ...data,
        thresholdAmount: String(data.thresholdAmount),
        periodStart: new Date(data.periodStart).toISOString(),
        periodEnd: new Date(data.periodEnd).toISOString(),
      };

      const result = initialData
        ? await update.run(initialData.id, payload)
        : await create.run(payload);

      if (result.ok) {
        onSaved?.();
        router.refresh();
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
        {error && (
          <div className="bg-destructive/15 text-destructive rounded-md p-3 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Summer High Rollers" {...field} />
                </FormControl>
                <FormDescription>Internal name for this criteria.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tier Level</FormLabel>
                <FormControl>
                  <Input type="number" min="1" {...field} />
                </FormControl>
                <FormDescription>Higher numbers mean higher priority.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="thresholdAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Threshold Amount</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" {...field} />
                </FormControl>
                <FormDescription>Amount required to qualify.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="periodStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period Start</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="periodEnd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period End</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 col-span-2">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Active Status</FormLabel>
                  <FormDescription>
                    If inactive, this criteria is hidden and cannot qualify new VIPs.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving...' : initialData ? 'Save changes' : 'Create criteria'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
