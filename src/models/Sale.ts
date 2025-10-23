export interface SaleItem {
  productId: string;
  quantity: number;
  price: number; // precio unitario al momento de venta
  subtotal: number; // quantity * price
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  department: number; // departamento numérico
  paymentStatus: 'pagado' | 'pendiente' | 'parcial';
  createdAt: number;
}
