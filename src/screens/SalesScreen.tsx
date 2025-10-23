import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useProducts } from '../state/ProductsContext';
import { useSales } from '../state/SalesContext';
import { Button, Field, Title, styles } from '../components/Common';
import { SaleItem } from '../models/Sale';
import { useNavigation } from '@react-navigation/native';
import { formatCLP } from '../utils/currency';

export function SalesScreen() {
  const { products } = useProducts();
  const { sales, add, update } = useSales();
  const navigation = useNavigation<any>();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [dropdown, setDropdown] = useState(false);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [department, setDepartment] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pagado' | 'pendiente' | 'parcial'>('pagado');

  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedId), [products, selectedId]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return !q ? products : products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, filter]);

  const total = useMemo(() => items.reduce((acc, it) => acc + it.subtotal, 0), [items]);
  const pendingSales = useMemo(() => sales.filter((s) => s.paymentStatus !== 'pagado'), [sales]);

  function addItem() {
    setError(null);
    if (!selectedProduct) return;
    const q = selectedProduct.unit === 'kg' ? parseFloat(quantity || '0') : parseInt(quantity || '0', 10);
    if (!q || q <= 0) return;
    if (q > selectedProduct.stock) {
      setError(`Stock insuficiente (disp: ${selectedProduct.stock})`);
      return;
    }
    const existingIdx = items.findIndex((i) => i.productId === selectedProduct.id);
    const newItem: SaleItem = {
      productId: selectedProduct.id,
      quantity: existingIdx >= 0 ? items[existingIdx].quantity + q : q,
      price: selectedProduct.price,
      subtotal: (existingIdx >= 0 ? items[existingIdx].quantity + q : q) * selectedProduct.price,
    };
    if (existingIdx >= 0) {
      const copy = [...items];
      copy[existingIdx] = newItem;
      setItems(copy);
    } else {
      setItems((prev) => [...prev, newItem]);
    }
    setQuantity('');
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function saveSale() {
    setError(null);
    try {
      if (items.length === 0) return;
      const dep = parseInt((department || '').trim(), 10) || 0;
      add({ items, total, department: dep, paymentStatus });
      setItems([]);
      setSelectedId(null);
      setQuantity('');
      setDepartment('');
      setPaymentStatus('pagado');
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  return (
    <View style={styles.screen}>
      <Title>Registrar Venta</Title>

      <View style={[styles.card, { marginBottom: 12 }] }>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Agregar producto a la venta</Text>
        <Text style={styles.label}>Producto</Text>
        <Pressable onPress={() => setDropdown((v) => !v)} style={[styles.input, { justifyContent: 'center' }] }>
          <Text>{selectedProduct ? selectedProduct.name : 'Seleccionar...'}</Text>
        </Pressable>
        {dropdown && (
          <View style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, marginTop: 6 }}>
            <TextInput placeholder="Filtrar" value={filter} onChangeText={setFilter} style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }} />
            <FlatList
              style={{ maxHeight: 180 }}
              data={filtered}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <Pressable onPress={() => { setSelectedId(item.id); setDropdown(false); }} style={{ padding: 10 }}>
                  <Text>{item.name} • {formatCLP(item.price)} • Stock: {item.stock}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={{ padding: 8, color: '#6b7280' }}>Sin productos</Text>}
            />
          </View>
        )}
        <Field label="Cantidad" value={quantity} onChangeText={setQuantity} placeholder="Ej. 2" keyboardType="numeric" />
        <Field
          label="Departamento (numérico)"
          value={department}
          onChangeText={(t) => setDepartment(t.replace(/[^0-9]/g, ''))}
          placeholder="Ej. 10"
          keyboardType="numeric"
        />
        <Text style={[styles.label, { marginTop: 6 }]}>Estado de pago</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {[
            { key: 'pagado', label: 'Pagado' },
            { key: 'pendiente', label: 'Pendiente' },
            { key: 'parcial', label: 'Parcial' },
          ].map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setPaymentStatus(opt.key as any)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: paymentStatus === opt.key ? '#1d4ed8' : '#d1d5db',
                backgroundColor: paymentStatus === opt.key ? '#dbeafe' : 'white',
              }}
            >
              <Text style={{ color: '#111827' }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
        {error && <Text style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</Text>}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title="Agregar a la venta" onPress={addItem} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Nuevo producto" variant="secondary" onPress={() => navigation.navigate('Productos')} />
          </View>
        </View>
      </View>

      <View style={[styles.card, { marginBottom: 12 }] }>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Detalle</Text>
        <FlatList
          data={items}
          keyExtractor={(i) => i.productId}
          renderItem={({ item }) => {
            const p = products.find((x) => x.id === item.productId);
            return (
              <View style={[styles.row, { marginBottom: 8 }]}>
                <Text>{p?.name} x {item.quantity}{p?.unit === 'kg' ? ' kg' : ''}</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Text>{formatCLP(item.subtotal)}</Text>
                  <Button title="Quitar" variant="danger" onPress={() => removeItem(item.productId)} />
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.small}>Aún no hay productos en la venta</Text>}
        />

        <View style={[styles.row, { marginTop: 8 }]}>
          <Text style={{ fontWeight: '700' }}>Total</Text>
          <Text style={{ fontWeight: '700' }}>{formatCLP(total)}</Text>
        </View>
      </View>

      <Button title="Guardar venta" onPress={saveSale} />

      <View style={[styles.card, { marginTop: 16 }] }>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Ventas por cobrar</Text>
        <FlatList
          data={pendingSales}
          keyExtractor={(s) => s.id}
          renderItem={({ item: s }) => (
            <View style={{ marginBottom: 10 }}>
              <View style={styles.row}>
                <Text style={{ fontWeight: '600' }}>{new Date(s.createdAt).toLocaleString()}</Text>
                <Text style={styles.small}>Total: ${s.total.toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.small}>Depto: {typeof s.department === 'number' ? s.department : '-'}</Text>
                <Text style={[styles.small, { textTransform: 'capitalize' }]}>Estado: {s.paymentStatus}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button title="Marcar Pagado" onPress={() => update(s.id, { paymentStatus: 'pagado' })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Pendiente" variant="secondary" onPress={() => update(s.id, { paymentStatus: 'pendiente' })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Parcial" variant="secondary" onPress={() => update(s.id, { paymentStatus: 'parcial' })} />
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.small}>Sin ventas pendientes o parciales</Text>}
        />
      </View>
    </View>
  );
}
