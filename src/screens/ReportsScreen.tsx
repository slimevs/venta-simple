import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Text, View, Platform } from 'react-native';
import { useSales } from '../state/SalesContext';
import { useProducts } from '../state/ProductsContext';
import { Button, Title, styles, Field } from '../components/Common';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import type { Sale } from '../models/Sale';
import type { Product } from '../models/Product';

type DayStat = { date: string; total: number };

export function ReportsScreen() {
  const { sales } = useSales();
  const { products } = useProducts();
  const [days] = useState(7);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredSales = useMemo(() => {
    const start = parseYMD(startDate);
    const end = parseYMD(endDate);
    const endMs = end ? end.getTime() + 24 * 60 * 60 * 1000 - 1 : undefined;
    return sales.filter((s) => {
      const t = s.createdAt;
      if (start && t < start.getTime()) return false;
      if (endMs && t > endMs) return false;
      return true;
    });
  }, [sales, startDate, endDate]);

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

  return (
    <View style={styles.screen}>
      <Title>Reportes</Title>
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
        <Text>Ingresos totales: ${summary.revenue.toFixed(2)}</Text>
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
        <td>${s.department || ''}</td>
        <td>${s.paymentStatus || ''}</td>
        <td>${p?.name ?? 'Desconocido'}</td>
        <td>${p?.unit ?? ''}</td>
        <td>${it.quantity}</td>
        <td>${it.price}</td>
        <td>${it.subtotal}</td>
        <td>${s.total}</td>
      </tr>`);
    }
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>${header}</head><body>
    <h1>Reporte de Ventas</h1>
    ${range}
    <table>
      <thead>
        <tr>
          <th>Fecha</th><th>Departamento</th><th>Estado pago</th><th>Producto</th><th>Unidad</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th><th>Total venta</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join('')}
      </tbody>
      <tfoot>
        <tr><td colspan="8">Total</td><td>${total.toFixed(2)}</td></tr>
      </tfoot>
    </table>
  </body></html>`;
  return html;
}
