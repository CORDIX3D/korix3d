'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, PenTool } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { BlogPost } from '@/lib/types/database';

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { supabase.from('blog_posts').select('*').eq('slug', params.slug).eq('published', true).maybeSingle().then(({ data }: { data: BlogPost | null }) => { setPost(data); setLoading(false); }); }, [params.slug]);
  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!post) return <div className="min-h-[60vh] flex items-center justify-center text-center"><div><PenTool className="mx-auto mb-4 h-14 w-14 text-muted-foreground" /><h1 className="text-2xl font-bold">Nie znaleziono artykułu</h1><Link href="/blog" className="mt-5 inline-block text-primary">Wróć do bloga</Link></div></div>;
  return <article className="mx-auto min-h-screen max-w-3xl px-4 py-12"><Link href="/blog" className="mb-8 inline-flex items-center gap-2 text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Wróć do bloga</Link>{post.cover_image_url && <img src={post.cover_image_url} alt={post.title} className="mb-8 aspect-video w-full rounded-2xl object-cover" />}<p className="mb-3 text-sm uppercase tracking-wider text-primary">{post.category}</p><h1 className="mb-4 text-3xl font-bold sm:text-4xl">{post.title}</h1><p className="mb-8 text-sm text-muted-foreground">{post.published_at ? new Date(post.published_at).toLocaleDateString('pl-PL') : ''}</p><div className="whitespace-pre-wrap leading-7 text-foreground/90">{post.content || post.excerpt}</div></article>;
}
