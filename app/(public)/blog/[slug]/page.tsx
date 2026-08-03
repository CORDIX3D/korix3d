import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { absoluteSiteUrl, seoDescription, serializeJsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const BLOG_POST_SELECT = 'id, title, slug, excerpt, content, cover_image_url, category, published_at, meta_title, meta_description, created_at, updated_at';

const getBlogPost = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select(BLOG_POST_SELECT)
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error) throw new Error('Nie udało się pobrać artykułu.');
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();
  const description = seoDescription(post.meta_description || post.excerpt, 'Artykuł KORIX3D o profesjonalnym druku 3D.');
  const canonical = `/blog/${encodeURIComponent(slug)}`;
  return {
    title: post.meta_title || post.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: canonical,
      title: post.meta_title || post.title,
      description,
      publishedTime: post.published_at || undefined,
      images: post.cover_image_url ? [post.cover_image_url] : [],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: seoDescription(post.excerpt, 'Artykuł KORIX3D o profesjonalnym druku 3D.'),
    image: post.cover_image_url ? [post.cover_image_url] : undefined,
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || post.published_at || undefined,
    mainEntityOfPage: absoluteSiteUrl(`/blog/${encodeURIComponent(post.slug)}`),
    author: { '@type': 'Organization', name: 'KORIX3D' },
    publisher: { '@type': 'Organization', name: 'KORIX3D' },
  };

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd) }} /><article className="mx-auto min-h-screen max-w-3xl px-4 py-12">
    <Link href="/blog" className="mb-8 inline-flex items-center gap-2 text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Wróć do bloga</Link>
    {post.cover_image_url && <OptimizedImage src={post.cover_image_url} alt={post.title} className="mb-8 aspect-video w-full rounded-2xl object-cover" sizes="(max-width: 768px) 100vw, 768px" />}
    <p className="mb-3 text-sm uppercase tracking-wider text-primary">{post.category}</p>
    <h1 className="mb-4 text-3xl font-bold sm:text-4xl">{post.title}</h1>
    <p className="mb-8 text-sm text-muted-foreground">{post.published_at ? new Date(post.published_at).toLocaleDateString('pl-PL') : ''}</p>
    <div className="whitespace-pre-wrap leading-7 text-foreground/90">{post.content || post.excerpt}</div>
  </article></>;
}
