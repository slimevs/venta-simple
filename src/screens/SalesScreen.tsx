import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View, ScrollView, Modal } from 'react-native';
import { useProducts } from '../state/ProductsContext';
import { useSales } from '../state/SalesContext';
import { Button, Field, Title, styles } from '../components/Common';
import { SaleItem } from '../models/Sale';
import { useNavigation } from '@react-navigation/native';
import { formatCLP } from '../utils/currency';
import { FloatingScrollTop } from '../components/FloatingScrollTop';
import { useToast } from '../components/Toast';
import { Calendar, DateData } from 'react-native-calendars';

export function SalesScreen() {
  const { products } = useProducts();
  const { sales, add } = useSales();
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
  const [deptError, setDeptError] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [productError, setProductError] = useState<boolean>(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [saleDate, setSaleDate] = useState(() => formatYMDLocal(new Date()));
  const [draftDate, setDraftDate] = useState(() => formatYMDLocal(new Date()));

  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedId), [products, selectedId]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return !q ? products : products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, filter]);

  const total = useMemo(() => items.reduce((acc, it) => acc + it.subtotal, 0), [items]);
  const pendingSales = useMemo(() => sales.filter((s) => s.paymentStatus !== 'pagado'), [sales]);

  const addItem = useCallback(() => {
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
  }, [selectedProduct, quantity, items]);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const saveSale = useCallback(() => {
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
      const parsed = parseYMD(saleDate);
      if (!parsed) {
        Alert.alert('Fecha invalida', 'Selecciona una fecha valida.');
        return;
      }
      const today = formatYMDLocal(new Date());
      if (saleDate > today) {
        Alert.alert('Fecha invalida', 'No se permiten fechas futuras.');
        return;
      }
      const createdAt = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0).getTime();
      add({ items, total, department: dep, paymentStatus, paymentType, createdAt });
      setItems([]);
      setSelectedId(null);
      setQuantity('');
      setDepartment('');
      setDeptError(null);
      setQtyError(null);
      setProductError(false);
      setPaymentStatus('pagado');
      setPaymentType('efectivo');
      const todayReset = formatYMDLocal(new Date());
      setSaleDate(todayReset);
      setDraftDate(todayReset);
      toast.show('Venta guardada', { type: 'success' });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, [items, total, department, paymentStatus, paymentType, add, toast, saleDate]);

  const openCalendar = useCallback(() => {
    setDraftDate(saleDate || formatYMDLocal(new Date()));
    setCalendarVisible(true);
  }, [saleDate]);

  const closeCalendar = useCallback(() => {
    setCalendarVisible(false);
  }, []);

  const onCalendarDayPress = useCallback((day: DateData) => {
    setDraftDate(day.dateString);
  }, []);

  const applyCalendar = useCallback(() => {
    const today = formatYMDLocal(new Date());
    if (draftDate > today) {
      Alert.alert('Fecha invalida', 'No se permiten fechas futuras.');
      return;
    }
    setSaleDate(draftDate);
    setCalendarVisible(false);
  }, [draftDate]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => setShowTop(e.nativeEvent.contentOffset.y > 200)}
        scrollEventThrottle={32}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={true}
      >
      <Title>Registrar Venta</Title>

      <View style={[styles.card, { marginBottom: 12 }] }>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Agregar producto a la venta</Text>
        <Text style={styles.label}>Fecha de venta</Text>
        <Pressable onPress={openCalendar} style={[styles.input, { marginBottom: 10 }]}>
          <Text style={{ color: saleDate ? '#111827' : '#9ca3af' }}>{saleDate || 'YYYY-MM-DD'}</Text>
        </Pressable>
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
        <Field
          label="Cantidad"
          value={quantity}
          onChangeText={(t) => {
            const isKg = selectedProduct?.unit === 'kg';
            let next = t;
            if (isKg) {
              next = next.replace(',', '.');
              next = next.replace(/[^\d.]/g, '');
              const firstDot = next.indexOf('.');
              if (firstDot !== -1) {
                next = next.slice(0, firstDot + 1) + next.slice(firstDot + 1).replace(/\./g, '');
              }
            } else {
              next = next.replace(/\D/g, '');
            }
            setQuantity(next);
            if (qtyError) setQtyError(null);
          }}
          placeholder={selectedProduct?.unit === 'kg' ? 'Ej. 1.25' : 'Ej. 2'}
          keyboardType={selectedProduct?.unit === 'kg' ? 'decimal-pad' : 'numeric'}
          error={qtyError}
        />
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
          removeClippedSubviews={true}
          ListEmptyComponent={<Text style={styles.small}>Aún no hay productos en la venta</Text>}
        />

        <View style={[styles.row, { marginTop: 8 }]}>
          <Text style={{ fontWeight: '700' }}>Total</Text>
          <Text style={{ fontWeight: '700' }}>{formatCLP(total)}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Guardar venta" onPress={saveSale} disabled={items.length === 0} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Ver deudas"
            variant="secondary"
            onPress={() => navigation.navigate('Por Cobrar')}
          />
        </View>
      </View>

      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Deudas pendientes</Text>
        {pendingSales.length === 0 ? (
          <Text style={styles.small}>Sin ventas pendientes</Text>
        ) : (
          <Text style={[styles.label, { marginBottom: 8 }]}>
            Tienes {pendingSales.length} deuda(s) pendiente(s) por {formatCLP(pendingSales.reduce((acc, s) => acc + s.total, 0))}
          </Text>
        )}
        {pendingSales.length > 0 && (
          <Button
            title="Ir a Por Cobrar →"
            onPress={() => navigation.navigate('Por Cobrar')}
          />
        )}
      </View>
      </ScrollView>
      <FloatingScrollTop visible={showTop} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
      {calendarVisible && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={closeCalendar}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, width: '100%', maxWidth: 420 }}>
              <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 6 }}>Seleccionar fecha</Text>
              <Text style={[styles.small, { marginBottom: 10 }]}>Fecha: {draftDate || 'YYYY-MM-DD'}</Text>
              <Calendar
                current={draftDate || formatYMDLocal(new Date())}
                maxDate={formatYMDLocal(new Date())}
                markedDates={draftDate ? { [draftDate]: { selected: true, selectedColor: '#2563eb', selectedTextColor: 'white' } } : undefined}
                onDayPress={onCalendarDayPress}
                firstDay={1}
                hideExtraDays
                theme={{
                  calendarBackground: 'white',
                  textSectionTitleColor: '#6b7280',
                  selectedDayBackgroundColor: '#2563eb',
                  selectedDayTextColor: 'white',
                  dayTextColor: '#111827',
                  textDisabledColor: '#d1d5db',
                  monthTextColor: '#111827',
                  arrowColor: '#111827',
                  todayTextColor: '#2563eb',
                  textDayFontWeight: '500',
                  textMonthFontWeight: '700',
                  textDayHeaderFontWeight: '600',
                }}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <Button title="Aplicar" onPress={applyCalendar} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Cancelar" variant="secondary" onPress={closeCalendar} />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function parseYMD(s: string): Date | null {
  if (!s) return null;
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!ok) return null;
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  return isNaN(date.getTime()) ? null : date;
}

function formatYMDLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
