'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mail,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Imię musi mieć co najmniej 2 znaki').max(100, 'Imię jest za długie'),
  email: z.string().trim().toLowerCase().email('Nieprawidłowy adres email').max(254),
  phone: z.string().trim().max(30, 'Numer telefonu jest za długi').refine((value) => !value || /^[+\d\s()-]+$/.test(value), 'Nieprawidłowy numer telefonu').optional(),
  subject: z.string().trim().min(3, 'Temat musi mieć co najmniej 3 znaki').max(150, 'Temat jest za długi'),
  message: z.string().trim().min(10, 'Wiadomość musi mieć co najmniej 10 znaków').max(5000, 'Wiadomość jest za długa'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

const businessHours = [
  { day: 'Poniedziałek', hours: '9:00 - 17:00' },
  { day: 'Wtorek', hours: '9:00 - 17:00' },
  { day: 'Środa', hours: '9:00 - 17:00' },
  { day: 'Czwartek', hours: '9:00 - 17:00' },
  { day: 'Piątek', hours: '9:00 - 17:00' },
  { day: 'Sobota', hours: 'Zamknięte' },
  { day: 'Niedziela', hours: 'Zamknięte' },
];

export default function ContactPage({ searchParams }: { searchParams?: { temat?: string; produkt?: string } }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      subject: searchParams?.produkt ? `Pytanie o produkt ${searchParams.produkt}` : searchParams?.temat === 'zamowienie' ? 'Zapytanie dotyczące zamówienia' : '',
    },
  });

  const onSubmit = async (data: ContactFormValues) => {
    setSubmitting(true);

    try {
      const { error } = await supabase.from('contact_submissions').insert([
        {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          subject: data.subject,
          message: data.message,
        },
      ]);

      if (error) throw error;

      toast.success('Wiadomość wysłana', {
        description: 'Odpowiemy najszybciej jak to możliwe',
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting contact form:', error);
      toast.error('Błąd', {
        description: 'Wystąpił błąd podczas wysyłania wiadomości',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="bg-card border-border max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Dziękujemy za wiadomość!
            </h2>
            <p className="text-muted-foreground mb-6">
              Twoja wiadomość została wysłana. Odpowiemy w ciągu 24 godzin w dni robocze.
            </p>
            <Button
              onClick={() => { reset(); setSubmitted(false); }}
              variant="outline"
              className="w-full"
            >
              Wyślij kolejną wiadomość
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative py-16 bg-gradient-to-b from-primary/10 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Kontakt
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Masz pytania? Chętnie pomożemy. Skontaktuj się z nami przez formularz lub bezpośrednio.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Contact Form */}
            <Card className="bg-card border-border">
              <CardContent className="p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  Wyślij wiadomość
                </h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="contact-name" className="form-label">Imię i nazwisko *</label>
                      <Input
                        id="contact-name"
                        {...register('name')}
                        autoComplete="name"
                        placeholder="Jan Kowalski"
                        className="h-12 bg-secondary border-border"
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive">{errors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="contact-email" className="form-label">Email *</label>
                      <Input
                        id="contact-email"
                        {...register('email')}
                        type="email"
                        autoComplete="email"
                        placeholder="twoj@email.pl"
                        className="h-12 bg-secondary border-border"
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="contact-phone" className="form-label">Telefon</label>
                    <Input
                      id="contact-phone"
                      {...register('phone')}
                      type="tel"
                      autoComplete="tel"
                      placeholder="+48 123 456 789"
                      className="h-12 bg-secondary border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="contact-subject" className="form-label">Temat *</label>
                    <Input
                      id="contact-subject"
                      {...register('subject')}
                      placeholder="Wycena zamówienia"
                      className="h-12 bg-secondary border-border"
                    />
                    {errors.subject && (
                      <p className="text-sm text-destructive">{errors.subject.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="contact-message" className="form-label">Wiadomość *</label>
                    <Textarea
                      id="contact-message"
                      {...register('message')}
                      placeholder="Opisz swoje pytanie lub projekt..."
                      className="bg-secondary border-border min-h-[150px]"
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive">{errors.message.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-shadow"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Wysyłanie...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Wyślij wiadomość
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div className="space-y-6">
              {/* Contact Details */}
              <Card className="bg-card border-border">
                <CardContent className="p-6 sm:p-8">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    Dane kontaktowe
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">Email</h3>
                        <a
                          href="mailto:kontakt@korix3d.pl"
                          className="text-primary hover:underline"
                        >
                          kontakt@korix3d.pl
                        </a>
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>

              {/* Business Hours */}
              <Card className="bg-card border-border">
                <CardContent className="p-6 sm:p-8">
                  <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Clock className="w-6 h-6 text-primary" />
                    Godziny pracy
                  </h2>
                  <div className="space-y-3">
                    {businessHours.map((item) => (
                      <div
                        key={item.day}
                        className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                      >
                        <span className="font-medium text-foreground">{item.day}</span>
                        <span
                          className={`${
                            item.hours === 'Zamknięte'
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {item.hours}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
