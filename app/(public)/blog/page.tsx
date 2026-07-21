'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PenTool, Calendar, ArrowRight, User } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { BlogPost } from '@/lib/types/database';
import { OptimizedImage } from '@/components/ui/optimized-image';

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    setError(false);
    try {
      const { data, error: queryError } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('published', true)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(20);

      if (queryError) throw queryError;
      setPosts((data || []) as BlogPost[]);
    } catch {
      setPosts([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative py-16 bg-gradient-to-b from-primary/10 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <PenTool className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Blog
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Porady, tutoriale i nowości ze świata druku 3D
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {error && <div className="py-16 text-center"><PenTool className="mx-auto mb-4 h-16 w-16 text-destructive" /><h2 className="text-xl font-semibold">Nie udało się pobrać artykułów</h2><p className="mt-2 text-muted-foreground">Sprawdź połączenie i spróbuj ponownie.</p><Button className="mt-5" variant="outline" onClick={fetchPosts}>Spróbuj ponownie</Button></div>}

          {/* Featured Post */}
          {!error && posts.length > 0 && (
            <Link href={`/blog/${posts[0].slug}`} className="block mb-12">
              <Card className="bg-card border-border hover:border-primary/50 transition-all overflow-hidden group">
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-2 gap-6">
                    {posts[0].cover_image_url && (
                      <div className="aspect-video md:aspect-auto bg-secondary overflow-hidden">
                        <OptimizedImage
                          src={posts[0].cover_image_url}
                          alt={posts[0].title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-8 flex flex-col justify-center">
                      <span className="text-sm text-primary mb-3 uppercase tracking-wider">
                        Artykuł tygodnia
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors">
                        {posts[0].title}
                      </h2>
                      <p className="text-muted-foreground mb-4 line-clamp-3">
                        {posts[0].excerpt}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {posts[0].published_at
                            ? new Date(posts[0].published_at).toLocaleDateString('pl-PL')
                            : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Posts Grid */}
          {!error && (posts.length > 1 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.slice(1).map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <Card className="bg-card border-border hover:border-primary/50 transition-all overflow-hidden group h-full">
                    <CardContent className="p-0">
                      {post.cover_image_url ? (
                        <div className="aspect-video bg-secondary overflow-hidden">
                          <OptimizedImage
                            src={post.cover_image_url}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-gradient-to-br from-primary/10 to-orange-600/10 flex items-center justify-center">
                          <PenTool className="w-16 h-16 text-primary/30" />
                        </div>
                      )}
                      <div className="p-6">
                        <span className="text-xs text-primary uppercase tracking-wider">
                          {post.category}
                        </span>
                        <h3 className="text-lg font-semibold text-foreground mt-2 mb-3 group-hover:text-primary transition-colors line-clamp-2">
                          {post.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {post.excerpt}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {post.published_at
                              ? new Date(post.published_at).toLocaleDateString('pl-PL')
                              : '—'}
                          </span>
                          <span className="flex items-center gap-1 text-primary font-medium">
                            Czytaj więcej
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <PenTool className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Brak artykułów
              </h3>
              <p className="text-muted-foreground">
                Obecnie nie ma opublikowanych artykułów.
              </p>
            </div>
          ) : null)}
        </div>
      </section>
    </div>
  );
}
