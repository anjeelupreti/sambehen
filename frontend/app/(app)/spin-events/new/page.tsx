import type { Metadata } from 'next';
import { ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SpinEventForm } from '@/components/forms/spin-event-form';
import { getActor } from '@/lib/session';

export const metadata: Metadata = { title: 'New Spin Event' };

export default async function NewSpinEventPage() {
  const actor = await getActor();
  if (actor?.role !== 'master') {
    redirect('/dashboard');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/spin-winners">
            <ChevronLeftIcon className="size-4" />
            <span className="sr-only">Back to Spin Events</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New Spin Event</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent>
          <SpinEventForm />
        </CardContent>
      </Card>
    </div>
  );
}
