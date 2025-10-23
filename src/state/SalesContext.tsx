import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Sale } from '../models/Sale';
import { KEYS, getJSON, setJSON } from '../storage';
import { uuid } from '../utils/uuid';
import { useProducts } from './ProductsContext';

type SalesCtx = {
  sales: Sale[];
  add: (sale: Omit<Sale, 'id' | 'createdAt'>) => void;
  remove: (id: string) => void;
  update: (id: string, changes: Partial<Omit<Sale, 'id' | 'createdAt'>>) => void;
};

const Ctx = createContext<SalesCtx | null>(null);

export function SalesProvider({ children }: { children: React.ReactNode }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const { products, update: updateProduct } = useProducts();

  useEffect(() => {
    (async () => {
      const data = await getJSON<Sale[]>(KEYS.SALES, []);
      setSales(data);
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
      setSales((prev) => [
        ...prev,
        { id: uuid(), createdAt: Date.now(), ...sale },
      ]);
    },
    remove(id) {
      setSales((prev) => prev.filter((s) => s.id !== id));
    },
    update(id, changes) {
      setSales((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
    },
  }), [products, sales, updateProduct]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSales() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSales debe usarse dentro de SalesProvider');
  return ctx;
}
