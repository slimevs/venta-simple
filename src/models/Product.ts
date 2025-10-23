export interface Product {
  id: string;
  name: string;
  price: number; // precio unitario
  stock: number; // puede ser decimal si es por kg
  unit: 'unit' | 'kg'; // 'unit' = por pieza, 'kg' = por kilogramo
  createdAt: number;
  updatedAt?: number;
}
