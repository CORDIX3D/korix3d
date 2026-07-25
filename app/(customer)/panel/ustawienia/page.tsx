'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, Save, Settings, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PanelHeading } from '@/components/customer/panel-state';
import {
  profileUpdateSchema,
  type ProfileUpdateValues,
} from '@/lib/profile-schema';

const emptyProfile: ProfileUpdateValues = {
  full_name: '',
  phone: '',
  company: '',
  nip: '',
  address_street: '',
  address_city: '',
  address_zip: '',
  address_country: 'Polska',
};

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileUpdateValues>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: emptyProfile,
  });

  useEffect(() => {
    reset({
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      company: profile?.company || '',
      nip: profile?.nip || '',
      address_street: profile?.address_street || '',
      address_city: profile?.address_city || '',
      address_zip: profile?.address_zip || '',
      address_country: profile?.address_country || 'Polska',
    });
  }, [profile, reset]);

  const saveProfile = async (values: ProfileUpdateValues) => {
    if (saving) return;
    setSaving(true);
    setServerError('');

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || 'Nie udało się zapisać profilu.');
      }

      await refreshProfile();
      reset(values);
      toast.success('Dane profilu zostały zapisane');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Nie udało się zapisać profilu.';
      setServerError(message);
      toast.error('Błąd zapisu', { description: message });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name: keyof ProfileUpdateValues) =>
    errors[name]?.message ? (
      <p className="mt-1 text-sm text-destructive">
        {errors[name]?.message}
      </p>
    ) : null;

  return (
    <div className="space-y-6">
      <PanelHeading
        title="Ustawienia"
        description="Dane kontaktowe i adresowe przypisane do Twojego konta."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Profil klienta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(saveProfile)}
            className="space-y-6"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-full-name">Imię i nazwisko</Label>
                <Input
                  id="profile-full-name"
                  autoComplete="name"
                  {...register('full_name')}
                />
                {fieldError('full_name')}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">Adres e-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="profile-email"
                    value={profile?.email || ''}
                    className="pl-10"
                    disabled
                    readOnly
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Adres logowania jest chroniony i nie zmienia się w tym formularzu.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-phone">Telefon</Label>
                <Input
                  id="profile-phone"
                  autoComplete="tel"
                  placeholder="+48 123 456 789"
                  {...register('phone')}
                />
                {fieldError('phone')}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-company">Firma</Label>
                <Input
                  id="profile-company"
                  autoComplete="organization"
                  {...register('company')}
                />
                {fieldError('company')}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-nip">NIP</Label>
                <Input
                  id="profile-nip"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="1234567890"
                  {...register('nip')}
                />
                {fieldError('nip')}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-country">Kraj</Label>
                <Input
                  id="profile-country"
                  autoComplete="country-name"
                  {...register('address_country')}
                />
                {fieldError('address_country')}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="profile-street">Ulica i numer</Label>
                <Input
                  id="profile-street"
                  autoComplete="street-address"
                  {...register('address_street')}
                />
                {fieldError('address_street')}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-postal-code">Kod pocztowy</Label>
                <Input
                  id="profile-postal-code"
                  autoComplete="postal-code"
                  placeholder="00-000"
                  maxLength={6}
                  {...register('address_zip')}
                />
                {fieldError('address_zip')}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-city">Miasto</Label>
                <Input
                  id="profile-city"
                  autoComplete="address-level2"
                  {...register('address_city')}
                />
                {fieldError('address_city')}
              </div>
            </div>

            {serverError && (
              <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {serverError}
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Rola konta i adres logowania nie mogą być zmienione tym formularzem.
              </div>
              <Button type="submit" disabled={saving || !isDirty}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saving ? 'Zapisywanie…' : 'Zapisz dane'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
