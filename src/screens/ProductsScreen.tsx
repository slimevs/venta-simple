import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Alert, FlatList, Text, TextInput, View, ScrollView, Modal, Platform } from 'react-native';
import { useProducts } from '../state/ProductsContext';
import { Button, Field, Title, styles } from '../components/Common';
import { FloatingScrollTop } from '../components/FloatingScrollTop';
import { formatCLP } from '../utils/currency';
import { Product } from '../models/Product';
import { useToast } from '../components/Toast';
import { fetchProductChangesFromSheets, reduceProductChanges } from '../services/sheets';

export function ProductsScreen() {
  const { products, add, update, remove, setAll } = useProducts();
  const toast = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const [showTop, setShowTop] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState<Product['unit']>('unit');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [nameError, setNameError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const pageSize = 5;

  const filtered = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, products.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const resetForm = useCallback(() => {
    setName('');
    setPrice('');
    setStock('');
    setEditingId(null);
    setUnit('unit');
    setNameError(null);
    setPriceError(null);
    setStockError(null);
    setFormOpen(false);
  }, []);

  const onSubmit = useCallback(() => {
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
  }, [name, price, stock, unit, editingId, update, add, toast, resetForm]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setName('');
    setPrice('');
    setStock('');
    setUnit('unit');
    setNameError(null);
    setPriceError(null);
    setStockError(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((item: Product) => {
    setEditingId(item.id);
    setName(item.name);
    setPrice(String(item.price));
    setStock(String(item.stock));
    setUnit((item as any).unit ?? 'unit');
    setNameError(null);
    setPriceError(null);
    setStockError(null);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' && typeof (window as any).confirm === 'function'
        ? (window as any).confirm('¿Deseas eliminar este producto?')
        : true;
      if (ok) {
        remove(id);
        toast.show('Producto eliminado', { type: 'success' });
      }
      return;
    }
    Alert.alert('Eliminar producto', '¿Deseas eliminar este producto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          remove(id);
          toast.show('Producto eliminado', { type: 'success' });
        },
      },
    ]);
  }, [remove, toast]);

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
      <Title>Productos</Title>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button
          title="Sincronizar ahora"
          variant="secondary"
          iconName="sync-outline"
          onPress={async () => {
            try {
              const changes = await fetchProductChangesFromSheets();
              if (changes && changes.length) {
                const next = reduceProductChanges(changes);
                setAll(next);
                toast.show('Productos sincronizados', { type: 'success' });
              } else {
                toast.show('Sin cambios de productos', { type: 'info' });
              }
            } catch (e) {
              toast.show('Error al sincronizar', { type: 'error' });
            }
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <Button title="Nuevo producto" onPress={openNew} iconName="add-circle-outline" />
      </View>

      <TextInput value={query} onChangeText={setQuery} placeholder="Buscar producto" style={[styles.input, { marginBottom: 8 }]} />

      <FlatList
        data={paged}
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
                <Button title="Editar" variant="secondary" onPress={() => openEdit(item)} iconName="create-outline" />
                <Button title="Borrar" variant="danger" onPress={() => handleDelete(item.id)} iconName="trash-outline" />
              </View>
            </View>
          </View>
        )}
        scrollEnabled={false}
        removeClippedSubviews={true}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        ListEmptyComponent={<Text style={styles.small}>No hay productos aún</Text>}
      />
      <View style={[styles.row, { marginTop: 8 }]}>
        <Text style={styles.small}>Pagina {page} de {totalPages}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Anterior" variant="secondary" onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} iconName="chevron-back-outline" />
          <Button title="Siguiente" variant="secondary" onPress={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} iconName="chevron-forward-outline" />
        </View>
      </View>
      </ScrollView>
      <Modal
        visible={formOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFormOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, width: '100%', maxWidth: 520 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12 }}>
              {editingId ? 'Editar producto' : 'Nuevo producto'}
            </Text>
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
            <Field
              label={unit === 'kg' ? 'Stock (kg)' : 'Stock (u)'}
              value={stock}
              onChangeText={(t) => {
                let next = t;
                if (unit === 'kg') {
                  next = next.replace(',', '.');
                  next = next.replace(/[^\d.]/g, '');
                  const firstDot = next.indexOf('.');
                  if (firstDot !== -1) {
                    next = next.slice(0, firstDot + 1) + next.slice(firstDot + 1).replace(/\./g, '');
                  }
                } else {
                  next = next.replace(/\D/g, '');
                }
                setStock(next);
                if (stockError) setStockError(null);
              }}
              placeholder={unit === 'kg' ? 'Ej. 10.5' : 'Ej. 100'}
              keyboardType={unit === 'kg' ? 'decimal-pad' : 'numeric'}
              error={stockError}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={editingId ? 'Guardar cambios' : 'Agregar'}
                  onPress={onSubmit}
                  iconName={editingId ? 'save-outline' : 'add-circle-outline'}
                  disabled={
                    !name.trim() ||
                    isNaN(parseFloat(price)) || parseFloat(price) <= 0 ||
                    (unit === 'kg' ? isNaN(parseFloat(stock || '')) : isNaN(parseInt(stock || '0', 10))) ||
                    (unit === 'kg' ? (parseFloat(stock || '0') < 0) : (parseInt(stock || '0', 10) < 0)) ||
                    !!nameError || !!priceError || !!stockError
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Cancelar" variant="secondary" onPress={resetForm} iconName="close-circle-outline" />
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <FloatingScrollTop visible={showTop} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
    </View>
  );
}
