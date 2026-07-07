'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/lib/providers';
import { Eye, Mail, Loader2, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Nieprawidłowy adres email'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await resetPassword(data.email);

      if (error) {
        setError(error.message);
        toast.error('Błąd', {
          description: error.message,
        });
      } else {
        setSuccess(true);
        setSubmittedEmail(data.email);
        toast.success('Email wysłany', {
          description: 'Sprawdź swoją skrzynkę email',
        });
      }
    } catch (err) {
      setError('Wystąpił nieoczekiwany błąd');
      toast.error('Błąd', {
        description: 'Wystąpił nieoczekiwany błąd',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-20">
        <div className="absolute inset-0 bg-3d-grid opacity-30"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent"></div>

        <Card className="relative bg-card border-border shadow-2xl w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Sprawdź email
            </h2>
            <p className="text-muted-foreground mb-6">
              Wysłaliśmy instrukcje resetowania hasła na adres{' '}
              <strong className="text-foreground">{submittedEmail}</strong>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Nie widzisz emaila? Sprawdź folder SPAM
            </p>
            <Link href="/logowanie">
              <Button className="bg-gradient-primary hover:shadow-glow transition-shadow">
                Powrót do logowania
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-20">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-3d-grid opacity-30"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent"></div>

      <div className="relative w-full max-w-md">
        <Link
          href="/logowanie"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Powrót do logowania
        </Link>

        <Card className="bg-card border-border shadow-2xl">
          <CardHeader className="text-center pb-2">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-orange-600 rounded-2xl flex items-center justify-center shadow-glow">
                  <span className="text-white font-bold text-2xl">K</span>
                </div>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Zapomniałeś hasła?
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Podaj swój email, a wyślemy instrukcje resetowania hasła
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label className="form-label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    placeholder="twoj@email.pl"
                    className="pl-12 h-12 bg-secondary border-border focus:border-primary"
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-shadow"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Wysyłanie...
                  </>
                ) : (
                  'Wyślij instrukcje'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
