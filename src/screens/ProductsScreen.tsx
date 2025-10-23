import React, { useMemo, useState } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { useProducts } from '../state/ProductsContext';
import { Button, Field, Title, styles } from '../components/Common';
import { Product } from '../models/Product';

export function ProductsScreen() {
  const { products, add, update, remove } = useProducts();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState<Product['unit']>('unit');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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
  }

  function onSubmit() {
    const p = parseFloat(price);
    const s = unit === 'kg' ? parseFloat(stock || '0') : parseInt(stock || '0', 10);
    if (!name.trim() || isNaN(p) || isNaN(s)) return;
    if (editingId) {
      update(editingId, { name: name.trim(), price: p, stock: s, unit });
    } else {
      add({ name: name.trim(), price: p, stock: s, unit });
    }
    resetForm();
  }

  return (
    <View style={styles.screen}>
      <Title>Productos</Title>

      <View style={[styles.card, { marginBottom: 16 }] }>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>{editingId ? 'Editar producto' : 'Nuevo producto'}</Text>
        <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Manzana" />
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
        <Field label={unit === 'kg' ? 'Precio por kg' : 'Precio unitario'} value={price} onChangeText={setPrice} placeholder="Ej. 12.50" keyboardType="numeric" />
        <Field label={unit === 'kg' ? 'Stock (kg)' : 'Stock (u)'} value={stock} onChangeText={setStock} placeholder={unit === 'kg' ? 'Ej. 10.5' : 'Ej. 100'} keyboardType="numeric" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title={editingId ? 'Guardar cambios' : 'Agregar'} onPress={onSubmit} />
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
              <Text style={styles.small}>Precio: ${item.price.toFixed(2)} {item.unit === 'kg' ? '/kg' : ''}</Text>
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
        ListEmptyComponent={<Text style={styles.small}>No hay productos aún</Text>}
      />
    </View>
  );
}
