import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Product } from '../models/Product';
import { KEYS, getJSON, setJSON } from '../storage';
import { uuid } from '../utils/uuid';

type ProductsCtx = {
  products: Product[];
  add: (p: Omit<Product, 'id' | 'createdAt'>) => void;
  update: (id: string, changes: Partial<Omit<Product, 'id' | 'createdAt'>>) => void;
  remove: (id: string) => void;
  getById: (id: string) => Product | undefined;
  setAll: (items: Product[]) => void;
};

const Ctx = createContext<ProductsCtx | null>(null);

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    (async () => {
      const data = await getJSON<any[]>(KEYS.PRODUCTS, []);
      // Migración: asegurar campo unit con valor por defecto 'unit'
      const migrated: Product[] = (data || []).map((it: any) => ({
        id: it.id,
        name: it.name,
        price: Number(it.price ?? 0),
        stock: Number(it.stock ?? 0),
        unit: (it.unit === 'kg' || it.unit === 'unit') ? it.unit : 'unit',
        createdAt: Number(it.createdAt ?? Date.now()),
        updatedAt: it.updatedAt ? Number(it.updatedAt) : undefined,
      }));
      setProducts(migrated);
    })();
  }, []);

  useEffect(() => {
    setJSON(KEYS.PRODUCTS, products);
  }, [products]);

  const api = useMemo<ProductsCtx>(() => ({
    products,
    add(p) {
      setProducts((prev) => [
        ...prev,
        { id: uuid(), name: p.name.trim(), price: p.price, stock: p.stock, unit: p.unit, createdAt: Date.now() },
      ]);
    },
    update(id, changes) {
      setProducts((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes, updatedAt: Date.now() } : it)));
    },
    remove(id) {
      setProducts((prev) => prev.filter((it) => it.id !== id));
    },
    getById(id) {
      return products.find((p) => p.id === id);
    },
    setAll(items) {
      setProducts(items);
    },
  }), [products]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useProducts() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProducts debe usarse dentro de ProductsProvider');
  return ctx;
}
