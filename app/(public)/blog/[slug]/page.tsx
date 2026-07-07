import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { OptimizedImage } from '@/components/ui/optimized-image';

export const dynamic = 'force-dynamic';

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();
  const { data: post, error } = await supabase.from('blog_posts').select('*').eq('slug', params.slug).eq('published', true).maybeSingle();
  if (error) throw new Error('Nie udało się pobrać artykułu.');
  if (!post) notFound();

  return <article className="mx-auto min-h-screen max-w-3xl px-4 py-12">
    <Link href="/blog" className="mb-8 inline-flex items-center gap-2 text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Wróć do bloga</Link>
    {post.cover_image_url && <OptimizedImage src={post.cover_image_url} alt={post.title} className="mb-8 aspect-video w-full rounded-2xl object-cover" sizes="(max-width: 768px) 100vw, 768px" />}
    <p className="mb-3 text-sm uppercase tracking-wider text-primary">{post.category}</p>
    <h1 className="mb-4 text-3xl font-bold sm:text-4xl">{post.title}</h1>
    <p className="mb-8 text-sm text-muted-foreground">{post.published_at ? new Date(post.published_at).toLocaleDateString('pl-PL') : ''}</p>
    <div className="whitespace-pre-wrap leading-7 text-foreground/90">{post.content || post.excerpt}</div>
  </article>;
}
