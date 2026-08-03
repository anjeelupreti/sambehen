import { redirect } from 'next/navigation';

import { getActor } from '@/lib/session';

export default async function RootPage() {
  redirect((await getActor()) ? '/dashboard' : '/login');
}
