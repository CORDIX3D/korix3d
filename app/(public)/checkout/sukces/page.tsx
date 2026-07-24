import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function CheckoutSuccessPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-xl text-center">
        <CardContent className="p-8">
          <CheckCircle2 className="mx-auto mb-5 h-16 w-16 text-green-500" />
          <h1 className="mb-3 text-3xl font-bold">Płatność została przyjęta</h1>
          <p className="mb-7 text-muted-foreground">Potwierdzenie zamówienia wyślemy na podany adres e-mail.</p>
          <Button asChild><Link href="/panel/zamowienia">Przejdź do zamówień</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
