'use client';

import { useActionState, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CameraIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { updateMyProfile, type ProfileFormState } from '@/app/customer/(portal)/profile/actions';
import { ChatAvatar } from '@/components/chat/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Profile {
  username: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

/** Crops the picked image to a centred square and shrinks it before upload. */
async function toSquare(file: File, size = 320): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext('2d')!
    .drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
  bitmap.close();
  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.88));
  // Safari before 17 can't encode WebP and quietly hands back PNG instead.
  const webp = await encode('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  return (await encode('image/jpeg'))!;
}

/** The player's photo, and the details they may change about themselves. */
export function ProfileEditor({ profile }: { profile: Profile }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState(profile.avatarUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(
    async (previous, form) => {
      const result = await updateMyProfile(previous, form);
      if (result.status === 'saved') {
        toast.success('Profile saved.');
        router.refresh();
      }
      return result;
    },
    { status: 'idle' },
  );

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }
    setBusy(true);
    try {
      const blob = await toSquare(file);
      const body = new FormData();
      body.append('file', new File([blob], 'photo', { type: blob.type }));
      const response = await fetch('/customer/profile/avatar', { method: 'POST', body });
      const json = (await response.json()) as { avatarUrl?: string; error?: string };
      if (!response.ok || !json.avatarUrl) throw new Error(json.error);
      setPhoto(json.avatarUrl);
      toast.success('Photo updated.');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message ? error.message : 'Your photo couldn’t be saved.',
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const response = await fetch('/customer/profile/avatar', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setPhoto(null);
      toast.success('Photo removed.');
      router.refresh();
    } catch {
      toast.error('Your photo couldn’t be removed.');
    } finally {
      setBusy(false);
    }
  };

  const name = profile.fullName || profile.username;
  const error = (key: string) => state.fieldErrors?.[key];

  return (
    <div className="space-y-6">
      <section className="bg-card flex flex-wrap items-center gap-5 rounded-2xl border p-5">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="focus-visible:ring-ring/70 group relative rounded-full outline-none focus-visible:ring-[3px]"
          aria-label="Change photo"
        >
          <ChatAvatar name={name} src={photo} size="xl" className="size-20 text-xl" />
          <span className="bg-primary text-primary-foreground ring-card absolute right-0 bottom-0 grid size-7 place-items-center rounded-full ring-2">
            {busy ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <CameraIcon className="size-3.5" />
            )}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{name}</p>
          <p className="text-muted-foreground text-sm">{profile.username}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {photo ? 'Change photo' : 'Add a photo'}
            </Button>
            {photo && (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={remove}>
                Remove
              </Button>
            )}
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </section>

      <form action={action} noValidate className="bg-card space-y-5 rounded-2xl border p-5">
        <h2 className="text-base font-semibold">Your details</h2>

        <FormField
          label="Full name"
          name="fullName"
          defaultValue={profile.fullName}
          error={error('fullName')}
          autoComplete="name"
        />
        <FormField
          label="Phone"
          name="phone"
          defaultValue={profile.phone}
          error={error('phone')}
          optional
          autoComplete="tel"
          type="tel"
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <FormField
            label="City"
            name="city"
            defaultValue={profile.city}
            optional
            autoComplete="address-level2"
          />
          <FormField
            label="State"
            name="state"
            defaultValue={profile.state}
            optional
            autoComplete="address-level1"
          />
          <FormField
            label="Country"
            name="country"
            defaultValue={profile.country}
            optional
            autoComplete="country-name"
          />
        </div>

        <div className="bg-muted/60 grid gap-4 rounded-xl p-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs">Email</p>
            <p className="truncate text-sm font-medium">{profile.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Username</p>
            <p className="text-sm font-medium">{profile.username}</p>
          </div>
          <p className="text-muted-foreground text-xs sm:col-span-2">
            You sign in with these, so your store changes them for you.
          </p>
        </div>

        {state.message && (
          <p role="alert" className="text-destructive text-sm">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}

function FormField({
  label,
  name,
  defaultValue,
  error,
  optional,
  ...props
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  error?: string;
  optional?: boolean;
} & Omit<React.ComponentProps<typeof Input>, 'defaultValue' | 'name'>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
      </Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${name}-error`} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
