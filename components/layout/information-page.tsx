import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function InformationPage({ title, intro, sections }: { title: string; intro: string; sections: Array<{ title: string; content: string }> }) {
  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-primary/10 to-transparent py-16">
        <div className="mx-auto max-w-4xl px-4">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Strona główna</Link>
          <h1 className="text-4xl font-bold sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{intro}</p>
        </div>
      </section>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-12">
        {sections.map(section => <section key={section.title} className="rounded-2xl border bg-card p-6"><h2 className="mb-3 text-xl font-semibold">{section.title}</h2><p className="whitespace-pre-line leading-7 text-muted-foreground">{section.content}</p></section>)}
      </div>
    </div>
  );
}
