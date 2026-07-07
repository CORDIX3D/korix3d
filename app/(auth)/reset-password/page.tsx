'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';

const resetSchema = z.object({
  password: z.string().min(8, 'Hasło musi mieć co najmniej 8 znaków').regex(/[a-z]/, 'Hasło musi zawierać małą literę').regex(/[A-Z]/, 'Hasło musi zawierać wielką literę').regex(/\d/, 'Hasło musi zawierać cyfrę'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, { message: 'Hasła nie są takie same', path: ['confirmPassword'] });

type ResetForm = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const submit = async (data: ResetForm) => {
    setLoading(true); setServerError('');
    const { error } = await supabase.auth.updateUser({ password: data.password });
    setLoading(false);
    if (error) { setServerError('Link resetujący jest nieprawidłowy lub wygasł. Poproś o nową wiadomość.'); return; }
    setSuccess(true);
  };

  return <div className="min-h-screen flex items-center justify-center px-4 py-16"><Card className="w-full max-w-md"><CardHeader className="text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">{success ? <CheckCircle2 className="h-7 w-7 text-green-500" /> : <Lock className="h-7 w-7 text-primary" />}</div><CardTitle className="text-2xl">{success ? 'Hasło zostało zmienione' : 'Ustaw nowe hasło'}</CardTitle></CardHeader><CardContent>{success ? <div className="text-center"><p className="mb-6 text-muted-foreground">Możesz zalogować się przy użyciu nowego hasła.</p><Button asChild><Link href="/logowanie">Przejdź do logowania</Link></Button></div> : <form onSubmit={handleSubmit(submit)} className="space-y-4"><div><Label htmlFor="password">Nowe hasło</Label><Input id="password" type="password" autoComplete="new-password" {...register('password')} />{errors.password && <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>}</div><div><Label htmlFor="confirmPassword">Powtórz hasło</Label><Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />{errors.confirmPassword && <p className="mt-1 text-sm text-destructive">{errors.confirmPassword.message}</p>}</div>{serverError && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{serverError}</p>}<Button className="w-full" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{loading ? 'Zapisywanie...' : 'Zmień hasło'}</Button></form>}</CardContent></Card></div>;
}
