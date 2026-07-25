'use client';

import { MouseEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Heart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useWishlist } from '@/lib/wishlist-provider';

type WishlistButtonProps = {
  productId: string;
  productName: string;
  compact?: boolean;
  className?: string;
};

export function WishlistButton({
  productId,
  productName,
  compact = false,
  className,
}: WishlistButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isSaved, isPending, toggle } = useWishlist();
  const saved = isSaved(productId);
  const pending = isPending(productId);

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const result = await toggle(productId);
    if (result === 'login_required') {
      toast.info('Zaloguj się, aby zapisać produkt');
      router.push(`/logowanie?redirect=${encodeURIComponent(pathname)}`);
    } else if (result === 'added') {
      toast.success('Dodano do listy życzeń', { description: productName });
    } else if (result === 'removed') {
      toast.success('Usunięto z listy życzeń', { description: productName });
    } else {
      toast.error('Nie udało się zmienić listy życzeń');
    }
  };

  return (
    <Button
      type="button"
      variant={saved ? 'default' : 'outline'}
      size={compact ? 'icon' : 'default'}
      className={className}
      onClick={handleClick}
      disabled={pending}
      aria-label={saved ? `Usuń ${productName} z listy życzeń` : `Dodaj ${productName} do listy życzeń`}
      aria-pressed={saved}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''} ${compact ? '' : 'mr-2'}`} />
      )}
      {!compact && (saved ? 'Zapisano' : 'Lista życzeń')}
    </Button>
  );
}
