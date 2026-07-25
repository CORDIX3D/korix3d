import { CustomerFiles } from '@/components/customer/customer-files';

export const metadata = {
  title: 'Pliki | Panel klienta KORIX3D',
  description: 'Modele przesłane do wyceny i powiązane ze zleceniami klienta KORIX3D.',
};

export default function FilesPage() {
  return <CustomerFiles />;
}
