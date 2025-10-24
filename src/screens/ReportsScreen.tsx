import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Text, View, Platform, ScrollView, Pressable } from 'react-native';
import { useSales } from '../state/SalesContext';
import { useProducts } from '../state/ProductsContext';
import { Button, Title, styles, Field } from '../components/Common';
import { formatCLP } from '../utils/currency';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { fetchSalesFromSheets } from '../services/sheets';
import { useToast } from '../components/Toast';
import type { Sale } from '../models/Sale';
import type { Product } from '../models/Product';

type DayStat = { date: string; total: number };

export function ReportsScreen() {
  const { sales, setAll } = useSales();
  const { products } = useProducts();
  const toast = useToast();
  const [days] = useState(7);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pagado' | 'pendiente'>('todos');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'efectivo' | 'transferencia'>('todos');
  const [departmentFilter, setDepartmentFilter] = useState<string>('todos');
  const [deptDropdown, setDeptDropdown] = useState(false);
  const [deptFilter, setDeptFilter] = useState('');
  const [prodDropdown, setProdDropdown] = useState(false);
  const [prodFilter, setProdFilter] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const filteredSales = useMemo(() => {
    const start = parseYMD(startDate);
    const end = parseYMD(endDate);
    const endMs = end ? end.getTime() + 24 * 60 * 60 * 1000 - 1 : undefined;
    return sales.filter((s) => {
      const t = s.createdAt;
      if (start && t < start.getTime()) return false;
      if (endMs && t > endMs) return false;
      if (statusFilter !== 'todos' && s.paymentStatus !== statusFilter) return false;
      const pt = ((s as any).paymentType === 'transferencia' ? 'transferencia' : 'efectivo') as 'efectivo' | 'transferencia';
      if (typeFilter !== 'todos' && pt !== typeFilter) return false;
      if (departmentFilter !== 'todos') {
        const dep = typeof s.department === 'number' ? s.department : 0;
        if (dep !== (parseInt(departmentFilter, 10) || 0)) return false;
      }
      return true;
    });
  }, [sales, startDate, endDate, statusFilter, typeFilter, departmentFilter]);

  const availableDepartments = useMemo(() => {
    const set = new Set<number>();
    for (const s of sales) {
      const dep = typeof s.department === 'number' ? s.department : 0;
      set.add(dep);
    }
    return Array.from(set.values()).sort((a, b) => a - b);
  }, [sales]);

  const summary = useMemo(() => {
    const revenue = filteredSales.reduce((a, s) => a + s.total, 0);
    const units = filteredSales.reduce((a, s) => a + s.items.reduce((b, i) => b + i.quantity, 0), 0);
    const perProduct: Record<string, number> = {};
    for (const s of filteredSales) for (const it of s.items) perProduct[it.productId] = (perProduct[it.productId] || 0) + it.quantity;
    const top = Object.entries(perProduct)
      .map(([productId, qty]) => ({ productId, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map((x) => ({ name: products.find((p) => p.id === x.productId)?.name ?? 'Desconocido', qty: x.qty }));

    // Últimos N días
    const now = new Date();
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const daysArr: DayStat[] = [];
    const map: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = dayKey(d);
      daysArr.push({ date: key, total: 0 });
      map[key] = 0;
    }
    for (const s of filteredSales) {
      const key = dayKey(new Date(s.createdAt));
      if (key in map) map[key] += s.total;
    }
    for (const d of daysArr) d.total = map[d.date] || 0;

    const max = Math.max(1, ...daysArr.map((d) => d.total));

    return { revenue, units, top, lastDays: daysArr, max };
  }, [filteredSales, products, days]);

  const pendingSales = useMemo(() => filteredSales.filter((s) => s.paymentStatus !== 'pagado'), [filteredSales]);
  const pendingTotal = useMemo(() => pendingSales.reduce((a, s) => a + s.total, 0), [pendingSales]);

  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedProductId), [products, selectedProductId]);
  const filteredProducts = useMemo(() => {
    const q = prodFilter.trim().toLowerCase();
    return !q ? products : products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, prodFilter]);

  const productRows = useMemo(() => {
    if (!selectedProductId) return [] as { date: number; quantity: number; price: number; subtotal: number; department: number; paymentStatus: string; paymentType: string }[];
    const out: { date: number; quantity: number; price: number; subtotal: number; department: number; paymentStatus: string; paymentType: string }[] = [];
    for (const s of filteredSales) {
      for (const it of s.items) {
        if (it.productId === selectedProductId) {
          out.push({ date: s.createdAt, quantity: it.quantity, price: it.price, subtotal: it.subtotal, department: typeof s.department === 'number' ? s.department : 0, paymentStatus: s.paymentStatus, paymentType: (s as any).paymentType || '' });
        }
      }
    }
    return out.sort((a, b) => a.date - b.date);
  }, [filteredSales, selectedProductId]);

  const productTotals = useMemo(() => {
    const qty = productRows.reduce((a, r) => a + r.quantity, 0);
    const revenue = productRows.reduce((a, r) => a + r.subtotal, 0);
    return { qty, revenue };
  }, [productRows]);

  // Resumen por producto + tipo/estado de pago
  const productPaymentSummary = useMemo(() => {
    type Agg = {
      productId: string;
      name: string;
      unit: 'unit' | 'kg' | string;
      qty: number;
      revenue: number;
      status: { pagado: { qty: number; revenue: number }; pendiente: { qty: number; revenue: number } };
      type: { efectivo: { qty: number; revenue: number }; transferencia: { qty: number; revenue: number } };
    };
    const map = new Map<string, Agg>();
    for (const s of filteredSales) {
      for (const it of s.items) {
        const p = products.find((x) => x.id === it.productId);
        let agg = map.get(it.productId);
        if (!agg) {
          agg = {
            productId: it.productId,
            name: p?.name ?? 'Desconocido',
            unit: p?.unit ?? '',
            qty: 0,
            revenue: 0,
            status: { pagado: { qty: 0, revenue: 0 }, pendiente: { qty: 0, revenue: 0 } },
            type: { efectivo: { qty: 0, revenue: 0 }, transferencia: { qty: 0, revenue: 0 } },
          };
          map.set(it.productId, agg);
        }
        agg.qty += it.quantity;
        agg.revenue += it.subtotal;
        const st = (s.paymentStatus === 'pagado' ? 'pagado' : 'pendiente') as 'pagado' | 'pendiente';
        agg.status[st].qty += it.quantity;
        agg.status[st].revenue += it.subtotal;
        const pt = ((s as any).paymentType === 'transferencia' ? 'transferencia' : 'efectivo') as 'efectivo' | 'transferencia';
        agg.type[pt].qty += it.quantity;
        agg.type[pt].revenue += it.subtotal;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, products]);

  // Resumen por departamento
  const departmentSummary = useMemo(() => {
    type Agg = {
      department: number;
      salesCount: number;
      qty: number;
      revenue: number;
      status: { pagado: { qty: number; revenue: number }; pendiente: { qty: number; revenue: number } };
      type: { efectivo: { qty: number; revenue: number }; transferencia: { qty: number; revenue: number } };
    };
    const map = new Map<number, Agg>();
    for (const s of filteredSales) {
      const dep = typeof s.department === 'number' ? s.department : 0;
      let agg = map.get(dep);
      if (!agg) {
        agg = {
          department: dep,
          salesCount: 0,
          qty: 0,
          revenue: 0,
          status: { pagado: { qty: 0, revenue: 0 }, pendiente: { qty: 0, revenue: 0 } },
          type: { efectivo: { qty: 0, revenue: 0 }, transferencia: { qty: 0, revenue: 0 } },
        };
        map.set(dep, agg);
      }
      const saleQty = s.items.reduce((a, it) => a + it.quantity, 0);
      agg.salesCount += 1;
      agg.qty += saleQty;
      agg.revenue += s.total;
      const st = (s.paymentStatus === 'pagado' ? 'pagado' : 'pendiente') as 'pagado' | 'pendiente';
      agg.status[st].qty += saleQty;
      agg.status[st].revenue += s.total;
      const pt = ((s as any).paymentType === 'transferencia' ? 'transferencia' : 'efectivo') as 'efectivo' | 'transferencia';
      agg.type[pt].qty += saleQty;
      agg.type[pt].revenue += s.total;
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <Title>Reportes</Title>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button
          title="Sincronizar ventas"
          variant="secondary"
          onPress={async () => {
            try {
              const remote = await fetchSalesFromSheets();
              if (remote && remote.length) {
                setAll(remote);
                toast.show('Ventas sincronizadas', { type: 'success' });
              } else {
                toast.show('Sin ventas remotas', { type: 'info' });
              }
            } catch (e) {
              toast.show('Error al sincronizar ventas', { type: 'error' });
            }
          }}
        />
      </View>

      <View style={[styles.card, { marginBottom: 12 }]}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Filtro por fechas</Text>
        <Field label="Desde (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} placeholder="2025-01-01" />
        <Field label="Hasta (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} placeholder="2025-12-31" />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <View style={{ flex: 1 }}>
            <Button title="Últimos 7 días" variant="secondary" onPress={() => setQuickRange(7, setStartDate, setEndDate)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Últimos 30 días" variant="secondary" onPress={() => setQuickRange(30, setStartDate, setEndDate)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Limpiar" variant="secondary" onPress={() => { setStartDate(''); setEndDate(''); }} />
          </View>
        </View>
      </View>

      <View style={[styles.card, { marginBottom: 12 }]}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Filtros de pago</Text>
        <Text style={styles.small}>Estado de pago</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'pagado', label: 'Pagado' },
            { key: 'pendiente', label: 'Pendiente' },
          ].map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setStatusFilter(opt.key as any)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: (statusFilter as any) === opt.key ? '#1d4ed8' : '#d1d5db',
                backgroundColor: (statusFilter as any) === opt.key ? '#dbeafe' : 'white',
              }}
            >
              <Text style={{ color: '#111827' }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.small}>Tipo de pago</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'efectivo', label: 'Efectivo' },
            { key: 'transferencia', label: 'Transferencia' },
          ].map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setTypeFilter(opt.key as any)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: (typeFilter as any) === opt.key ? '#1d4ed8' : '#d1d5db',
                backgroundColor: (typeFilter as any) === opt.key ? '#dbeafe' : 'white',
              }}
            >
              <Text style={{ color: '#111827' }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 8 }} />
        <Text style={styles.small}>Departamento</Text>
        <View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Buscar departamento"
                value={deptFilter}
                onChangeText={(t) => { setDeptFilter(t); setDeptDropdown(true); }}
                placeholder={departmentFilter === 'todos' ? 'Todos' : `Depto ${departmentFilter}`}
              />
            </View>
            <View style={{ width: 140 }}>
              <Button title={deptDropdown ? 'Cerrar' : 'Seleccionar'} variant="secondary" onPress={() => setDeptDropdown((v) => !v)} />
            </View>
          </View>
          {deptDropdown && (
            <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, marginTop: 8 }}>
              <FlatList
                style={{ maxHeight: 220 }}
                data={[ 'todos', ...availableDepartments.map(String) ].filter((d) => String(d).toLowerCase().includes(deptFilter.trim().toLowerCase()))}
                keyExtractor={(i) => String(i)}
                renderItem={({ item }) => (
                  <Text onPress={() => { setDepartmentFilter(String(item)); setDeptDropdown(false); setDeptFilter(''); }} style={{ padding: 10 }}>
                    {item === 'todos' ? 'Todos' : `Depto ${item}`}
                  </Text>
                )}
              />
            </View>
          )}
        </View>
      </View>

      <View style={[styles.card, { marginBottom: 12 }]}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Reporte por producto y pago</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="Exportar CSV (Resumen)" variant="secondary" onPress={async () => {
              try {
                const csv = buildProductPaymentCSV(productPaymentSummary);
                const name = `resumen_productos_${new Date().toISOString().slice(0,10)}.csv`;
                if (Platform.OS === 'web') {
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
                } else {
                  const uri = FileSystem.cacheDirectory + name;
                  await FileSystem.writeAsStringAsync(uri, csv as any, { encoding: (FileSystem as any).EncodingType?.UTF8 ?? 'utf8' } as any);
                  const available = await (Sharing as any).isAvailableAsync();
                  if (available) await (Sharing as any).shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Compartir resumen CSV' } as any);
                  else Alert.alert('Exportación lista', `Archivo guardado en: ${uri}`);
                }
              } catch (e: any) {
                Alert.alert('Error al exportar CSV', String(e?.message ?? e));
              }
            }} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Exportar PDF (Resumen)" variant="secondary" onPress={async () => {
              try {
                const html = buildProductPaymentReportHTML(productPaymentSummary, startDate, endDate);
                const { uri } = await (Print as any).printToFileAsync({ html });
                if (Platform.OS === 'android' || Platform.OS === 'ios') {
                  const available = await (Sharing as any).isAvailableAsync();
                  if (available) await (Sharing as any).shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartir resumen PDF' } as any);
                  else Alert.alert('PDF listo', `Archivo guardado en: ${uri}`);
                } else {
                  (window as any).open(uri, '_blank');
                }
              } catch (e: any) {
                Alert.alert('Error al exportar PDF', String(e?.message ?? e));
              }
            }} />
          </View>
        </View>
        <FlatList
          scrollEnabled={false}
          data={productPaymentSummary}
          keyExtractor={(i) => i.productId}
          ListHeaderComponent={() => (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontWeight: '700' }}>Producto</Text>
              <Text style={{ fontWeight: '700' }}>Totales / Pagado / Pendiente / Efectivo / Transferencia</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>{item.name}</Text>
                <Text>{formatCLP(item.revenue)}</Text>
              </View>
              <Text style={styles.small}>
                Cant: {item.qty}{item.unit === 'kg' ? ' kg' : ''} · Pagado: {item.status.pagado.qty}{item.unit === 'kg' ? ' kg' : ''} ({formatCLP(item.status.pagado.revenue)}) · Pendiente: {item.status.pendiente.qty}{item.unit === 'kg' ? ' kg' : ''} ({formatCLP(item.status.pendiente.revenue)})
              </Text>
              <Text style={styles.small}>
                Efectivo: {item.type.efectivo.qty}{item.unit === 'kg' ? ' kg' : ''} ({formatCLP(item.type.efectivo.revenue)}) · Transferencia: {item.type.transferencia.qty}{item.unit === 'kg' ? ' kg' : ''} ({formatCLP(item.type.transferencia.revenue)})
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.small}>Sin datos en el rango</Text>}
        />
      </View>

      <View style={[styles.card, { marginBottom: 12 }]}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Reporte por departamento</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="Exportar CSV (Depto)" variant="secondary" onPress={async () => {
              try {
                const csv = buildDepartmentCSV(departmentSummary);
                const name = `resumen_deptos_${new Date().toISOString().slice(0,10)}.csv`;
                if (Platform.OS === 'web') {
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
                } else {
                  const uri = FileSystem.cacheDirectory + name;
                  await FileSystem.writeAsStringAsync(uri, csv as any, { encoding: (FileSystem as any).EncodingType?.UTF8 ?? 'utf8' } as any);
                  const available = await (Sharing as any).isAvailableAsync();
                  if (available) await (Sharing as any).shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Compartir CSV (Depto)' } as any);
                  else Alert.alert('Exportación lista', `Archivo guardado en: ${uri}`);
                }
              } catch (e: any) {
                Alert.alert('Error al exportar CSV', String(e?.message ?? e));
              }
            }} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Exportar PDF (Depto)" variant="secondary" onPress={async () => {
              try {
                const html = buildDepartmentReportHTML(departmentSummary, startDate, endDate);
                const { uri } = await (Print as any).printToFileAsync({ html });
                if (Platform.OS === 'android' || Platform.OS === 'ios') {
                  const available = await (Sharing as any).isAvailableAsync();
                  if (available) await (Sharing as any).shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartir PDF (Depto)' } as any);
                  else Alert.alert('PDF listo', `Archivo guardado en: ${uri}`);
                } else {
                  (window as any).open(uri, '_blank');
                }
              } catch (e: any) {
                Alert.alert('Error al exportar PDF', String(e?.message ?? e));
              }
            }} />
          </View>
        </View>
        <FlatList
          scrollEnabled={false}
          data={departmentSummary}
          keyExtractor={(i) => String(i.department)}
          ListHeaderComponent={() => (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontWeight: '700' }}>Departamento</Text>
              <Text style={{ fontWeight: '700' }}>Ventas / Cantidad / Ingresos</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>Depto: {item.department || '-'}</Text>
                <Text>{formatCLP(item.revenue)}</Text>
              </View>
              <Text style={styles.small}>Ventas: {item.salesCount} · Cantidad: {item.qty}</Text>
              <Text style={styles.small}>Pagado: {item.status.pagado.qty} ({formatCLP(item.status.pagado.revenue)}) · Pendiente: {item.status.pendiente.qty} ({formatCLP(item.status.pendiente.revenue)})</Text>
              <Text style={styles.small}>Efectivo: {item.type.efectivo.qty} ({formatCLP(item.type.efectivo.revenue)}) · Transferencia: {item.type.transferencia.qty} ({formatCLP(item.type.transferencia.revenue)})</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.small}>Sin datos en el rango</Text>}
        />
      </View>

      <View style={[styles.card, { marginBottom: 12 }]}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Reporte por producto</Text>
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.small}>Producto</Text>
          <View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Buscar producto"
                  value={prodFilter}
                  onChangeText={(t) => { setProdFilter(t); setProdDropdown(true); }}
                  placeholder={selectedProduct ? selectedProduct.name : 'Escribe para filtrar'}
                />
              </View>
              <View style={{ width: 140 }}>
                <Button title={selectedProduct ? 'Cambiar' : 'Seleccionar'} variant="secondary" onPress={() => setProdDropdown((v) => !v)} />
              </View>
            </View>
            {prodDropdown && (
              <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, marginTop: 8 }}>
                <FlatList
                  style={{ maxHeight: 220 }}
                  data={filteredProducts}
                  keyExtractor={(i) => i.id}
                  renderItem={({ item }) => (
                    <Text onPress={() => { setSelectedProductId(item.id); setProdDropdown(false); setProdFilter(''); }} style={{ padding: 10 }}>
                      {item.name}
                    </Text>
                  )}
                />
              </View>
            )}
          </View>
        </View>
        {selectedProduct && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={styles.small}>Total cantidad</Text>
              <Text style={styles.small}>{productTotals.qty}{selectedProduct.unit === 'kg' ? ' kg' : ''}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={styles.small}>Ingresos</Text>
              <Text style={styles.small}>{formatCLP(productTotals.revenue)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Exportar CSV (Producto)" variant="secondary" onPress={async () => {
                  try {
                    const csv = buildProductCSV(selectedProduct, productRows);
                    const name = `producto_${selectedProduct.name.replace(/[^a-z0-9_-]/gi,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
                    if (Platform.OS === 'web') {
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
                    } else {
                      const uri = FileSystem.cacheDirectory + name;
                      await FileSystem.writeAsStringAsync(uri, csv as any, { encoding: (FileSystem as any).EncodingType?.UTF8 ?? 'utf8' } as any);
                      const available = await (Sharing as any).isAvailableAsync();
                      if (available) await (Sharing as any).shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Compartir CSV de producto' } as any);
                      else Alert.alert('Exportación lista', `Archivo guardado en: ${uri}`);
                    }
                  } catch (e: any) {
                    Alert.alert('Error al exportar CSV', String(e?.message ?? e));
                  }
                }} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Exportar PDF (Producto)" variant="secondary" onPress={async () => {
                  try {
                    const html = buildProductReportHTML(selectedProduct, productRows, startDate, endDate);
                    const { uri } = await (Print as any).printToFileAsync({ html });
                    if (Platform.OS === 'android' || Platform.OS === 'ios') {
                      const available = await (Sharing as any).isAvailableAsync();
                      if (available) await (Sharing as any).shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartir PDF de producto' } as any);
                      else Alert.alert('PDF listo', `Archivo guardado en: ${uri}`);
                    } else {
                      // Web: abrir el PDF en una pestaña
                      (window as any).open(uri, '_blank');
                    }
                  } catch (e: any) {
                    Alert.alert('Error al exportar PDF', String(e?.message ?? e));
                  }
                }} />
              </View>
            </View>
            <FlatList
              scrollEnabled={false}
              data={productRows}
              keyExtractor={(_, idx) => String(idx)}
              ListHeaderComponent={() => (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontWeight: '700' }}>Fecha</Text>
                  <Text style={{ fontWeight: '700' }}>Cant/Precio/Subt</Text>
                </View>
              )}
              renderItem={({ item }) => (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.small}>{new Date(item.date).toLocaleString()} · Depto: {item.department || '-'}</Text>
                  <Text style={styles.small}>{item.quantity} x {formatCLP(item.price)} = {formatCLP(item.subtotal)}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.small}>Sin ventas de este producto en el rango</Text>}
            />
          </View>
        )}
      </View>

      <View style={[styles.card, { marginBottom: 12 }]}>
        <Text>Ingresos totales: {formatCLP(summary.revenue)}</Text>
        <Text>Cantidad total (u/kg): {summary.units}</Text>
        <View style={{ marginTop: 8 }}>
          <Button title="Exportar CSV" onPress={async () => {
            try {
              const csv = buildCSV(filteredSales, products);
              const name = `reporte_${new Date().toISOString().slice(0,10)}.csv`;
              if (Platform.OS === 'web') {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', name);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                Alert.alert('Descarga iniciada', `Se descargó ${name}`);
                return;
              }
              const uri = FileSystem.cacheDirectory + name;
              await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
              const available = await Sharing.isAvailableAsync();
              if (available) {
                await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Compartir reporte CSV' });
              } else {
                Alert.alert('Exportación lista', `Archivo guardado en: ${uri}`);
              }
            } catch (e: any) {
              Alert.alert('Error al exportar', String(e?.message ?? e));
            }
          }} />
          <View style={{ height: 8 }} />
          <Button title="Exportar PDF" onPress={async () => {
            try {
              const html = buildReportHTML(filteredSales, products, startDate, endDate);
              if (Platform.OS === 'web') {
                const w = window.open('', '_blank');
                if (w) {
                  w.document.write(html);
                  w.document.close();
                  w.focus();
                  w.print();
                } else {
                  Alert.alert('No se pudo abrir la ventana de impresión');
                }
              } else {
                const { uri } = await Print.printToFileAsync({ html });
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartir reporte PDF' });
                } else {
                  Alert.alert('PDF listo', `Archivo guardado en: ${uri}`);
                }
              }
            } catch (e: any) {
              Alert.alert('Error al exportar PDF', String(e?.message ?? e));
            }
          }} />
        </View>
      </View>

      <View style={[styles.card, { marginBottom: 12 }]}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>Ventas últimos {days} días</Text>
        <View>
          {summary.lastDays.map((d) => (
            <View key={d.date} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[styles.small, { width: 90 }]}>{d.date.slice(5)}</Text>
              <View style={{ flex: 1, height: 10, backgroundColor: '#e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                <View style={{ width: `${(d.total / summary.max) * 100}%`, height: '100%', backgroundColor: '#60a5fa' }} />
              </View>
              <Text style={[styles.small, { marginLeft: 8 }]}>{formatCLP(d.total)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { marginBottom: 12 }]}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>Ventas por cobrar</Text>
        <Text>Total pendiente: {formatCLP(pendingTotal)} • Ventas: {pendingSales.length}</Text>
        <View style={{ marginTop: 8 }}>
          <Button title="Exportar CSV (Pendientes)" onPress={async () => {
            try {
              const csv = buildCSV(pendingSales, products);
              const name = `pendientes_${new Date().toISOString().slice(0,10)}.csv`;
              if (Platform.OS === 'web') {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', name);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                Alert.alert('Descarga iniciada', `Se descargó ${name}`);
              } else {
                const uri = FileSystem.cacheDirectory + name;
                await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
                const available = await Sharing.isAvailableAsync();
                if (available) {
                  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Compartir pendientes CSV' });
                } else {
                  Alert.alert('Exportación lista', `Archivo guardado en: ${uri}`);
                }
              }
            } catch (e: any) {
              Alert.alert('Error al exportar pendientes', String(e?.message ?? e));
            }
          }} />
        </View>
        <FlatList
          style={{ marginTop: 8 }}
          scrollEnabled={false}
          data={pendingSales}
          keyExtractor={(s) => s.id}
          renderItem={({ item: s }) => (
            <View style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.small}>{new Date(s.createdAt).toLocaleString()} • Depto: {typeof s.department === 'number' ? s.department : '-'}</Text>
                <Text style={styles.small}>{formatCLP(s.total)}</Text>
              </View>
              <Text style={styles.small}>Pago: {s.paymentType}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.small}>No hay ventas pendientes en el rango</Text>}
        />
      </View>

      <View style={[styles.card, { marginBottom: 12 }]}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>Top productos</Text>
        <FlatList
          scrollEnabled={false}
          data={summary.top}
          keyExtractor={(i) => i.name}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text>{item.name}</Text>
              <Text>{item.qty}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.small}>Sin ventas aún</Text>}
        />
      </View>
    </ScrollView>
  );
}

function buildCSV(sales: Sale[], products: Product[]): string {
  const header = ['fecha', 'departamento', 'estado_pago', 'tipo_pago', 'producto', 'unidad', 'cantidad', 'precio', 'subtotal', 'total_venta'];
  const rows: string[] = [header.join(',')];
  for (const s of sales) {
    const date = new Date(s.createdAt).toISOString();
    for (const it of s.items) {
      const p = products.find((x) => x.id === it.productId);
      const name = p?.name ?? 'Desconocido';
      const subtotal = it.subtotal;
      const cols = [
        date,
        typeof s.department === 'number' ? s.department : '',
        s.paymentStatus ?? '',
        s.paymentType ?? '',
        name,
        p?.unit ?? '',
        it.quantity,
        it.price,
        subtotal,
        s.total,
      ].map((v) => csvCell(v));
      rows.push(cols.join(','));
    }
  }
  return rows.join('\n');
}

function csvCell(v: string | number): string {
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function parseYMD(s: string): Date | null {
  if (!s) return null;
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!ok) return null;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

function setQuickRange(days: number, setStart: (s: string) => void, setEnd: (s: string) => void) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  setStart(start.toISOString().slice(0, 10));
  setEnd(end.toISOString().slice(0, 10));
}

function buildReportHTML(sales: Sale[], products: Product[], start: string, end: string): string {
  const header = `
  <style>
    body{font-family: Arial, Helvetica, sans-serif; padding:16px;}
    h1{font-size:20px;margin:0 0 8px 0}
    .small{color:#666;font-size:12px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ddd;padding:6px;text-align:left}
    th{background:#f3f4f6}
    tfoot td{font-weight:bold}
  </style>`;
  const range = start || end ? `<div class="small">Rango: ${start || 'inicio'} a ${end || 'fin'}</div>` : '';
  const rows: string[] = [];
  let total = 0;
  for (const s of sales) {
    total += s.total;
    const date = new Date(s.createdAt).toLocaleString();
    for (const it of s.items) {
      const p = products.find((x) => x.id === it.productId);
      rows.push(`<tr>
        <td>${date}</td>
        <td>${typeof s.department === 'number' ? s.department : ''}</td>
        <td>${s.paymentStatus || ''}</td>
        <td>${s.paymentType || ''}</td>
        <td>${p?.name ?? 'Desconocido'}</td>
        <td>${p?.unit ?? ''}</td>
        <td>${it.quantity}</td>
        <td>${formatCLP(it.price)}</td>
        <td>${formatCLP(it.subtotal)}</td>
        <td>${formatCLP(s.total)}</td>
      </tr>`);
    }
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>${header}</head><body>
    <h1>Reporte de Ventas</h1>
    ${range}
    <table>
      <thead>
        <tr>
          <th>Fecha</th><th>Departamento</th><th>Estado pago</th><th>Tipo pago</th><th>Producto</th><th>Unidad</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th><th>Total venta</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join('')}
      </tbody>
      <tfoot>
        <tr><td colspan="9">Total</td><td>${formatCLP(total)}</td></tr>
      </tfoot>
    </table>
  </body></html>`;
  return html;
}

function buildProductPaymentCSV(rows: ReturnType<typeof buildProductPaymentSummaryShim>): string {
  const header = ['producto', 'unidad', 'cant_total', 'ingreso_total', 'pagado_cant', 'pagado_ingreso', 'pendiente_cant', 'pendiente_ingreso', 'efectivo_cant', 'efectivo_ingreso', 'transferencia_cant', 'transferencia_ingreso'];
  const lines: string[] = [header.join(',')];
  for (const r of rows) {
    const cols = [
      r.name,
      r.unit,
      r.qty,
      r.revenue,
      r.status.pagado.qty,
      r.status.pagado.revenue,
      r.status.pendiente.qty,
      r.status.pendiente.revenue,
      r.type.efectivo.qty,
      r.type.efectivo.revenue,
      r.type.transferencia.qty,
      r.type.transferencia.revenue,
    ].map((v) => csvCell(v as any));
    lines.push(cols.join(','));
  }
  return lines.join('\n');
}

// Helper para tipado de la función anterior
function buildProductPaymentSummaryShim() {
  return [] as Array<{
    productId: string;
    name: string;
    unit: string;
    qty: number;
    revenue: number;
    status: { pagado: { qty: number; revenue: number }; pendiente: { qty: number; revenue: number } };
    type: { efectivo: { qty: number; revenue: number }; transferencia: { qty: number; revenue: number } };
  }>;
}

function buildProductPaymentReportHTML(rows: ReturnType<typeof buildProductPaymentSummaryShim>, start: string, end: string): string {
  const header = `
  <style>
    body{font-family: Arial, Helvetica, sans-serif; padding:16px;}
    h1{font-size:20px;margin:0 0 8px 0}
    .small{color:#666;font-size:12px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ddd;padding:6px;text-align:left}
    th{background:#f3f4f6}
    tfoot td{font-weight:bold}
  </style>`;
  const range = start || end ? `<div class="small">Rango: ${start || 'inicio'} a ${end || 'fin'}</div>` : '';
  const body = rows.map(r => `<tr>
    <td>${r.name}</td>
    <td>${r.unit}</td>
    <td>${r.qty}</td>
    <td>${formatCLP(r.revenue)}</td>
    <td>${r.status.pagado.qty}</td>
    <td>${formatCLP(r.status.pagado.revenue)}</td>
    <td>${r.status.pendiente.qty}</td>
    <td>${formatCLP(r.status.pendiente.revenue)}</td>
    <td>${r.type.efectivo.qty}</td>
    <td>${formatCLP(r.type.efectivo.revenue)}</td>
    <td>${r.type.transferencia.qty}</td>
    <td>${formatCLP(r.type.transferencia.revenue)}</td>
  </tr>`).join('');
  // Totales generales
  const tot = rows.reduce((a, r) => {
    a.qty += r.qty; a.rev += r.revenue;
    a.pq += r.status.pagado.qty; a.pr += r.status.pagado.revenue;
    a.dq += r.status.pendiente.qty; a.dr += r.status.pendiente.revenue;
    a.eq += r.type.efectivo.qty; a.er += r.type.efectivo.revenue;
    a.tq += r.type.transferencia.qty; a.tr += r.type.transferencia.revenue;
    return a;
  }, { qty: 0, rev: 0, pq: 0, pr: 0, dq: 0, dr: 0, eq: 0, er: 0, tq: 0, tr: 0 });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>${header}</head><body>
    <h1>Resumen por producto y pago</h1>
    ${range}
    <table>
      <thead>
        <tr>
          <th>Producto</th><th>Unidad</th><th>Cant total</th><th>Ingreso total</th>
          <th>Pagado cant</th><th>Pagado ingreso</th>
          <th>Pendiente cant</th><th>Pendiente ingreso</th>
          <th>Efectivo cant</th><th>Efectivo ingreso</th>
          <th>Transferencia cant</th><th>Transferencia ingreso</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr>
          <td colspan="2">Totales</td>
          <td>${tot.qty}</td>
          <td>${formatCLP(tot.rev)}</td>
          <td>${tot.pq}</td>
          <td>${formatCLP(tot.pr)}</td>
          <td>${tot.dq}</td>
          <td>${formatCLP(tot.dr)}</td>
          <td>${tot.eq}</td>
          <td>${formatCLP(tot.er)}</td>
          <td>${tot.tq}</td>
          <td>${formatCLP(tot.tr)}</td>
        </tr>
      </tfoot>
    </table>
  </body></html>`;
  return html;
}

function buildDepartmentCSV(rows: ReturnType<typeof buildDepartmentSummaryShim>): string {
  const header = ['departamento', 'ventas', 'cant_total', 'ingreso_total', 'pagado_cant', 'pagado_ingreso', 'pendiente_cant', 'pendiente_ingreso', 'efectivo_cant', 'efectivo_ingreso', 'transferencia_cant', 'transferencia_ingreso'];
  const lines: string[] = [header.join(',')];
  for (const r of rows) {
    const cols = [
      r.department,
      r.salesCount,
      r.qty,
      r.revenue,
      r.status.pagado.qty,
      r.status.pagado.revenue,
      r.status.pendiente.qty,
      r.status.pendiente.revenue,
      r.type.efectivo.qty,
      r.type.efectivo.revenue,
      r.type.transferencia.qty,
      r.type.transferencia.revenue,
    ].map((v) => csvCell(v as any));
    lines.push(cols.join(','));
  }
  return lines.join('\n');
}

function buildDepartmentSummaryShim() {
  return [] as Array<{
    department: number;
    salesCount: number;
    qty: number;
    revenue: number;
    status: { pagado: { qty: number; revenue: number }; pendiente: { qty: number; revenue: number } };
    type: { efectivo: { qty: number; revenue: number }; transferencia: { qty: number; revenue: number } };
  }>;
}

function buildDepartmentReportHTML(rows: ReturnType<typeof buildDepartmentSummaryShim>, start: string, end: string): string {
  const header = `
  <style>
    body{font-family: Arial, Helvetica, sans-serif; padding:16px;}
    h1{font-size:20px;margin:0 0 8px 0}
    .small{color:#666;font-size:12px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ddd;padding:6px;text-align:left}
    th{background:#f3f4f6}
    tfoot td{font-weight:bold}
  </style>`;
  const range = start || end ? `<div class=\"small\">Rango: ${start || 'inicio'} a ${end || 'fin'}</div>` : '';
  const body = rows.map(r => `<tr>
    <td>${r.department || ''}</td>
    <td>${r.salesCount}</td>
    <td>${r.qty}</td>
    <td>${formatCLP(r.revenue)}</td>
    <td>${r.status.pagado.qty}</td>
    <td>${formatCLP(r.status.pagado.revenue)}</td>
    <td>${r.status.pendiente.qty}</td>
    <td>${formatCLP(r.status.pendiente.revenue)}</td>
    <td>${r.type.efectivo.qty}</td>
    <td>${formatCLP(r.type.efectivo.revenue)}</td>
    <td>${r.type.transferencia.qty}</td>
    <td>${formatCLP(r.type.transferencia.revenue)}</td>
  </tr>`).join('');
  const tot = rows.reduce((a, r) => {
    a.sc += r.salesCount; a.qty += r.qty; a.rev += r.revenue;
    a.pq += r.status.pagado.qty; a.pr += r.status.pagado.revenue;
    a.dq += r.status.pendiente.qty; a.dr += r.status.pendiente.revenue;
    a.eq += r.type.efectivo.qty; a.er += r.type.efectivo.revenue;
    a.tq += r.type.transferencia.qty; a.tr += r.type.transferencia.revenue;
    return a;
  }, { sc: 0, qty: 0, rev: 0, pq: 0, pr: 0, dq: 0, dr: 0, eq: 0, er: 0, tq: 0, tr: 0 });
  const html = `<!DOCTYPE html><html><head><meta charset=\"utf-8\"/>${header}</head><body>
    <h1>Resumen por departamento</h1>
    ${range}
    <table>
      <thead>
        <tr>
          <th>Departamento</th><th>Ventas</th><th>Cant total</th><th>Ingreso total</th>
          <th>Pagado cant</th><th>Pagado ingreso</th>
          <th>Pendiente cant</th><th>Pendiente ingreso</th>
          <th>Efectivo cant</th><th>Efectivo ingreso</th>
          <th>Transferencia cant</th><th>Transferencia ingreso</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr>
          <td>Totales</td>
          <td>${tot.sc}</td>
          <td>${tot.qty}</td>
          <td>${formatCLP(tot.rev)}</td>
          <td>${tot.pq}</td>
          <td>${formatCLP(tot.pr)}</td>
          <td>${tot.dq}</td>
          <td>${formatCLP(tot.dr)}</td>
          <td>${tot.eq}</td>
          <td>${formatCLP(tot.er)}</td>
          <td>${tot.tq}</td>
          <td>${formatCLP(tot.tr)}</td>
        </tr>
      </tfoot>
    </table>
  </body></html>`;
  return html;
}

function buildProductCSV(product: Product, rows: { date: number; quantity: number; price: number; subtotal: number; department: number; paymentStatus: string; paymentType: string }[]): string {
  const header = ['fecha', 'departamento', 'estado_pago', 'tipo_pago', 'producto', 'unidad', 'cantidad', 'precio', 'subtotal'];
  const lines: string[] = [header.join(',')];
  for (const r of rows) {
    const cols = [
      new Date(r.date).toISOString(),
      r.department || '',
      r.paymentStatus || '',
      r.paymentType || '',
      product.name,
      product.unit,
      r.quantity,
      r.price,
      r.subtotal,
    ].map((v) => csvCell(v));
    lines.push(cols.join(','));
  }
  return lines.join('\n');
}

function buildProductReportHTML(product: Product, rows: { date: number; quantity: number; price: number; subtotal: number; department: number; paymentStatus: string; paymentType: string }[], start: string, end: string): string {
  const header = `
  <style>
    body{font-family: Arial, Helvetica, sans-serif; padding:16px;}
    h1{font-size:20px;margin:0 0 8px 0}
    .small{color:#666;font-size:12px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ddd;padding:6px;text-align:left}
    th{background:#f3f4f6}
    tfoot td{font-weight:bold}
  </style>`;
  const range = start || end ? `<div class="small">Rango: ${start || 'inicio'} a ${end || 'fin'}</div>` : '';
  let total = 0, qty = 0;
  const body = rows.map(r => {
    total += r.subtotal; qty += r.quantity;
    return `<tr>
      <td>${new Date(r.date).toLocaleString()}</td>
      <td>${r.department || ''}</td>
      <td>${r.paymentStatus || ''}</td>
      <td>${r.paymentType || ''}</td>
      <td>${product.name}</td>
      <td>${product.unit}</td>
      <td>${r.quantity}</td>
      <td>${formatCLP(r.price)}</td>
      <td>${formatCLP(r.subtotal)}</td>
    </tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>${header}</head><body>
    <h1>Reporte por producto</h1>
    <div class="small">Producto: ${product.name}</div>
    ${range}
    <table>
      <thead>
        <tr>
          <th>Fecha</th><th>Departamento</th><th>Estado pago</th><th>Tipo pago</th><th>Producto</th><th>Unidad</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr><td colspan="6">Totales</td><td>${qty}</td><td></td><td>${formatCLP(total)}</td></tr>
      </tfoot>
    </table>
  </body></html>`;
  return html;
}
