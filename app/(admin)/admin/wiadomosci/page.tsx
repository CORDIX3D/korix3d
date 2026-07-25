import { GenericAdminCrud } from '@/components/admin/generic-admin-crud';

export const metadata = {
  title: 'Wiadomości | Panel administratora KORIX3D',
  description: 'Wiadomości przesłane przez formularz kontaktowy KORIX3D.',
};

export default function Page() {
  return (
    <GenericAdminCrud
      config={{
        title: 'Wiadomości',
        description: 'Wiadomości z formularza kontaktowego.',
        table: 'contact_submissions',
        orderBy: 'created_at',
        addLabel: 'Dodaj wiadomość',
        allowCreate: false,
        searchKeys: ['name', 'email', 'subject', 'message'],
        fields: [
          { key: 'name', label: 'Nazwa / osoba', required: true, readOnlyOnEdit: true },
          { key: 'email', label: 'Email', type: 'email', required: true, readOnlyOnEdit: true },
          { key: 'phone', label: 'Telefon', type: 'tel', readOnlyOnEdit: true },
          { key: 'subject', label: 'Temat', readOnlyOnEdit: true },
          { key: 'message', label: 'Treść klienta', type: 'textarea', required: true, readOnlyOnEdit: true },
          { key: 'read', label: 'Przeczytane', type: 'boolean', defaultValue: false },
          { key: 'admin_reply', label: 'Odpowiedź dla klienta', type: 'textarea', placeholder: 'Wpisz odpowiedź widoczną w panelu klienta.' },
        ],
        columns: [
          { key: 'name', label: 'Nadawca' },
          { key: 'email', label: 'Email' },
          { key: 'subject', label: 'Temat' },
          { key: 'read', label: 'Przeczytane', type: 'boolean' },
          { key: 'replied', label: 'Odpowiedziano', type: 'boolean' },
          { key: 'replied_at', label: 'Data odpowiedzi', type: 'date' },
          { key: 'created_at', label: 'Data', type: 'date' },
        ],
      }}
    />
  );
}
