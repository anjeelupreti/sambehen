'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changeOwnPassword, updateOwnProfile } from '@/app/(app)/staff/actions';
import { useRouter } from 'next/navigation';

export function EditProfileModal({
  open,
  onOpenChange,
  initialData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: { firstName?: string; lastName?: string; phone?: string; username: string };
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: initialData.firstName ?? '',
    lastName: initialData.lastName ?? '',
    phone: initialData.phone ?? '',
  });

  const [newPassword, setNewPassword] = useState('');
  const [passwordPending, startPasswordTransition] = useTransition();

  // Reset form when opened with new data
  useEffect(() => {
    if (open) {
      setForm({
        firstName: initialData.firstName ?? '',
        lastName: initialData.lastName ?? '',
        phone: initialData.phone ?? '',
      });
      setNewPassword('');
    }
  }, [open, initialData]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateOwnProfile(form);

      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  const onUpdatePassword = () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    startPasswordTransition(async () => {
      const result = await changeOwnPassword(newPassword);

      if (result.ok) {
        toast.success(result.message);
        setNewPassword('');
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
          <DialogDescription>
            Update your personal details for {initialData.username}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="Jane"
                value={form.firstName}
                onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={form.lastName}
                onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              placeholder="+1..."
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>

        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">Change Password</h4>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={passwordPending || !newPassword}
              onClick={onUpdatePassword}
            >
              {passwordPending ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
