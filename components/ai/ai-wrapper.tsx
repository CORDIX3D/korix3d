'use client';

import dynamic from 'next/dynamic';

// Dynamic import with ssr disabled to prevent hydration issues
const AIAssistant = dynamic(() => import('./ai-assistant').then(mod => ({ default: mod.AIAssistant })), {
  ssr: false,
  loading: () => null
});

export function AIWrapper() {
  return <AIAssistant />;
}
