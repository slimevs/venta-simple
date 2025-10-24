import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Sale } from '../models/Sale';
import { KEYS, getJSON, setJSON } from '../storage';
import { uuid } from '../utils/uuid';
import { useProducts } from './ProductsContext';
import { sendSaleToSheets, sendDueSaleToSheets, sendDueClearToSheets, fetchSalesFromSheets, sendDueDeleteToSheets } from '../services/sheets';

type SalesCtx = {
  sales: Sale[];
  add: (sale: Omit<Sale, 'id' | 'createdAt'>) => void;
  remove: (id: string) => void;
  update: (id: string, changes: Partial<Omit<Sale, 'id' | 'createdAt'>>) => void;
  setAll: (items: Sale[]) => void;
};

const Ctx = createContext<SalesCtx | null>(null);

export function SalesProvider({ children }: { children: React.ReactNode }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const { products, update: updateProduct } = useProducts();

  useEffect(() => {
    (async () => {
      const data = await getJSON<any[]>(KEYS.SALES, []);
      // Migración: asegurar department como número
      const migrated: Sale[] = (data || []).map((s: any) => ({
        ...s,
        department: typeof s?.department === 'number' ? s.department : parseInt(String(s?.department ?? '0'), 10) || 0,
        paymentStatus: String(s?.paymentStatus || 'pagado').toLowerCase() === 'parcial'
          ? 'pendiente'
          : (String(s?.paymentStatus || 'pagado').toLowerCase() === 'pendiente' ? 'pendiente' : 'pagado'),
        paymentType: ((): 'efectivo' | 'transferencia' => {
          const t = String((s as any)?.paymentType || '').toLowerCase();
          return t === 'transferencia' ? 'transferencia' : 'efectivo';
        })(),
      }));
      setSales(migrated);
      const remote = await fetchSalesFromSheets();
      if (remote && remote.length) {
        setSales(remote);
      }
    })();
  }, []);

  useEffect(() => {
    setJSON(KEYS.SALES, sales);
  }, [sales]);

  const api = useMemo<SalesCtx>(() => ({
    sales,
    add(sale) {
      // Validar stock y actualizarlo
      for (const item of sale.items) {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) throw new Error('Producto no encontrado');
        if (item.quantity > prod.stock) throw new Error(`Stock insuficiente para ${prod.name}`);
      }
      // Actualizar stock
      for (const item of sale.items) {
        const prod = products.find((p) => p.id === item.productId)!;
        updateProduct(prod.id, { stock: prod.stock - item.quantity });
      }
      const newSale: Sale = { id: uuid(), createdAt: Date.now(), ...sale } as Sale;
      setSales((prev) => [...prev, newSale]);
      // Enviar a Google Sheets (no bloqueante)
      (async () => {
        if (newSale.paymentStatus === 'pagado') {
          await sendSaleToSheets(newSale, products);
        } else {
          await sendDueSaleToSheets(newSale, products);
        }
      })();
    },
    remove(id) {
      setSales((prev) => {
        const toRemove = prev.find((s) => s.id === id);
        if (toRemove) {
          (async () => {
            // Si es pendiente, eliminar de PorCobrar en Sheets
            if (toRemove.paymentStatus !== 'pagado') {
              await sendDueDeleteToSheets(toRemove.id);
            }
          })();
          // Restaurar stock de los productos de la venta
          for (const item of toRemove.items) {
            const prod = products.find((p) => p.id === item.productId);
            if (prod) {
              updateProduct(prod.id, { stock: prod.stock + item.quantity });
            }
          }
        }
        return prev.filter((s) => s.id !== id);
      });
    },
    update(id, changes) {
      setSales((prev) => {
        const next = prev.map((s) => (s.id === id ? { ...s, ...changes } : s));
        const updated = next.find((s) => s.id === id);
        if (updated) {
          (async () => {
            // Sólo registrar en PorCobrar cuando queda pendiente/parcial
            if (updated.paymentStatus !== 'pagado') {
              await sendDueSaleToSheets(updated, products);
            } else {
              // Si pasa a pagado, agregar a Ventas y limpiar de PorCobrar
              await sendSaleToSheets(updated, products);
              await sendDueClearToSheets(updated.id);
            }
          })();
        }
        return next;
      });
    },
    setAll(items) {
      setSales(items);
    },
  }), [products, sales, updateProduct]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSales() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSales debe usarse dentro de SalesProvider');
  return ctx;
}
