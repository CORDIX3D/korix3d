'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Bot, Loader2 } from 'lucide-react';

const AIAssistant = dynamic(
  () => import('./ai-assistant').then((module) => module.AIAssistant),
  {
    ssr: false,
    loading: () => (
      <div className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#FF6A00] to-orange-600 shadow-lg shadow-orange-500/30">
        <Loader2 className="h-7 w-7 animate-spin text-white" aria-label="Ładowanie asystenta KORIX AI" />
      </div>
    ),
  }
);

export function AIWrapper() {
  const [requested, setRequested] = useState(false);

  if (requested) return <AIAssistant initiallyOpen />;

  return (
    <button
      type="button"
      onClick={() => setRequested(true)}
      aria-label="Otwórz asystenta KORIX AI"
      className="group fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#FF6A00] to-orange-600 shadow-lg shadow-orange-500/30 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-orange-500/40"
    >
      <Bot className="h-7 w-7 text-white transition-transform group-hover:scale-110" />
      <span className="absolute -right-1 -top-1 h-4 w-4 animate-pulse rounded-full border-2 border-background bg-green-500" />
    </button>
  );
}
