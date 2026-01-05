import { SHEETS_SALES_URL, SHEETS_PRODUCTS_URL, SHEETS_DUES_URL, SHEETS_PRODUCTS_GET_URL, SHEETS_SALES_GET_URL } from '../config';
import type { Sale } from '../models/Sale';
import type { Product } from '../models/Product';

type SendSalePayload = {
  id: string;
  date: string;
  department: number | string;
  paymentStatus: string;
  paymentType?: string;
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
    id: sale.id,
    date: formatISOWithOffset(new Date(sale.createdAt)),
    department: sale.department || '',
    paymentStatus: sale.paymentStatus,
    paymentType: sale.paymentType,
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
    // Evitar CORS preflight: no establecer headers personalizados y usar body de texto
    // Además, usar mode: 'no-cors' para no bloquear si el endpoint no devuelve CORS
    await fetch(SHEETS_SALES_URL, {
      method: 'POST',
      mode: 'no-cors',
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
    date: formatISOWithOffset(new Date()),
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
      mode: 'no-cors',
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[sheets] Falló envío de producto a Google Sheets:', err);
  }
}

export async function sendDueSaleToSheets(sale: Sale, products: Product[]): Promise<void> {
  const url = SHEETS_DUES_URL || SHEETS_SALES_URL; // si no hay URL específica, usa la de ventas
  if (!url) return;
  const payload = {
    due: true,
    id: sale.id,
    date: formatISOWithOffset(new Date(sale.createdAt)),
    department: sale.department || '',
    paymentStatus: sale.paymentStatus,
    paymentType: sale.paymentType,
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
  } as any;
  try {
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
  } catch (err) {
    console.warn('[sheets] Falló envío de venta por cobrar a Google Sheets:', err);
  }
}

export async function sendDueClearToSheets(saleId: string): Promise<void> {
  const url = SHEETS_DUES_URL || SHEETS_SALES_URL;
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ dueClear: true, id: saleId }) });
  } catch (err) {
    console.warn('[sheets] Falló limpiar PorCobrar en Google Sheets:', err);
  }
}

function formatISOWithOffset(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const offH = pad(Math.floor(Math.abs(off) / 60));
  const offM = pad(Math.abs(off) % 60);
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${sign}${offH}:${offM}`;
}

// Lectura opcional desde Sheets
type ProductChangeRecord = {
  date?: string;
  action: 'create' | 'update' | 'delete';
  id: string;
  name: string;
  unit: 'unit' | 'kg';
  price: number;
  stock: number;
  createdAt?: number | null;
  updatedAt?: number | null;
};

export async function fetchProductChangesFromSheets(): Promise<ProductChangeRecord[] | null> {
  if (!SHEETS_PRODUCTS_GET_URL) return null;
  try {
    const json = await fetchJSONWithCORS(SHEETS_PRODUCTS_GET_URL);
    if (!json) return null;
    const arr = Array.isArray(json) ? json : (json as any).items;
    if (!Array.isArray(arr)) return null;
    return arr as ProductChangeRecord[];
  } catch (e) {
    console.warn('[sheets] No se pudo leer cambios de productos:', e);
    return null;
  }
}

export function reduceProductChanges(changes: ProductChangeRecord[]): import('../models/Product').Product[] {
  const map = new Map<string, ProductChangeRecord>();
  for (const ch of changes) {
    if (!ch?.id) continue;
    if (ch.action === 'delete') {
      map.delete(ch.id);
      continue;
    }
    map.set(ch.id, ch);
  }
  const out = Array.from(map.values()).map((c) => ({
    id: c.id,
    name: c.name,
    unit: c.unit,
    price: Number(c.price || 0),
    stock: Number(c.stock || 0),
    createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
    updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt! : undefined,
  }));
  return out;
}

// Ventas: lectura preagrupada desde Sheets (el endpoint debe devolver ventas con items)
export type RemoteSaleItem = {
  productId: string;
  quantity: number;
  price: number;
  subtotal: number;
};

export type RemoteSale = {
  id: string;
  date: string | number; // ISO string o timestamp
  department: number | string;
  paymentStatus: 'pagado' | 'pendiente' | string;
  paymentType?: 'efectivo' | 'transferencia' | string;
  total: number;
  items: RemoteSaleItem[];
};

export async function fetchSalesFromSheets(): Promise<import('../models/Sale').Sale[] | null> {
  if (!SHEETS_SALES_GET_URL) return null;
  try {
    const json = await fetchJSONWithCORS(SHEETS_SALES_GET_URL);
    const arr: RemoteSale[] = Array.isArray(json) ? (json as any) : (json as any)?.items;
    if (!Array.isArray(arr)) return null;
    const sales = arr.map((r) => ({
      id: String(r.id),
      createdAt: typeof r.date === 'number' ? r.date : new Date(String(r.date)).getTime(),
      department: typeof r.department === 'number' ? r.department : parseInt(String(r.department || '0'), 10) || 0,
      paymentStatus: ((() => {
        const raw = String(r.paymentStatus || 'pagado').toLowerCase();
        if (raw === 'pendiente') return 'pendiente';
        if (raw === 'parcial') return 'pendiente';
        return 'pagado';
      })() as any),
      paymentType: ((() => {
        const t = String((r as any).paymentType || '').toLowerCase();
        return t === 'transferencia' ? 'transferencia' : 'efectivo';
      })() as any),
      total: Number(r.total || 0),
      items: (r.items || []).map((it) => ({
        productId: String(it.productId || ''),
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
        subtotal: Number(it.subtotal || 0),
      })),
    })) as import('../models/Sale').Sale[];
    return sales;
  } catch (e) {
    console.warn('[sheets] No se pudo leer ventas:', e);
    return null;
  }
}

// Utilidad: intenta CORS normal y si no, usa JSONP (?callback=)
async function fetchJSONWithCORS(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { method: 'GET' });
    if ((res as any).type === 'opaque') throw new Error('opaque');
    if (!(res as any).ok) {
      let bodySnippet = '';
      try {
        bodySnippet = (await (res as any).text()).slice(0, 300);
      } catch {}
      console.warn('[sheets] HTTP error', (res as any).status, (res as any).statusText, 'for', url, '\n', bodySnippet);
      throw new Error('http-' + (res as any).status);
    }
    try {
      return await (res as any).json();
    } catch (e) {
      let bodySnippet = '';
      try {
        bodySnippet = (await (res as any).text()).slice(0, 300);
      } catch {}
      console.warn('[sheets] JSON parse failed for', url, '\n', bodySnippet);
      throw e;
    }
  } catch (_) {
    // Intento JSONP solo en web (requiere DOM)
    if (typeof document !== 'undefined') {
      return await fetchJSONP(url);
    }
    return null;
  }
}

function fetchJSONP(url: string, timeoutMs = 6000): Promise<any | null> {
  return new Promise((resolve) => {
    const cbName = '__jsonp_cb_' + Math.random().toString(36).slice(2);
    const sep = url.includes('?') ? '&' : '?';
    const src = `${url}${sep}callback=${cbName}`;
    (globalThis as any)[cbName] = (data: any) => {
      cleanup();
      resolve(data);
    };
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      delete (globalThis as any)[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    document.head.appendChild(script);
  });
}

// Eliminar venta por cobrar en Google Sheets
export async function sendDueDeleteToSheets(saleId: string): Promise<void> {
  const url = SHEETS_DUES_URL || SHEETS_SALES_URL;
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ dueDelete: true, id: saleId }) });
  } catch (err) {
    console.warn('[sheets] Falló eliminar venta por cobrar en Google Sheets:', err);
  }
}
