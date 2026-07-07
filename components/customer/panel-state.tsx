import Link from 'next/link';
import { AlertCircle, Loader2, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function PanelLoading({ label = 'Ładowanie danych...' }: { label?: string }) {
  return <div className="flex min-h-[280px] items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />{label}</div>;
}

export function PanelError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Card className="border-destructive/30 bg-destructive/5"><CardContent className="flex flex-col items-center p-10 text-center"><AlertCircle className="mb-3 h-10 w-10 text-destructive" /><h2 className="text-lg font-semibold">Nie udało się pobrać danych</h2><p className="mt-2 max-w-lg text-sm text-muted-foreground">{message}</p>{onRetry && <Button className="mt-5" variant="outline" onClick={onRetry}>Spróbuj ponownie</Button>}</CardContent></Card>;
}

export function PanelEmpty({ icon: Icon, title, description, actionLabel, actionHref }: { icon: LucideIcon; title: string; description: string; actionLabel?: string; actionHref?: string }) {
  return <Card className="border-dashed bg-card/60"><CardContent className="flex flex-col items-center px-6 py-14 text-center"><div className="mb-4 rounded-2xl bg-primary/10 p-4"><Icon className="h-9 w-9 text-primary" /></div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>{actionLabel && actionHref && <Button asChild className="mt-6"><Link href={actionHref}>{actionLabel}</Link></Button>}</CardContent></Card>;
}

export function PanelHeading({ title, description }: { title: string; description: string }) {
  return <div><h1 className="text-2xl font-bold sm:text-3xl">{title}</h1><p className="mt-1 text-muted-foreground">{description}</p></div>;
}
