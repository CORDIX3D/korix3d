import { CustomerWishlist } from '@/components/customer/customer-wishlist';

export const metadata = {
  title: 'Lista życzeń | Panel klienta KORIX3D',
  description: 'Produkty zapisane na później w panelu klienta KORIX3D.',
};

export default function WishlistPage() {
  return <CustomerWishlist />;
}
