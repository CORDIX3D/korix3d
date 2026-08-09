'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type InstallState = 'checking' | 'ready' | 'manual' | 'installed';

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [state, setState] = useState<InstallState>('checking');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const alreadyInstalled = window.matchMedia('(display-mode: standalone)').matches
      || navigatorWithStandalone.standalone === true;

    if (alreadyInstalled) {
      setState('installed');
      return;
    }

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/production-sw.js', { scope: '/' }).catch(() => {
        setState('manual');
      });
    }

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setState('ready');
    };

    const onInstalled = () => {
      setInstallPrompt(null);
      setShowHelp(false);
      setState('installed');
    };

    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    const fallbackTimer = window.setTimeout(() => {
      setState((current) => current === 'checking' ? 'manual' : current);
    }, 1800);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setShowHelp((current) => !current);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === 'accepted') {
      setState('installed');
      setShowHelp(false);
    } else {
      setState('manual');
    }
  };

  if (state === 'installed') {
    return (
      <Button type="button" className="mt-7 w-full" disabled>
        <CheckCircle2 className="mr-2 h-4 w-4" />Aplikacja jest zainstalowana
      </Button>
    );
  }

  return (
    <div className="mt-7">
      <Button
        type="button"
        className="w-full"
        onClick={install}
        disabled={state === 'checking'}
      >
        {state === 'checking' ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Przygotowuję instalację…</>
        ) : (
          <><Download className="mr-2 h-4 w-4" />Zainstaluj KORIX3D</>
        )}
      </Button>

      {showHelp && (
        <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-sm leading-6 text-sky-100">
          W Edge lub Chrome kliknij ikonę instalacji po prawej stronie paska adresu. Jeśli jej nie widać, wybierz menu <strong>⋯ → Aplikacje → Zainstaluj tę witrynę jako aplikację</strong>.
        </div>
      )}
    </div>
  );
}
