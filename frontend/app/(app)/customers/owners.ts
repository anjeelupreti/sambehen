import 'server-only';

import type { AssignableOwner } from '@/components/forms/new-customer-modal';
import { apiList } from '@/lib/api';
import type { Staff, StaffRole } from '@/lib/types';

/**
 * Who a player can be given to: the managers and stores the viewer can
 * see. Masters sit above the chain and never own players; stores can't
 * move players at all, so nothing is fetched for them.
 */
export async function assignableOwners(role: StaffRole | undefined): Promise<AssignableOwner[]> {
  if (!role || role === 'store') return [];
  const { data } = await apiList<Staff>('/team/staff', { query: { limit: 100, isActive: true } });
  return data
    .filter((member) => member.role !== 'master')
    .map((member) => ({
      id: member.id,
      username: member.username,
      role: member.role,
      parentId: member.parentId,
    }));
}
