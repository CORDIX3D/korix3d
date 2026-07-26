import { GenericAdminCrud } from '@/components/admin/generic-admin-crud';
import { STORE_ORDER_ALLOWED_TRANSITIONS } from '@/lib/store-order-status';

export const metadata = {
  title: 'Zamówienia sklepu | Panel administratora KORIX3D',
  description: 'Obsługa zamówień produktów ze sklepu KORIX3D.',
};

export default function Page() {
  return (
    <GenericAdminCrud
      config={{
        title: 'Zamówienia sklepu',
        description: 'Obsługa zamówień produktów ze sklepu z rozbiciem wartości produktów, dostawy i VAT.',
        table: 'store_orders',
        orderBy: 'created_at',
        addLabel: 'Dodaj zamówienie',
        allowCreate: false,
        allowDelete: false,
        searchKeys: ['order_number', 'customer_email', 'customer_name', 'status'],
        fields: [
          { key: 'customer_email', label: 'Email klienta', type: 'email', required: true, readOnlyOnEdit: true },
          { key: 'customer_name', label: 'Imię i nazwisko', readOnlyOnEdit: true },
          {
            key: 'status',
            label: 'Status',
            defaultValue: 'pending',
            options: [
              { label: 'Nowe', value: 'pending' },
              { label: 'Opłacone', value: 'paid' },
              { label: 'W realizacji', value: 'processing' },
              { label: 'Wysłane', value: 'shipped' },
              { label: 'Dostarczone', value: 'delivered' },
              { label: 'Anulowane', value: 'cancelled' },
              { label: 'Zwrócone', value: 'refunded' },
            ],
            allowedTransitions: STORE_ORDER_ALLOWED_TRANSITIONS,
          },
          { key: 'subtotal', label: 'Produkty', type: 'number', required: true, defaultValue: 0, readOnlyOnEdit: true },
          { key: 'shipping_cost', label: 'Dostawa', type: 'number', defaultValue: 0, readOnlyOnEdit: true },
          { key: 'vat_amount', label: 'VAT', type: 'number', defaultValue: 0, readOnlyOnEdit: true },
          { key: 'total', label: 'Razem', type: 'number', required: true, defaultValue: 0, readOnlyOnEdit: true },
          { key: 'tracking_number', label: 'Numer śledzenia' },
          { key: 'notes', label: 'Notatki', type: 'textarea' },
        ],
        defaultInsert: { shipping_address: {}, billing_address: {}, discount_amount: 0 },
        columns: [
          { key: 'order_number', label: 'Numer' },
          { key: 'customer_email', label: 'Email' },
          { key: 'customer_name', label: 'Klient' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'subtotal', label: 'Produkty', type: 'money' },
          { key: 'shipping_cost', label: 'Dostawa', type: 'money' },
          { key: 'vat_amount', label: 'VAT', type: 'money' },
          { key: 'total', label: 'Razem', type: 'money' },
          { key: 'created_at', label: 'Data', type: 'date' },
        ],
      }}
    />
  );
}
