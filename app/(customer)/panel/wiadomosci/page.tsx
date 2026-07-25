import { CustomerMessages } from '@/components/customer/customer-messages';

export const metadata = {
  title: 'Wiadomości | Panel klienta KORIX3D',
  description: 'Pytania klienta oraz odpowiedzi zespołu KORIX3D.',
};

export default function MessagesPage() {
  return <CustomerMessages />;
}
