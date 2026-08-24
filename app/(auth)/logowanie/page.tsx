'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/lib/providers';
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthErrorMessage, isEmailNotConfirmedError } from '@/lib/auth-error';
import { normalizeInternalPath } from '@/lib/navigation';
import { getAdminHomePath, isStaffRole } from '@/lib/admin-access';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Nieprawidłowy adres email'),
  password: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get('redirect');
  const { signIn, resendSignupConfirmation } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [error, setError] = useState<string | null>(() =>
    searchParams.get('error') === 'callback_error'
      ? 'Link logowania jest nieprawidłowy lub wygasł. Spróbuj zalogować się ponownie.'
      : null
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const { error, role } = await signIn(data.email, data.password);

      if (error) {
        const message = getAuthErrorMessage(error, 'login');
        setUnconfirmedEmail(isEmailNotConfirmedError(error) ? data.email : '');
        setError(message);
        toast.error('Błąd logowania', {
          description: message,
        });
      } else {
        setUnconfirmedEmail('');
        const defaultRedirect = isStaffRole(role)
          ? getAdminHomePath(role)
          : '/panel';
        const redirect = normalizeInternalPath(
          requestedRedirect,
          defaultRedirect
        );
        toast.success('Zalogowano pomyślnie');
        router.replace(redirect);
        router.refresh();
      }
    } catch {
      setError('Nie udało się połączyć z usługą logowania. Spróbuj ponownie za chwilę.');
      toast.error('Błąd', {
        description: 'Nie udało się połączyć z usługą logowania',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resendConfirmation = async () => {
    if (!unconfirmedEmail || isResending) return;
    setIsResending(true);
    const { error } = await resendSignupConfirmation(unconfirmedEmail);
    if (error) {
      toast.error('Nie udało się wysłać wiadomości', {
        description: getAuthErrorMessage(error, 'reset'),
      });
    } else {
      toast.success('Wysłano nowy link aktywacyjny', {
        description: 'Sprawdź skrzynkę odbiorczą i folder SPAM.',
      });
    }
    setIsResending(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-20">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-3d-grid opacity-30"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent"></div>

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Powrót do strony głównej
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
              Zaloguj się
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Wprowadź swoje dane aby się zalogować
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {error && (
              <div className="mb-6 space-y-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
                {unconfirmedEmail && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isResending}
                    onClick={resendConfirmation}
                  >
                    {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Wyślij link aktywacyjny ponownie
                  </Button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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

              <div className="space-y-2">
                <label className="form-label">Hasło</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pl-12 pr-12 h-12 bg-secondary border-border focus:border-primary"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="flex justify-end">
                <Link
                  href="/odzyskaj-haslo"
                  className="text-sm text-primary hover:underline"
                >
                  Zapomniałeś hasła?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-shadow"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Logowanie...
                  </>
                ) : (
                  'Zaloguj się'
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-4 text-sm text-muted-foreground">
                  lub
                </span>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Nie masz konta?{' '}
              <Link href="/rejestracja" className="text-primary hover:underline font-medium">
                Zarejestruj się
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Ładowanie logowania" /></div>}>
      <LoginPageContent />
    </Suspense>
  );
}
