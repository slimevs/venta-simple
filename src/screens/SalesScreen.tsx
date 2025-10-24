import React, { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View, ScrollView, Platform, Modal } from 'react-native';
import { useProducts } from '../state/ProductsContext';
import { useSales } from '../state/SalesContext';
import { Button, Field, Title, styles } from '../components/Common';
import { SaleItem } from '../models/Sale';
import { useNavigation } from '@react-navigation/native';
import { formatCLP } from '../utils/currency';
import { FloatingScrollTop } from '../components/FloatingScrollTop';
import { useToast } from '../components/Toast';

export function SalesScreen() {
  const { products } = useProducts();
  const { sales, add, update, remove } = useSales();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const [showTop, setShowTop] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [dropdown, setDropdown] = useState(false);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [department, setDepartment] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pagado' | 'pendiente'>('pagado');
  const [qtyError, setQtyError] = useState<string | null>(null);
  const [detailSale, setDetailSale] = useState<import('../models/Sale').Sale | null>(null);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [productError, setProductError] = useState<boolean>(false);

  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedId), [products, selectedId]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return !q ? products : products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, filter]);

  const total = useMemo(() => items.reduce((acc, it) => acc + it.subtotal, 0), [items]);
  const pendingSales = useMemo(() => sales.filter((s) => s.paymentStatus !== 'pagado'), [sales]);

  function addItem() {
    setError(null);
    if (!selectedProduct) {
      Alert.alert('Faltan datos', 'Selecciona un producto para agregar.');
      setProductError(true);
      return;
    }
    const q = selectedProduct.unit === 'kg' ? parseFloat(quantity || '0') : parseInt(quantity || '0', 10);
    if (!q || q <= 0) {
      Alert.alert('Cantidad inválida', selectedProduct.unit === 'kg' ? 'Ingresa una cantidad en kilos mayor a 0 (se permiten decimales).' : 'Ingresa una cantidad en unidades mayor a 0.');
      setQtyError(selectedProduct.unit === 'kg' ? 'Ingresa una cantidad en kilos > 0' : 'Ingresa una cantidad en unidades > 0');
      return;
    }
    if (q > selectedProduct.stock) {
      setError(`Stock insuficiente (disp: ${selectedProduct.stock})`);
      Alert.alert('Stock insuficiente', `Disponible: ${selectedProduct.stock}`);
      setQtyError('Cantidad supera el stock disponible');
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
    setQtyError(null);
    setProductError(false);
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function saveSale() {
    setError(null);
    try {
      if (items.length === 0) {
        Alert.alert('Venta incompleta', 'Agrega al menos un producto antes de guardar.');
        return;
      }
      const dep = parseInt((department || '').trim(), 10) || 0;
      if (!dep) {
        Alert.alert('Departamento requerido', 'Ingresa un departamento numérico.');
        setDeptError('Ingresa un departamento numérico');
        return;
      }
      add({ items, total, department: dep, paymentStatus, paymentType });
      setItems([]);
      setSelectedId(null);
      setQuantity('');
      setDepartment('');
      setDeptError(null);
      setQtyError(null);
      setProductError(false);
      setPaymentStatus('pagado');
      setPaymentType('efectivo');
      toast.show('Venta guardada', { type: 'success' });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => setShowTop(e.nativeEvent.contentOffset.y > 200)}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
      <Title>Registrar Venta</Title>

      <View style={[styles.card, { marginBottom: 12 }] }>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Agregar producto a la venta</Text>
        <Text style={[styles.label, productError ? { color: '#b91c1c' } : null]}>Producto</Text>
        <Pressable onPress={() => { setDropdown((v) => !v); setProductError(false); }} style={[styles.input, { justifyContent: 'center' }, productError ? { borderColor: '#ef4444' } : null] }>
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
              nestedScrollEnabled
              ListEmptyComponent={<Text style={{ padding: 8, color: '#6b7280' }}>Sin productos</Text>}
            />
          </View>
        )}
        <Field label="Cantidad" value={quantity} onChangeText={(t) => { setQuantity(t); if (qtyError) setQtyError(null); }} placeholder="Ej. 2" keyboardType="numeric" error={qtyError} />
        <Field
          label="Departamento (numérico)"
          value={department}
          onChangeText={(t) => { const v = t.replace(/[^0-9]/g, ''); setDepartment(v); if (deptError && /^[0-9]+$/.test(v)) setDeptError(null); }}
          placeholder="Ej. 10"
          keyboardType="numeric"
          error={deptError}
        />
        <Text style={[styles.label, { marginTop: 6 }]}>Tipo de pago</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {[
            { key: 'efectivo', label: 'Efectivo' },
            { key: 'transferencia', label: 'Transferencia' },
          ].map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setPaymentType(opt.key as any)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: paymentType === opt.key ? '#1d4ed8' : '#d1d5db',
                backgroundColor: paymentType === opt.key ? '#dbeafe' : 'white',
              }}
            >
              <Text style={{ color: '#111827' }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.label, { marginTop: 6 }]}>Estado de pago</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {[
            { key: 'pagado', label: 'Pagado' },
            { key: 'pendiente', label: 'Pendiente' },
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
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.small}>Aún no hay productos en la venta</Text>}
        />

        <View style={[styles.row, { marginTop: 8 }]}>
          <Text style={{ fontWeight: '700' }}>Total</Text>
          <Text style={{ fontWeight: '700' }}>{formatCLP(total)}</Text>
        </View>
      </View>

      <Button title="Guardar venta" onPress={saveSale} disabled={items.length === 0} />

      <View style={[styles.card, { marginTop: 16 }] }>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Ventas por cobrar</Text>
        <FlatList
          data={pendingSales}
          keyExtractor={(s) => s.id}
          renderItem={({ item: s }) => (
            <View style={{ marginBottom: 10 }}>
              <View style={styles.row}>
                <Text style={{ fontWeight: '600' }}>{new Date(s.createdAt).toLocaleString()}</Text>
                <Text style={styles.small}>Total: {formatCLP(s.total)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.small}>Depto: {typeof s.department === 'number' ? s.department : '-'}</Text>
                <Text style={[styles.small, { textTransform: 'capitalize' }]}>Estado: {s.paymentStatus}</Text>
              </View>
              <View style={styles.row}>
                <Text style={[styles.small, { textTransform: 'capitalize' }]}>Pago: {s.paymentType}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { key: 'efectivo', label: 'Efectivo' },
                    { key: 'transferencia', label: 'Transferencia' },
                  ].map((opt) => (
                    <Pressable
                      key={opt.key}
                      onPress={() => update(s.id, { paymentType: opt.key as any })}
                      style={{
                        paddingVertical: 4,
                        paddingHorizontal: 8,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: s.paymentType === (opt.key as any) ? '#1d4ed8' : '#d1d5db',
                        backgroundColor: s.paymentType === (opt.key as any) ? '#dbeafe' : 'white',
                      }}
                    >
                      <Text style={{ color: '#111827' }}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button title="Pagado" onPress={() => { update(s.id, { paymentStatus: 'pagado' }); toast.show('Venta marcada como pagada', { type: 'success' }); }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Ver detalle" variant="secondary" onPress={() => setDetailSale(s)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Eliminar"
                    variant="danger"
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        const ok = typeof window !== 'undefined' && typeof (window as any).confirm === 'function'
                          ? (window as any).confirm('¿Deseas eliminar esta venta pendiente?')
                          : true;
                        if (ok) {
                          remove(s.id);
                          toast.show('Venta eliminada', { type: 'success' });
                        }
                      } else {
                        Alert.alert('Eliminar venta pendiente', '¿Deseas eliminar esta venta pendiente?', [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Eliminar', style: 'destructive', onPress: () => { remove(s.id); toast.show('Venta eliminada', { type: 'success' }); } },
                        ]);
                      }
                    }}
                  />
                </View>
                {/* Parcial eliminado */}
              </View>
            </View>
          )}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.small}>Sin ventas pendientes</Text>}
        />
      </View>
      </ScrollView>
      {/* Modal Detalle Venta */}
      <Modal
        visible={!!detailSale}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailSale(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, width: '100%', maxWidth: 520 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>Detalle de venta</Text>
            {detailSale && (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.small}>{new Date(detailSale.createdAt).toLocaleString()}</Text>
                  <Text style={styles.small}>Total: {formatCLP(detailSale.total)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.small}>Depto: {typeof detailSale.department === 'number' ? detailSale.department : '-'}</Text>
                  <Text style={[styles.small, { textTransform: 'capitalize' }]}>Pago: {detailSale.paymentType}</Text>
                </View>
                <View style={{ maxHeight: 260 }}>
                  <FlatList
                    data={detailSale.items}
                    keyExtractor={(i) => i.productId}
                    renderItem={({ item }) => {
                      const p = products.find((x) => x.id === item.productId);
                      return (
                        <View style={[styles.row, { marginBottom: 6 }]}>
                          <Text>{p?.name ?? item.productId} x {item.quantity}{p?.unit === 'kg' ? ' kg' : ''}</Text>
                          <Text>{formatCLP(item.subtotal)}</Text>
                        </View>
                      );
                    }}
                  />
                </View>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Button title="Cerrar" variant="secondary" onPress={() => setDetailSale(null)} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <FloatingScrollTop visible={showTop} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
    </View>
  );
}
