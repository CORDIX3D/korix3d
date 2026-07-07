'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight,
  Box,
  Layers,
  Shield,
  Zap,
  Award,
  Users,
  CheckCircle2,
  ChevronRight,
  Printer,
  Cog,
  FileBox,
  Timer,
  Star,
  MessageSquareQuote,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

// Services data
const services = [
  {
    icon: Box,
    title: 'Druk 3D na zamówienie',
    description: 'Profesjonalny wydruk modeli 3D z szerokiej gamy materiałów. Od prototypów po gotowe produkty.',
    href: '/wycena',
  },
  {
    icon: FileBox,
    title: 'Rapid Prototyping',
    description: 'Szybkie tworzenie prototypów do testowania i walidacji projektu przed wdrożeniem.',
    href: '/wycena?usluga=prototypowanie',
  },
  {
    icon: Cog,
    title: 'Części inżynieryjne',
    description: 'Produkcja funkcjonalnych części z materiałów technicznych: PETG, ABS, ASA, PA-CF.',
    href: '/wycena?usluga=czesci-inzynieryjne',
  },
  {
    icon: Layers,
    title: 'Małoseryjna produkcja',
    description: 'Ekonomiczne rozwiązanie dla małych serii produktowych bez kosztów formowania.',
    href: '/wycena?usluga=produkcja-seryjna',
  },
];

// Materials data
const featuredMaterials = [
  { name: 'PLA', description: 'Eko-materiał do prototypów', color: '#22c55e' },
  { name: 'PETG', description: 'Wytrzymały i uniwersalny', color: '#3b82f6' },
  { name: 'ABS', description: 'Dla części technicznych', color: '#ef4444' },
  { name: 'TPU', description: 'Elastyczny i wytrzymały', color: '#a855f7' },
  { name: 'PA-CF', description: 'Włókno węglowe', color: '#1f2937' },
  { name: 'ASA', description: 'Odporny na UV', color: '#f59e0b' },
];

// Benefits data
const benefits = [
  { icon: Timer, title: 'Szybka realizacja', description: 'Standardowo 3-5 dni roboczych' },
  { icon: Award, title: 'Wysoka jakość', description: 'Precyzyjne wydruki do 50μm' },
  { icon: Shield, title: 'Gwarancja satysfakcji', description: '30 dni na zwrot' },
  { icon: Users, title: 'Wsparcie techniczne', description: 'Doradztwo w doborze materiałów' },
];

// Stats data
const stats = [
  { number: '10,000+', label: 'Wydrukowanych modeli' },
  { number: '500+', label: 'Zadowolonych klientów' },
  { number: '14', label: 'Dostępnych materiałów' },
  { number: '99%', label: 'Pozytywnych opinii' },
];

// How it works steps
const steps = [
  {
    step: '01',
    title: 'Prześlij plik 3D',
    description: 'Wgraj swój model w formacie STL, STEP, OBJ lub 3MF',
  },
  {
    step: '02',
    title: 'Skonfiguruj parametry',
    description: 'Wybierz materiał, kolor, jakość i ilość',
  },
  {
    step: '03',
    title: 'Otrzymaj wycenę',
    description: 'Automatyczna lub ręczna wycena w 24h',
  },
  {
    step: '04',
    title: 'Otrzymaj wydruk',
    description: 'Realizacja i dostawa pod wskazany adres',
  },
];

export default function HomePage() {
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: portfolioData } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('active', true)
        .eq('featured', true)
        .order('sort_order')
        .limit(6);

      if (portfolioData) setPortfolio(portfolioData);

      // Static testimonials for now
      setTestimonials([
        {
          name: 'Jan Kowalski',
          company: 'TechParts Sp. z o.o.',
          content: 'Profesjonalna współpraca od początku do końca. Jakość wydruków perfekcyjna, terminowość wzorowa. Polecam każdemu, kto szuka niezawodnego partnera do druku 3D.',
          rating: 5,
        },
        {
          name: 'Anna Nowak',
          company: 'Design Studio',
          content: 'KORIX3D pomógł mi zrealizować skomplikowane prototypy w rekordowym czasie. Ich doradztwo w doborze materiałów było bezcenne.',
          rating: 5,
        },
        {
          name: 'Piotr Wiśniewski',
          company: 'Automotive Solutions',
          content: 'Wykonują dla nas części zamienne od ponad roku. Jakość powtarzalna, ceny konkurencyjne. Najlepszy wybór dla małoseryjnej produkcji.',
          rating: 5,
        },
      ]);
    };

    fetchData();
  }, [supabase]);

  return (
    <div className="relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-3d-grid opacity-50"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent"></div>

      {/* Particles */}
      <div className="particles">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 15}s`,
              animationDuration: `${15 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center pt-20 pb-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border mb-8 animate-fade-down">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Profesjonalny druk 3D • Szybkie prototypowanie
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            <span className="text-foreground">Od pomysłu do</span>
            <br />
            <span className="text-gradient">rzeczywistości.</span>
          </h1>

          {/* Subheadline */}
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground mb-8 animate-fade-up">
            Profesjonalne usługi druku 3D, szybkie prototypowanie i produkcja części inżynieryjnych.
            Wysoka jakość, terminowa realizacja, atrakcyjne ceny.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up">
            <Link href="/wycena">
              <Button size="lg" className="bg-gradient-primary hover:shadow-glow-lg transition-all duration-300 text-lg px-8 h-14">
                Wyceń wydruk
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/sklep">
              <Button size="lg" variant="outline" className="border-border hover:border-primary hover:text-primary transition-colors text-lg px-8 h-14">
                Przeglądaj sklep
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto animate-fade-up">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-gradient mb-1">{stat.number}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Hero Visual */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10"></div>
            <div className="relative w-full aspect-[21/9] rounded-2xl overflow-hidden border border-border bg-card">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Animated 3D Printer */}
                  <div className="w-64 h-64 sm:w-80 sm:h-80 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-orange-600/20 rounded-full blur-3xl animate-pulse-slow"></div>
                    <div className="absolute inset-4 bg-card rounded-full border-2 border-primary/30 flex items-center justify-center">
                      <Box className="w-32 h-32 sm:w-40 sm:h-40 text-primary animate-float" strokeWidth={1} />
                    </div>
                  </div>
                  {/* Floating Elements */}
                  <div className="absolute -top-8 -left-8 w-16 h-16 bg-card rounded-lg border border-border flex items-center justify-center animate-float" style={{ animationDelay: '0.5s' }}>
                    <Layers className="w-8 h-8 text-primary/60" />
                  </div>
                  <div className="absolute -bottom-8 -right-8 w-16 h-16 bg-card rounded-lg border border-border flex items-center justify-center animate-float" style={{ animationDelay: '1s' }}>
                    <Printer className="w-8 h-8 text-primary/60" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Nasze usługi
            </h2>
            <p className="max-w-2xl mx-auto text-muted-foreground">
              Kompleksowa obsługa w zakresie druku 3D - od prototypowania po produkcję seryjną
            </p>
          </div>

          {/* Service Cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <Link
                key={service.title}
                href={service.href}
                className="group relative bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all duration-300 premium-card"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <service.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {service.description}
                  </p>
                  <span className="inline-flex items-center text-sm text-primary font-medium">
                    Dowiedz się więcej
                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="o-nas" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-card/50">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Jak to działa?
            </h2>
            <p className="max-w-2xl mx-auto text-muted-foreground">
              Cztery proste kroki dzielą Cię od gotowego wydruku 3D
            </p>
          </div>

          {/* Steps */}
          <div className="grid gap-8 md:grid-cols-4">
            {steps.map((item, index) => (
              <div key={item.step} className="relative">
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] right-0 h-[2px] bg-gradient-to-r from-primary to-primary/20"></div>
                )}
                <div className="relative bg-background border border-border rounded-2xl p-6">
                  <div className="text-4xl font-bold text-gradient mb-4">{item.step}</div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <Link href="/wycena">
              <Button size="lg" className="bg-gradient-primary hover:shadow-glow transition-shadow">
                Rozpocznij teraz
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Materials Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Szeroki wybór materiałów
            </h2>
            <p className="max-w-2xl mx-auto text-muted-foreground">
              Drukujemy w 14+ materiałach - od uniwersalnego PLA po inżynieryjne PA-CF i PC
            </p>
          </div>

          {/* Material Cards */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-8">
            {featuredMaterials.map((material) => (
              <Link
                key={material.name}
                href={`/materialy/${material.name.toLowerCase()}`}
                className="group bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all text-center"
              >
                <div
                  className="w-12 h-12 mx-auto rounded-full mb-3 border-2 border-border"
                  style={{ backgroundColor: material.color }}
                />
                <h3 className="font-semibold text-foreground mb-1">{material.name}</h3>
                <p className="text-xs text-muted-foreground">{material.description}</p>
              </Link>
            ))}
          </div>

          {/* View All Button */}
          <div className="text-center">
            <Link href="/materialy">
              <Button variant="outline" className="border-border hover:border-primary">
                Zobacz wszystkie materiały
                <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-card/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            {/* Content */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
                Dlaczego KORIX3D?
              </h2>
              <p className="text-muted-foreground mb-8">
                Łączymy doświadczenie, nowoczesne technologie i dbałość o jakość.
                Każdy projekt traktujemy indywidualnie.
              </p>

              {/* Benefits List */}
              <div className="space-y-4">
                {benefits.map((benefit) => (
                  <div key={benefit.title} className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual */}
            <div className="relative">
              <div className="bg-card border border-border rounded-2xl p-8">
                <div className="aspect-square relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-orange-600/10 rounded-xl"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Award className="w-48 h-48 text-primary/20" />
                  </div>
                  <div className="absolute top-4 right-4 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Certyfikat ISO
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Nasze realizacje
            </h2>
            <p className="max-w-2xl mx-auto text-muted-foreground">
              Zobacz przykłady naszych projektów z różnych branż
            </p>
          </div>

          {/* Portfolio Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {portfolio.length > 0 ? portfolio.map((item) => (
              <Link
                key={item.id}
                href={`/portfolio/${item.id}`}
                className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-all"
              >
                {item.image_url && (
                  <div className="aspect-[4/3] relative bg-secondary">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            )) : (
              // Placeholder items
              [...Array(6)].map((_, index) => (
                <div
                  key={index}
                  className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-primary/5 to-orange-600/5 flex items-center justify-center">
                    <Box className="w-16 h-16 text-primary/30" />
                  </div>
                  <div className="p-4">
                    <div className="h-4 bg-secondary rounded mb-2"></div>
                    <div className="h-3 bg-secondary/50 rounded w-2/3"></div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* View All Button */}
          <div className="text-center mt-8">
            <Link href="/portfolio">
              <Button variant="outline" className="border-border hover:border-primary">
                Zobacz portfolio
                <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-card/50">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Opinie klientów
            </h2>
            <p className="max-w-2xl mx-auto text-muted-foreground">
              Co mówią o nas nasi klienci
            </p>
          </div>

          {/* Testimonials */}
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((item, index) => (
              <Card key={index} className="bg-background border-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <MessageSquareQuote className="w-8 h-8 text-primary/30 mb-4" />
                  <p className="text-foreground mb-6">{item.content}</p>
                  <div>
                    <div className="font-semibold text-foreground">{item.name}</div>
                    <div className="text-sm text-muted-foreground">{item.company}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 rounded-3xl overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

            <div className="relative p-8 sm:p-12 lg:p-16 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Gotowy aby zacząć?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                Prześlij swój projekt i otrzymaj bezpłatną wycenę.
                Nasi specjaliści doradzą najlepsze rozwiązanie.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/wycena">
                  <Button size="lg" className="bg-gradient-primary hover:shadow-glow-lg transition-all w-full sm:w-auto">
                    Wyceń wydruk za darmo
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/kontakt">
                  <Button size="lg" variant="outline" className="border-border hover:border-primary w-full sm:w-auto">
                    Skontaktuj się
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
