'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  PanelEmpty,
  PanelError,
  PanelHeading,
  PanelLoading,
} from '@/components/customer/panel-state';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import type { ContactSubmission } from '@/lib/types/database';

export function CustomerMessages() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('contact_submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (queryError) throw queryError;
      setMessages((data || []) as ContactSubmission[]);
    } catch {
      setMessages([]);
      setError('Nie udało się pobrać historii wiadomości. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.email || sending) return;

    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    if (cleanSubject.length < 3 || cleanSubject.length > 150) {
      toast.error('Temat musi mieć od 3 do 150 znaków');
      return;
    }
    if (cleanMessage.length < 10 || cleanMessage.length > 5000) {
      toast.error('Wiadomość musi mieć od 10 do 5000 znaków');
      return;
    }

    const profileName = String(profile?.full_name || user.user_metadata?.full_name || '').trim();
    const senderName = profileName.length >= 2 ? profileName : 'Klient KORIX3D';

    setSending(true);
    try {
      const response = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: senderName,
          email: user.email,
          phone: profile?.phone || '',
          subject: cleanSubject,
          message: cleanMessage,
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || 'Nie udało się wysłać wiadomości.');
      }

      setSubject('');
      setMessage('');
      toast.success('Wiadomość została wysłana');
      await loadMessages();
    } catch (sendError) {
      toast.error('Nie udało się wysłać wiadomości', {
        description: sendError instanceof Error ? sendError.message : 'Spróbuj ponownie za chwilę.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PanelHeading
          title="Wiadomości"
          description="Pytania wysłane do KORIX3D i odpowiedzi administratora."
        />
        <Button type="button" variant="outline" onClick={loadMessages} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Napisz wiadomość
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={sendMessage} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="customer-message-subject" className="form-label">Temat</label>
              <Input
                id="customer-message-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                minLength={3}
                maxLength={150}
                required
                disabled={sending}
                placeholder="Np. pytanie o realizację zamówienia"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="customer-message-content" className="form-label">Treść</label>
              <Textarea
                id="customer-message-content"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                minLength={10}
                maxLength={5000}
                required
                disabled={sending}
                className="min-h-32"
                placeholder="Opisz sprawę i podaj numer zamówienia, jeśli go dotyczy."
              />
              <p className="text-right text-xs text-muted-foreground">{message.length}/5000</p>
            </div>
            <Button type="submit" disabled={sending || !user?.email}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {sending ? 'Wysyłanie...' : 'Wyślij wiadomość'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Historia</h2>
        {loading ? (
          <PanelLoading label="Pobieranie wiadomości..." />
        ) : error ? (
          <PanelError message={error} onRetry={loadMessages} />
        ) : messages.length === 0 ? (
          <PanelEmpty
            icon={MessageSquare}
            title="Brak wiadomości"
            description="Po wysłaniu pierwszego pytania jego status i odpowiedź pojawią się tutaj."
          />
        ) : (
          <div className="space-y-4">
            {messages.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{entry.subject || 'Bez tematu'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Wysłano {new Date(entry.created_at).toLocaleString('pl-PL')}
                      </p>
                    </div>
                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      entry.admin_reply
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {entry.admin_reply ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                      {entry.admin_reply ? 'Odpowiedziano' : 'Oczekuje na odpowiedź'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-secondary/70 p-4">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Twoja wiadomość</p>
                    <p className="whitespace-pre-wrap text-sm leading-6">{entry.message}</p>
                  </div>

                  {entry.admin_reply && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">Odpowiedź KORIX3D</p>
                      <p className="whitespace-pre-wrap text-sm leading-6">{entry.admin_reply}</p>
                      {entry.replied_at && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {new Date(entry.replied_at).toLocaleString('pl-PL')}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
