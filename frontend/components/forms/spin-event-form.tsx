'use client';

import { useEffect, useState, useTransition } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createSpinEvent } from '@/app/(app)/spin-events/actions';
import { listActiveVipCriteria } from '@/app/(app)/vip-criteria/actions';
import { useAction } from '@/hooks/use-action';
import type { VipCriteria } from '@/lib/types';
import { format } from 'date-fns';

const spinEventSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  criteriaId: z.string().min(1, 'Criteria is required'),
  scheduledFor: z.string().min(1, 'Date is required'),
});

type FormValues = z.infer<typeof spinEventSchema>;

export function SpinEventForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [criteriaList, setCriteriaList] = useState<VipCriteria[]>([]);

  useEffect(() => {
    // Only active criteria are allowed for spin events. Fetched through a
    // server action: the API client needs the httpOnly session cookie,
    // which browser JavaScript cannot read.
    listActiveVipCriteria().then(setCriteriaList).catch(console.error);
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(spinEventSchema),
    defaultValues: {
      name: '',
      criteriaId: '',
      scheduledFor: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    },
  });

  // `useAction` wraps a server action: it toasts the outcome and hands back
  // any 422 field errors rather than throwing across the server/client
  // boundary, where the message would be replaced by a generic digest.
  const { run, fieldErrors } = useAction(createSpinEvent);
  const error = Object.values(fieldErrors)[0];

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      const result = await run({
        ...data,
        scheduledFor: new Date(data.scheduledFor).toISOString(),
      });

      if (result.ok) {
        router.push('/spin-winners');
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

        <div className="grid gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Summer Mega Draw" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="criteriaId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>VIP Criteria (Eligibility)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select active criteria" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {criteriaList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} (Tier {c.tier})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Only customers who meet this criteria can participate or win.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="scheduledFor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Scheduled Time</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving...' : 'Create Event'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
