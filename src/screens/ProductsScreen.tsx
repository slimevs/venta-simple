import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Text, TextInput, View, ScrollView } from 'react-native';
import { useProducts } from '../state/ProductsContext';
import { Button, Field, Title, styles } from '../components/Common';
import { FloatingScrollTop } from '../components/FloatingScrollTop';
import { formatCLP } from '../utils/currency';
import { Product } from '../models/Product';
import { useToast } from '../components/Toast';

export function ProductsScreen() {
  const { products, add, update, remove } = useProducts();
  const toast = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const [showTop, setShowTop] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState<Product['unit']>('unit');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  function resetForm() {
    setName('');
    setPrice('');
    setStock('');
    setEditingId(null);
    setUnit('unit');
    setNameError(null);
    setPriceError(null);
    setStockError(null);
  }

  function onSubmit() {
    const hasName = name.trim().length > 0;
    const p = parseFloat(price);
    const s = unit === 'kg' ? parseFloat(stock || '0') : parseInt(stock || '0', 10);
    const priceValid = !isNaN(p) && p > 0;
    const stockValid = !isNaN(s) && s >= 0;

    setNameError(hasName ? null : 'Ingresa un nombre');
    setPriceError(priceValid ? null : 'Ingresa un precio válido (> 0)');
    setStockError(stockValid ? null : unit === 'kg' ? 'Ingresa un stock (kg) válido (>= 0)' : 'Ingresa un stock (u) válido (>= 0)');

    if (!hasName || !priceValid || !stockValid) return;
    if (editingId) {
      update(editingId, { name: name.trim(), price: p, stock: s, unit });
      toast.show('Producto actualizado', { type: 'success' });
    } else {
      add({ name: name.trim(), price: p, stock: s, unit });
      toast.show('Producto guardado', { type: 'success' });
    }
    resetForm();
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
      <Title>Productos</Title>

      <View style={[styles.card, { marginBottom: 16 }] }>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>{editingId ? 'Editar producto' : 'Nuevo producto'}</Text>
        <Field label="Nombre" value={name} onChangeText={(t) => { setName(t); if (nameError) setNameError(null); }} placeholder="Ej. Manzana" error={nameError} />
        <Text style={[styles.label, { marginBottom: 6 }]}>Unidad</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {[
            { key: 'unit', label: 'Unitario' },
            { key: 'kg', label: 'Kg' },
          ].map((opt) => (
            <TextInput
              key={opt.key}
              editable={false}
              value={opt.label}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: unit === (opt.key as any) ? '#1d4ed8' : '#d1d5db',
                backgroundColor: unit === (opt.key as any) ? '#dbeafe' : 'white',
                color: '#111827',
                textAlign: 'center',
                minWidth: 90,
              }}
              onTouchStart={() => setUnit(opt.key as Product['unit'])}
            />
          ))}
        </View>
        <Field label={unit === 'kg' ? 'Precio por kg' : 'Precio unitario'} value={price} onChangeText={(t) => { setPrice(t); if (priceError) setPriceError(null); }} placeholder="Ej. 12.50" keyboardType="numeric" error={priceError} />
        <Field label={unit === 'kg' ? 'Stock (kg)' : 'Stock (u)'} value={stock} onChangeText={(t) => { setStock(t); if (stockError) setStockError(null); }} placeholder={unit === 'kg' ? 'Ej. 10.5' : 'Ej. 100'} keyboardType="numeric" error={stockError} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button
              title={editingId ? 'Guardar cambios' : 'Agregar'}
              onPress={onSubmit}
              disabled={
                !name.trim() ||
                isNaN(parseFloat(price)) || parseFloat(price) <= 0 ||
                (unit === 'kg' ? isNaN(parseFloat(stock || '')) : isNaN(parseInt(stock || '0', 10))) ||
                (unit === 'kg' ? (parseFloat(stock || '0') < 0) : (parseInt(stock || '0', 10) < 0)) ||
                !!nameError || !!priceError || !!stockError
              }
            />
          </View>
          {editingId && (
            <View style={{ flex: 1 }}>
              <Button title="Cancelar" variant="secondary" onPress={resetForm} />
            </View>
          )}
        </View>
      </View>

      <TextInput value={query} onChangeText={setQuery} placeholder="Buscar producto" style={[styles.input, { marginBottom: 8 }]} />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={{ fontWeight: '700' }}>{item.name}</Text>
              <Text style={styles.small}>Stock: {item.stock} {item.unit === 'kg' ? 'kg' : 'u'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.small}>Precio: {formatCLP(item.price)} {item.unit === 'kg' ? '/kg' : ''}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Editar" variant="secondary" onPress={() => {
                  setEditingId(item.id);
                  setName(item.name);
                  setPrice(String(item.price));
                  setStock(String(item.stock));
                  setUnit((item as any).unit ?? 'unit');
                }} />
                <Button title="Borrar" variant="danger" onPress={() => remove(item.id)} />
              </View>
            </View>
          </View>
        )}
        scrollEnabled={false}
        ListEmptyComponent={<Text style={styles.small}>No hay productos aún</Text>}
      />
      </ScrollView>
      <FloatingScrollTop visible={showTop} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
    </View>
  );
}
