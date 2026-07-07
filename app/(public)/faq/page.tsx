'use client';

import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, HelpCircle, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { FAQItem } from '@/lib/types/database';

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    const { data, error: queryError } = await supabase
      .from('faq_items')
      .select('*')
      .eq('active', true)
      .order('sort_order');

    if (data) {
      const faqItems = data as FAQItem[];
      setFaqs(faqItems);
      const uniqueCategories = Array.from(
        new Set(faqItems.map((f) => f.category).filter(Boolean))
      ) as string[];
      setCategories(uniqueCategories);
    }
    setError(Boolean(queryError));
    setLoading(false);
  };

  const filteredFAQs = faqs.filter((faq) => {
    const matchesCategory = !selectedCategory || faq.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative py-16 bg-gradient-to-b from-primary/10 to-transparent">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Często zadawane pytania
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Znajdź odpowiedzi na najczęściej zadawane pytania dotyczące naszych usług i produkcji
          </p>

          {/* Search */}
          <div className="mt-8 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj w pytaniach..."
                className="pl-12 h-12 bg-card border-border"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  !selectedCategory
                    ? 'bg-primary text-white'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                Wszystkie
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize ${
                    selectedCategory === category
                      ? 'bg-primary text-white'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}

          {/* FAQ Accordion */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <HelpCircle className="mx-auto mb-4 h-14 w-14 text-destructive" />
              <p className="font-medium text-foreground">Nie udało się pobrać odpowiedzi</p>
              <p className="mt-2 text-sm text-muted-foreground">Odśwież stronę i spróbuj ponownie.</p>
            </div>
          ) : filteredFAQs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Nie znaleziono pytań pasujących do wyszukiwanych fraz
              </p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {filteredFAQs.map((faq, index) => (
                <AccordionItem
                  key={faq.id}
                  value={faq.id}
                  className="bg-card border border-border rounded-xl overflow-hidden data-[state=open]:border-primary/50"
                >
                  <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
                    <span className="text-left font-medium text-foreground">
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {/* Still have questions */}
          <Card className="mt-12 bg-card border-border">
            <CardContent className="p-8 text-center">
              <MessageCircle className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">
                Nie znalazłeś odpowiedzi?
              </h2>
              <p className="text-muted-foreground mb-6">
                Skontaktuj się z nami, chętnie odpowiemy na Twoje pytania
              </p>
              <Link href="/kontakt">
                <Button className="bg-gradient-primary hover:shadow-glow transition-shadow">
                  Skontaktuj się
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
