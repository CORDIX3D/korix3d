'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/lib/providers';
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const registerSchema = z.object({
  full_name: z.string().trim().min(2, 'Imię musi mieć co najmniej 2 znaki').max(100),
  email: z.string().trim().toLowerCase().email('Nieprawidłowy adres email'),
  password: z.string().min(8, 'Hasło musi mieć co najmniej 8 znaków').regex(/[a-z]/, 'Hasło musi zawierać małą literę').regex(/[A-Z]/, 'Hasło musi zawierać wielką literę').regex(/\d/, 'Hasło musi zawierać cyfrę'),
  confirmPassword: z.string(),
  terms: z.boolean().refine((value) => value, 'Zaakceptuj regulamin i politykę prywatności'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Hasła nie są zgodne',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { terms: false },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await signUp(data.email, data.password, data.full_name);

      if (error) {
        if (error.message.includes('already registered')) {
          setError('Konto z tym adresem email już istnieje');
        } else {
          setError(error.message);
        }
        toast.error('Błąd rejestracji', {
          description: error.message,
        });
      } else {
        setSuccess(true);
        setRegisteredEmail(data.email);
        toast.success('Konto utworzone pomyślnie');
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
              Konto utworzone!
            </h2>
            <p className="text-muted-foreground mb-6">
              Sprawdź swoją skrzynkę email <strong className="text-foreground">{registeredEmail}</strong> aby potwierdzić konto.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Nie widzisz emaila? Sprawdź folder SPAM lub
            </p>
            <Link href="/logowanie">
              <Button className="bg-gradient-primary hover:shadow-glow transition-shadow">
                Przejdź do logowania
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
              Utwórz konto
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Dołącz do KORIX3D i zacznij drukować
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
                <label className="form-label">Imię i nazwisko</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    {...register('full_name')}
                    type="text"
                    autoComplete="name"
                    placeholder="Jan Kowalski"
                    className="pl-12 h-12 bg-secondary border-border focus:border-primary"
                    disabled={isLoading}
                  />
                </div>
                {errors.full_name && (
                  <p className="text-sm text-destructive">{errors.full_name.message}</p>
                )}
              </div>

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
                    autoComplete="new-password"
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

              <div className="space-y-2">
                <label className="form-label">Potwierdź hasło</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    {...register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pl-12 pr-12 h-12 bg-secondary border-border focus:border-primary"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? 'Ukryj powtórzone hasło' : 'Pokaż powtórzone hasło'}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  {...register('terms')}
                  className="w-4 h-4 mt-1 rounded border-border bg-secondary accent-primary"
                />
                <span className="text-sm text-muted-foreground">
                  Akceptuję{' '}
                  <Link href="/regulamin" className="text-primary hover:underline">
                    regulamin
                  </Link>{' '}
                  oraz{' '}
                  <Link href="/polityka-prywatnosci" className="text-primary hover:underline">
                    politykę prywatności
                  </Link>
                </span>
              </div>
              {errors.terms && <p className="text-sm text-destructive">{errors.terms.message}</p>}

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-shadow"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Rejestracja...
                  </>
                ) : (
                  'Zarejestruj się'
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
              Masz już konto?{' '}
              <Link href="/logowanie" className="text-primary hover:underline font-medium">
                Zaloguj się
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
