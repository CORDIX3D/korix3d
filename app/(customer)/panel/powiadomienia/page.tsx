'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  CircleAlert,
  Info,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PanelEmpty, PanelError, PanelHeading, PanelLoading } from '@/components/customer/panel-state';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import type { Notification } from '@/lib/types/database';

const notificationIcons = {
  info: Info,
  success: CheckCircle2,
  warning: CircleAlert,
  error: AlertCircle,
} as const;

const notificationColors = {
  info: 'bg-blue-500/10 text-blue-400',
  success: 'bg-green-500/10 text-green-400',
  warning: 'bg-amber-500/10 text-amber-400',
  error: 'bg-destructive/10 text-destructive',
} as const;

function notificationType(value: Notification['type']) {
  return value && value in notificationIcons ? value : 'info';
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (queryError) throw queryError;
      setNotifications((data || []) as Notification[]);
    } catch {
      setNotifications([]);
      setError('Nie udało się pobrać powiadomień. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.read !== true).length,
    [notifications]
  );

  const markRead = async (notificationId: string) => {
    const target = notifications.find((notification) => notification.id === notificationId);
    if (!target || target.read === true) return;

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      )
    );
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', user?.id || '');

    if (updateError) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, read: false } : notification
        )
      );
    }
  };

  const markAllRead = async () => {
    if (!user || unreadCount === 0 || updating) return;
    setUpdating(true);
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
      if (updateError) throw updateError;
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    } catch {
      setError('Nie udało się oznaczyć powiadomień jako przeczytane.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PanelHeading
          title="Powiadomienia"
          description="Aktualizacje dotyczące płatności, wycen i realizacji zamówień."
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={loadNotifications} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Odśwież
          </Button>
          {unreadCount > 0 && (
            <Button type="button" variant="outline" onClick={markAllRead} disabled={updating}>
              <Check className="mr-2 h-4 w-4" />
              Oznacz wszystkie jako przeczytane
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <PanelLoading label="Pobieranie powiadomień..." />
      ) : error && notifications.length === 0 ? (
        <PanelError message={error} onRetry={loadNotifications} />
      ) : notifications.length === 0 ? (
        <PanelEmpty
          icon={Bell}
          title="Brak powiadomień"
          description="Gdy zmieni się status płatności, wyceny lub zamówienia, informacja pojawi się tutaj."
          actionLabel="Sprawdź zamówienia"
          actionHref="/panel/zamowienia"
        />
      ) : (
        <div className="space-y-3">
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {notifications.map((notification) => {
            const type = notificationType(notification.type);
            const Icon = notificationIcons[type];
            const content = (
              <Card
                className={`transition-colors hover:border-primary/40 ${
                  notification.read === true ? 'bg-card/60' : 'border-primary/30 bg-primary/[0.04]'
                }`}
              >
                <CardContent className="flex gap-4 p-5">
                  <div className={`mt-0.5 rounded-xl p-2.5 ${notificationColors[type]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{notification.title}</p>
                      {notification.read !== true && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          Nowe
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(notification.created_at).toLocaleString('pl-PL')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );

            return notification.link ? (
              <Link
                key={notification.id}
                href={notification.link}
                onClick={() => void markRead(notification.id)}
              >
                {content}
              </Link>
            ) : (
              <button
                key={notification.id}
                type="button"
                onClick={() => void markRead(notification.id)}
                className="block w-full text-left"
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
