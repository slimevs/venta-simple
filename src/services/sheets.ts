import { SHEETS_SALES_URL, SHEETS_PRODUCTS_URL } from '../config';
import type { Sale } from '../models/Sale';
import type { Product } from '../models/Product';

type SendSalePayload = {
  date: string;
  department: string;
  paymentStatus: string;
  total: number;
  items: Array<{
    productId: string;
    name: string;
    unit: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
};

export async function sendSaleToSheets(sale: Sale, products: Product[]): Promise<void> {
  if (!SHEETS_SALES_URL) return; // no configurado, no envía
  const payload: SendSalePayload = {
    date: new Date(sale.createdAt).toISOString(),
    department: sale.department || '',
    paymentStatus: sale.paymentStatus,
    total: sale.total,
    items: sale.items.map((it) => {
      const p = products.find((x) => x.id === it.productId);
      return {
        productId: it.productId,
        name: p?.name ?? 'Desconocido',
        unit: p?.unit ?? '',
        quantity: it.quantity,
        price: it.price,
        subtotal: it.subtotal,
      };
    }),
  };

  try {
    await fetch(SHEETS_SALES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Silencioso: no bloquea el alta de la venta. Podríamos encolar para retry.
    console.warn('[sheets] Falló envío a Google Sheets:', err);
  }
}

type ProductChange = {
  action: 'create' | 'update' | 'delete';
  product: Product;
};

export async function sendProductChangeToSheets(change: ProductChange): Promise<void> {
  if (!SHEETS_PRODUCTS_URL) return;
  const payload = {
    date: new Date().toISOString(),
    action: change.action,
    id: change.product.id,
    name: change.product.name,
    unit: change.product.unit,
    price: change.product.price,
    stock: change.product.stock,
    createdAt: change.product.createdAt,
    updatedAt: change.product.updatedAt ?? null,
  };
  try {
    await fetch(SHEETS_PRODUCTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[sheets] Falló envío de producto a Google Sheets:', err);
  }
}
