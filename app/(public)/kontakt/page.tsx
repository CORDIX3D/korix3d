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
  MapPin,
  Mail,
  Phone,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

const contactSchema = z.object({
  name: z.string().min(2, 'Imię musi mieć co najmniej 2 znaki'),
  email: z.string().email('Nieprawidłowy adres email'),
  phone: z.string().optional(),
  subject: z.string().min(3, 'Temat musi mieć co najmniej 3 znaki'),
  message: z.string().min(10, 'Wiadomość musi mieć co najmniej 10 znaków'),
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

export default function ContactPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormValues) => {
    setSubmitting(true);

    try {
      const { error } = await supabase.from('contact_submissions').insert([
        {
          name: data.name,
          email: data.email,
          phone: data.phone,
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
              onClick={() => setSubmitted(false)}
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
                      <label className="form-label">Imię i nazwisko *</label>
                      <Input
                        {...register('name')}
                        placeholder="Jan Kowalski"
                        className="h-12 bg-secondary border-border"
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive">{errors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="form-label">Email *</label>
                      <Input
                        {...register('email')}
                        type="email"
                        placeholder="twoj@email.pl"
                        className="h-12 bg-secondary border-border"
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="form-label">Telefon</label>
                    <Input
                      {...register('phone')}
                      type="tel"
                      placeholder="+48 123 456 789"
                      className="h-12 bg-secondary border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="form-label">Temat *</label>
                    <Input
                      {...register('subject')}
                      placeholder="Wycena zamówienia"
                      className="h-12 bg-secondary border-border"
                    />
                    {errors.subject && (
                      <p className="text-sm text-destructive">{errors.subject.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="form-label">Wiadomość *</label>
                    <Textarea
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
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">Adres</h3>
                        <p className="text-muted-foreground">
                          ul. Przykładowa 1<br />
                          00-001 Warszawa
                        </p>
                      </div>
                    </div>

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

                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Phone className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">Telefon</h3>
                        <a
                          href="tel:+48123456789"
                          className="text-primary hover:underline"
                        >
                          +48 123 456 789
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

              {/* Map */}
              <Card className="bg-card border-border overflow-hidden">
                <div className="aspect-video bg-secondary">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2443.484743098387!2d21.012228700000005!3d52.2296756!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x471ecc8c0d1c6c7d%3A0x5ce09b3f3c3d3c3c!2sWarszawa%2C%20Poland!5e0!3m2!1sen!2sus!4v1699999999999!5m2!1sen!2sus"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
