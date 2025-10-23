import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { useSales } from '../state/SalesContext';
import { useProducts } from '../state/ProductsContext';
import { Button, Title, styles } from '../components/Common';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Sale } from '../models/Sale';
import type { Product } from '../models/Product';

type DayStat = { date: string; total: number };

export function ReportsScreen() {
  const { sales } = useSales();
  const { products } = useProducts();
  const [days] = useState(7);

  const summary = useMemo(() => {
    const revenue = sales.reduce((a, s) => a + s.total, 0);
    const units = sales.reduce((a, s) => a + s.items.reduce((b, i) => b + i.quantity, 0), 0);
    const perProduct: Record<string, number> = {};
    for (const s of sales) for (const it of s.items) perProduct[it.productId] = (perProduct[it.productId] || 0) + it.quantity;
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
    for (const s of sales) {
      const key = dayKey(new Date(s.createdAt));
      if (key in map) map[key] += s.total;
    }
    for (const d of daysArr) d.total = map[d.date] || 0;

    const max = Math.max(1, ...daysArr.map((d) => d.total));

    return { revenue, units, top, lastDays: daysArr, max };
  }, [sales, products, days]);

  return (
    <View style={styles.screen}>
      <Title>Reportes</Title>
      <View style={[styles.card, { marginBottom: 12 }]}>
        <Text>Ingresos totales: ${summary.revenue.toFixed(2)}</Text>
        <Text>Cantidad total (u/kg): {summary.units}</Text>
        <View style={{ marginTop: 8 }}>
          <Button title="Exportar CSV" onPress={async () => {
            try {
              const csv = buildCSV(sales, products);
              const name = `reporte_${new Date().toISOString().slice(0,10)}.csv`;
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
              <Text style={[styles.small, { marginLeft: 8 }]}>${d.total.toFixed(0)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { marginBottom: 12 }]}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>Top productos</Text>
        <FlatList
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
    </View>
  );
}

function buildCSV(sales: Sale[], products: Product[]): string {
  const header = ['fecha', 'departamento', 'estado_pago', 'producto', 'unidad', 'cantidad', 'precio', 'subtotal', 'total_venta'];
  const rows: string[] = [header.join(',')];
  for (const s of sales) {
    const date = new Date(s.createdAt).toISOString();
    for (const it of s.items) {
      const p = products.find((x) => x.id === it.productId);
      const name = p?.name ?? 'Desconocido';
      const subtotal = it.subtotal;
      const cols = [
        date,
        s.department ?? '',
        s.paymentStatus ?? '',
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
