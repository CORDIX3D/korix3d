import { GenericAdminCrud } from '@/components/admin/generic-admin-crud';

export default function Page() {
  return (
    <GenericAdminCrud
      config={{
        title: 'Dostawa',
        description: 'Metody dostawy i ich ceny widoczne w formularzu wyceny oraz zamówieniach.',
        table: 'settings',
        orderBy: 'created_at',
        addLabel: 'Dodaj metodę dostawy',
        searchKeys: ['key', 'label', 'value'],
        filters: [{ field: 'category', operator: 'eq', value: 'shipping' }],
        fields: [
          { key: 'key', label: 'Klucz', required: true, placeholder: 'np. courier_price, paczkomat_price, pickup_price' },
          { key: 'label', label: 'Nazwa dla klienta', required: true, placeholder: 'np. Kurier InPost' },
          { key: 'value', label: 'Cena', type: 'number', required: true, placeholder: 'np. 18.99' },
        ],
        defaultInsert: { category: 'shipping' },
        columns: [
          { key: 'label', label: 'Nazwa' },
          { key: 'key', label: 'Klucz' },
          { key: 'value', label: 'Cena', type: 'money' },
          { key: 'category', label: 'Kategoria' },
          { key: 'updated_at', label: 'Aktualizacja', type: 'date' },
        ],
      }}
    />
  );
}
