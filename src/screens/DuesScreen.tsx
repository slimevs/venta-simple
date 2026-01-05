import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View, ScrollView, Platform, Modal } from 'react-native';
import { useProducts } from '../state/ProductsContext';
import { useSales } from '../state/SalesContext';
import { Button, Field, Title, styles } from '../components/Common';
import { SalesListItem } from '../components/SalesListItem';
import { formatCLP } from '../utils/currency';
import { FloatingScrollTop } from '../components/FloatingScrollTop';
import { useToast } from '../components/Toast';
import { Sale } from '../models/Sale';

export function DuesScreen() {
  const { products } = useProducts();
  const { sales, update, remove } = useSales();
  const toast = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const [showTop, setShowTop] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payType, setPayType] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [filterDept, setFilterDept] = useState('');
  const [filterPaymentType, setFilterPaymentType] = useState<'todas' | 'efectivo' | 'transferencia'>('todas');
  const [sortBy, setSortBy] = useState<'fecha' | 'total'>('fecha');

  // Filtrar solo ventas pendientes
  const pendingSales = useMemo(() => sales.filter((s) => s.paymentStatus !== 'pagado'), [sales]);

  // Aplicar filtros
  const filtered = useMemo(() => {
    let result = [...pendingSales];

    // Filtrar por departamento
    if (filterDept.trim()) {
      const deptNum = parseInt(filterDept, 10);
      result = result.filter((s) => s.department === deptNum);
    }

    // Filtrar por tipo de pago
    if (filterPaymentType !== 'todas') {
      result = result.filter((s) => s.paymentType === filterPaymentType);
    }

    // Ordenar
    if (sortBy === 'fecha') {
      result.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'total') {
      result.sort((a, b) => b.total - a.total);
    }

    return result;
  }, [pendingSales, filterDept, filterPaymentType, sortBy]);

  const totalDue = useMemo(() => filtered.reduce((acc, s) => acc + s.total, 0), [filtered]);

  const handleMarkAsPaid = useCallback((sale: Sale) => {
    setPaySale(sale);
    setPayType(sale.paymentType || 'efectivo');
  }, []);

  const confirmMarkAsPaid = useCallback(() => {
    if (!paySale) return;
    update(paySale.id, { paymentStatus: 'pagado', paymentType: payType });
    toast.show('Venta marcada como pagada', { type: 'success' });
    setPaySale(null);
  }, [paySale, payType, update, toast]);

  const handleDelete = useCallback((saleId: string) => {
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' && typeof (window as any).confirm === 'function'
        ? (window as any).confirm('¿Deseas eliminar esta venta pendiente? Se restaurará el stock.')
        : true;
      if (ok) {
        remove(saleId);
        toast.show('Venta eliminada', { type: 'success' });
      }
    } else {
      Alert.alert('Eliminar venta pendiente', '¿Deseas eliminar esta venta pendiente? Se restaurará el stock.', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            remove(saleId);
            toast.show('Venta eliminada', { type: 'success' });
          },
        },
      ]);
    }
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
        <Title>Ventas por Cobrar</Title>

        {/* Resumen */}
        <View style={[styles.card, { marginBottom: 16 }]}>
          <View style={styles.row}>
            <View>
              <Text style={styles.label}>Total por cobrar</Text>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#1d4ed8' }}>{formatCLP(totalDue)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.label}>Deudas pendientes</Text>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#f59e0b' }}>{filtered.length}</Text>
            </View>
          </View>
        </View>

        {/* Filtros */}
        <View style={[styles.card, { marginBottom: 16 }]}>
          <Text style={{ fontWeight: '700', marginBottom: 12 }}>Filtros</Text>

          <Field
            label="Departamento"
            value={filterDept}
            onChangeText={(t) => setFilterDept(t.replace(/[^0-9]/g, ''))}
            placeholder="Ej. 10"
            keyboardType="numeric"
          />

          <Text style={[styles.label, { marginTop: 10, marginBottom: 8 }]}>Tipo de pago</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { key: 'todas', label: 'Todas' },
              { key: 'efectivo', label: 'Efectivo' },
              { key: 'transferencia', label: 'Transferencia' },
            ].map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => setFilterPaymentType(opt.key as any)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: filterPaymentType === opt.key ? '#1d4ed8' : '#d1d5db',
                  backgroundColor: filterPaymentType === opt.key ? '#dbeafe' : 'white',
                }}
              >
                <Text style={{ color: '#111827', fontSize: 12 }}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { marginBottom: 8 }]}>Ordenar por</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { key: 'fecha', label: 'Más reciente' },
              { key: 'total', label: 'Mayor deuda' },
            ].map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => setSortBy(opt.key as any)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: sortBy === opt.key ? '#1d4ed8' : '#d1d5db',
                  backgroundColor: sortBy === opt.key ? '#dbeafe' : 'white',
                }}
              >
                <Text style={{ color: '#111827', fontSize: 12 }}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Lista de deudas */}
        <View style={[styles.card]}>
          <Text style={{ fontWeight: '700', marginBottom: 12 }}>
            {filtered.length === 0 ? 'Sin deudas pendientes' : `${filtered.length} deuda(s) pendiente(s)`}
          </Text>

          <FlatList
            data={filtered}
            keyExtractor={(s) => s.id}
            renderItem={({ item: s }) => (
              <SalesListItem
                sale={s}
                onMarkAsPaid={handleMarkAsPaid}
                onViewDetail={setDetailSale}
                onDelete={handleDelete}
              />
            )}
            scrollEnabled={false}
            removeClippedSubviews={true}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={[styles.label, { marginBottom: 8 }]}>✓ ¡No hay deudas pendientes!</Text>
                <Text style={styles.small}>Todas las ventas han sido cobradas</Text>
              </View>
            }
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
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Detalle de deuda</Text>
            {detailSale && (
              <View>
                <View style={[styles.row, { marginBottom: 12 }]}>
                  <View>
                    <Text style={styles.small}>Fecha</Text>
                    <Text style={{ fontWeight: '600' }}>
                      {new Date(detailSale.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.small}>Total</Text>
                    <Text style={{ fontWeight: '700', fontSize: 16, color: '#dc2626' }}>
                      {formatCLP(detailSale.total)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.row, { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]}>
                  <View>
                    <Text style={styles.small}>Departamento</Text>
                    <Text style={{ fontWeight: '600' }}>
                      {typeof detailSale.department === 'number' ? detailSale.department : '-'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.small}>Tipo de pago</Text>
                    <Text style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                      {detailSale.paymentType}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.small}>Items</Text>
                    <Text style={{ fontWeight: '600' }}>{detailSale.items.length}</Text>
                  </View>
                </View>

                <Text style={[styles.label, { marginBottom: 8 }]}>Productos</Text>
                <View style={{ maxHeight: 260, marginBottom: 12 }}>
                  <FlatList
                    data={detailSale.items}
                    keyExtractor={(i) => i.productId}
                    renderItem={({ item }) => {
                      const p = products.find((x) => x.id === item.productId);
                      return (
                        <View style={[styles.row, { marginBottom: 8 }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '500' }}>{p?.name ?? item.productId}</Text>
                            <Text style={[styles.small, { marginTop: 2 }]}>
                              {item.quantity} {p?.unit === 'kg' ? 'kg' : 'un.'} × {formatCLP(item.price)}
                            </Text>
                          </View>
                          <Text style={{ fontWeight: '600', minWidth: 80, textAlign: 'right' }}>
                            {formatCLP(item.subtotal)}
                          </Text>
                        </View>
                      );
                    }}
                    scrollEnabled={false}
                  />
                </View>

                <View style={styles.row}>
                  <Text style={{ fontWeight: '700' }}>Total:</Text>
                  <Text style={{ fontWeight: '700', color: '#dc2626' }}>{formatCLP(detailSale.total)}</Text>
                </View>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Cobrado"
                  onPress={() => {
                    if (detailSale) {
                      handleMarkAsPaid(detailSale);
                      setDetailSale(null);
                    }
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Cerrar" variant="secondary" onPress={() => setDetailSale(null)} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Cobro */}
      <Modal
        visible={!!paySale}
        transparent
        animationType="fade"
        onRequestClose={() => setPaySale(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, width: '100%', maxWidth: 420 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Metodo de pago</Text>
            <Text style={[styles.label, { marginBottom: 8 }]}>
              Selecciona el metodo con el que se pago la venta
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {[
                { key: 'efectivo', label: 'Efectivo' },
                { key: 'transferencia', label: 'Transferencia' },
              ].map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setPayType(opt.key as any)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: payType === opt.key ? '#1d4ed8' : '#d1d5db',
                    backgroundColor: payType === opt.key ? '#dbeafe' : 'white',
                  }}
                >
                  <Text style={{ color: '#111827' }}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Confirmar" onPress={confirmMarkAsPaid} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Cancelar" variant="secondary" onPress={() => setPaySale(null)} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <FloatingScrollTop visible={showTop} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
    </View>
  );
}
