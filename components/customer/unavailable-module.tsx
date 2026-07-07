import { LucideIcon } from 'lucide-react';
import { PanelEmpty, PanelHeading } from './panel-state';

export function UnavailableModule({ title, description, icon, emptyTitle, emptyDescription, actionLabel, actionHref }: { title: string; description: string; icon: LucideIcon; emptyTitle: string; emptyDescription: string; actionLabel?: string; actionHref?: string }) {
  return <div className="space-y-6"><PanelHeading title={title} description={description} /><PanelEmpty icon={icon} title={emptyTitle} description={emptyDescription} actionLabel={actionLabel} actionHref={actionHref} /></div>;
}
