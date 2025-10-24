# Integración con Google Sheets (Ventas, Productos, PorCobrar e Histórico)

Esta guía describe cómo conectar la app con Google Sheets para escribir y leer datos de Productos y Ventas, incluyendo ventas por cobrar (pendientes) y un histórico al momento de pago.

---

## 1) Preparar la Hoja de Cálculo

Crea una Hoja en Google Drive con estas pestañas y columnas (fila 1: encabezados):

- Ventas (`Ventas`)
  - venta_id, fecha, departamento, estado_pago, tipo_pago, producto, unidad, cantidad, precio, subtotal, total_venta, product_id

- Por cobrar (`PorCobrar`)
  - venta_id, fecha, departamento, estado_pago, tipo_pago, producto, unidad, cantidad, precio, subtotal, total_venta, product_id

- Histórico (`Historico`)
  - venta_id, pagado_en, fecha, departamento, estado_pago, tipo_pago, producto, unidad, cantidad, precio, subtotal, total_venta, product_id

- Productos (`Productos`)
  - fecha, accion, id, nombre, unidad, precio, stock, creado_en, actualizado_en

Notas rápidas
- accion: create | update | delete
- unidad: unit | kg
- Fechas: ISO (ej. 2025-10-23T12:34:56.000Z) o timestamp numérico si prefieres guardar milisegundos
- Números: usa punto decimal

---

## 2) Apps Script (Web App)

En la hoja: Extensiones → Apps Script. Crea un proyecto y pega este código unificado (escritura + lectura + CORS):

```
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Ventas (payload con items)
    if (Array.isArray(data.items)) {
      if (data.due === true || (data.paymentStatus && data.paymentStatus !== 'pagado')) {
        return appendPorCobrar_(data);
      }
      return appendVentas_(data);
    }

    // Ventas por cobrar -> mover a histórico
    if (data && data.dueClear === true && data.id) {
      return movePorCobrarToHistorico_(data.id);
    }
    if (data && data.dueDelete === true && data.id) {
      return deleteFromPorCobrar_(data.id);
    }

    // Cambios de productos (payload con action/id)
    if (data && data.action && data.id) {
      return appendProducto_(data);
    }

    return json_({ ok: false, error: 'Payload no reconocido' }, 400);
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  }
}

function doGet(e) {
  try {
    var cb = (e && e.parameter && e.parameter.callback) || '';
    var t = (e && e.parameter && e.parameter.type) || '';
    if (t === 'sales') return readVentasAgrupadas_(cb);
    if (t === 'products') return readProductosCambios_(cb);
    return json_({ ok: true }, 200, cb);
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  }
}

// ========== Escritura ==========

function appendVentas_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Ventas') || ss.insertSheet('Ventas');
  // Encabezados: venta_id | fecha | departamento | estado_pago | tipo_pago | producto | unidad | cantidad | precio | subtotal | total_venta | product_id
  var rows = [];
  (data.items || []).forEach(function(it) {
    rows.push([
      data.id || '',
      data.date,
      data.department || '',
      data.paymentStatus || '',
      data.paymentType || '',
      it.name || '',
      it.unit || '',
      it.quantity || 0,
      it.price || 0,
      it.subtotal || 0,
      data.total || 0,
      it.productId || ''
    ]);
  });
  if (rows.length) sh.getRange(sh.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
  return json_({ ok: true, count: rows.length });
}

function appendPorCobrar_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('PorCobrar') || ss.insertSheet('PorCobrar');
  // Construir las filas nuevas para este venta_id
  var rows = [];
  (data.items || []).forEach(function(it) {
    rows.push([
      data.id || '',
      data.date, data.department || '', data.paymentStatus || '', data.paymentType || '',
      it.name || '', it.unit || '', it.quantity || 0, it.price || 0, it.subtotal || 0,
      data.total || 0,
      it.productId || ''
    ]);
  });
  // Buscar filas existentes con el mismo venta_id y eliminarlas (evita duplicados)
  var last = sh.getLastRow();
  if (last >= 2) {
    var rng = sh.getRange(2, 1, last - 1, 11); // A:K
    var vals = rng.getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      if (String(vals[i][0]) === String(data.id || '')) {
        sh.deleteRow(i + 2);
      }
    }
  }
  // Insertar las filas nuevas al final
  if (rows.length) sh.getRange(sh.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
  return json_({ ok: true, count: rows.length });
}

function movePorCobrarToHistorico_(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shDue = ss.getSheetByName('PorCobrar') || ss.insertSheet('PorCobrar');
  var shHist = ss.getSheetByName('Historico') || ss.insertSheet('Historico');
  if (!id) return json_({ ok: false, error: 'id requerido' }, 400);
  var last = shDue.getLastRow();
  if (last < 2) return json_({ ok: true, moved: 0 });
  var rng = shDue.getRange(2, 1, last - 1, 12); // columnas A:L (incluye tipo_pago y product_id)
  var vals = rng.getValues();
  var moved = 0;
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === String(id)) {
      var row = vals[i];
      // Historico: venta_id, pagado_en(now), luego columnas existentes
      var out = [row[0], new Date().toISOString()].concat(row.slice(1));
      shHist.appendRow(out);
      shDue.deleteRow(i + 2);
      moved++;
    }
  }
  return json_({ ok: true, moved: moved });
}

function deleteFromPorCobrar_(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shDue = ss.getSheetByName('PorCobrar') || ss.insertSheet('PorCobrar');
  if (!id) return json_({ ok: false, error: 'id requerido' }, 400);
  var last = shDue.getLastRow();
  if (last < 2) return json_({ ok: true, deleted: 0 });
  var rng = shDue.getRange(2, 1, last - 1, 11); // columnas A:K (incluye tipo_pago)
  var vals = rng.getValues();
  var deleted = 0;
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === String(id)) {
      shDue.deleteRow(i + 2);
      deleted++;
    }
  }
  return json_({ ok: true, deleted: deleted });
}

function appendProducto_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Productos') || ss.insertSheet('Productos');
  var row = [
    data.date || new Date().toISOString(), data.action,
    data.id, data.name, data.unit, data.price, data.stock,
    data.createdAt || '', data.updatedAt || ''
  ];
  sh.getRange(sh.getLastRow()+1, 1, 1, row.length).setValues([row]);
  return json_({ ok: true });
}

// ========== Lectura ==========

function readVentasAgrupadas_(cb) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var map = {};

  // Ventas (pagadas)
  var shSales = ss.getSheetByName('Ventas');
  if (shSales) {
    var lastSales = shSales.getLastRow();
    if (lastSales >= 2) {
      var data = shSales.getRange(2, 1, lastSales - 1, 12).getValues();
      var COL = { venta_id: 0, fecha: 1, departamento: 2, estado_pago: 3, tipo_pago: 4, producto: 5, unidad: 6, cantidad: 7, precio: 8, subtotal: 9, total_venta: 10, product_id: 11 };
      data.forEach(function(r){
        var id = String(r[COL.venta_id] || '');
        if (!id) return;
        if (!map[id]) {
          map[id] = {
            id: id,
            date: r[COL.fecha] || new Date().toISOString(),
            department: r[COL.departamento] || 0,
            paymentStatus: String(r[COL.estado_pago] || 'pagado'),
            paymentType: String(r[COL.tipo_pago] || 'efectivo'),
            total: Number(r[COL.total_venta] || 0),
            items: []
          };
        }
        map[id].items.push({
          productId: String(r[COL.product_id] || ''),
          quantity: Number(r[COL.cantidad] || 0),
          price: Number(r[COL.precio] || 0),
          subtotal: Number(r[COL.subtotal] || 0),
          name: String(r[COL.producto] || ''),
          unit: String(r[COL.unidad] || '')
        });
      });
    }
  }

  // PorCobrar (pendientes)
  var shDue = ss.getSheetByName('PorCobrar');
  if (shDue) {
    var lastDue = shDue.getLastRow();
    if (lastDue >= 2) {
      var dataD = shDue.getRange(2, 1, lastDue - 1, 12).getValues();
      var C = { venta_id: 0, fecha: 1, departamento: 2, estado_pago: 3, tipo_pago: 4, producto: 5, unidad: 6, cantidad: 7, precio: 8, subtotal: 9, total_venta: 10, product_id: 11 };
      dataD.forEach(function(r){
        var id = String(r[C.venta_id] || '');
        if (!id) return;
        if (map[id]) return; // si ya existe (por ejemplo, en Ventas), no duplicar
        map[id] = {
          id: id,
          date: r[C.fecha] || new Date().toISOString(),
          department: r[C.departamento] || 0,
          paymentStatus: String(r[C.estado_pago] || 'pendiente'),
          paymentType: String(r[C.tipo_pago] || 'efectivo'),
          total: Number(r[C.total_venta] || 0),
          items: []
        };
      });
      // agregar items para cada venta pendiente
      dataD.forEach(function(r){
        var id = String(r[C.venta_id] || '');
        if (!id || !map[id]) return;
        map[id].items.push({
          productId: String(r[C.product_id] || ''),
          quantity: Number(r[C.cantidad] || 0),
          price: Number(r[C.precio] || 0),
          subtotal: Number(r[C.subtotal] || 0),
          name: String(r[C.producto] || ''),
          unit: String(r[C.unidad] || '')
        });
      });
    }
  }

  var items = Object.keys(map).map(function(k){ return map[k]; });
  return json_({ items: items }, 200, cb);
}

function readProductosCambios_(cb) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Productos');
  if (!sh) return json_({ items: [] });
  var last = sh.getLastRow();
  if (last < 2) return json_({ items: [] });
  var data = sh.getRange(2, 1, last - 1, 9).getValues();
  var items = data.map(function(r){
    return {
      date: r[0], action: String(r[1] || '').toLowerCase(),
      id: String(r[2] || ''), name: String(r[3] || ''), unit: r[4] || 'unit',
      price: Number(r[5] || 0), stock: Number(r[6] || 0),
      createdAt: r[7] ? Number(r[7]) : null,
      updatedAt: r[8] ? Number(r[8]) : null
    };
  });
  return json_({ items: items }, 200, cb);
}

// ========== Utilidad ==========

function json_(obj, status, cb) {
  // Soporta JSONP si se provee ?callback=nombre
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(obj) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## 3) Configurar variables en la app

Variables EXPO públicas (se embeben en el bundle; no pongas secretos aquí):

- Escritura (POST)
  - EXPO_PUBLIC_SHEETS_SALES_URL
  - EXPO_PUBLIC_SHEETS_PRODUCTS_URL
  - EXPO_PUBLIC_SHEETS_DUES_URL (opcional; si no se define, la app usa la de ventas con `due: true`)

- Lectura (GET)
  - EXPO_PUBLIC_SHEETS_PRODUCTS_GET_URL (ej. `.../exec?type=products`)
  - EXPO_PUBLIC_SHEETS_SALES_GET_URL (ej. `.../exec?type=sales`)

Definirlas
- Local macOS/Linux: exporta variables y corre `npm run start`
- Local Windows (PowerShell): `$Env:NOMBRE_VAR="valor"; npm run start`
- GitHub Pages (Actions → Variables): crea las variables anteriores y redeploya

---

## 4) Flujo en la App

- Escritura (POST)
  - La app envía con `mode: 'no-cors'` y sin headers personalizados (evita preflight). No lee la respuesta en web.
  - Ventas:
    - Pagadas → `Ventas`
    - Pendiente → `PorCobrar`
    - Cambio a pagado → envía `dueClear` para mover de `PorCobrar` a `Historico`
  - Productos: create/update/delete → `Productos`

- Lectura (GET)
  - Productos al iniciar (si hay URL): lee cambios y reconstruye el estado actual.
  - Ventas al iniciar (si hay URL): lee ventas agrupadas con sus items.
  - Botones de sincronización manual:
    - Productos: “Sincronizar ahora” (en la pestaña Productos)
    - Ventas: “Sincronizar ventas” (en Reportes)

---

## 5) Prueba rápida

1) Guarda productos y ventas desde la app; verifica filas en las pestañas correspondientes.
2) Abre en el navegador los endpoints GET:
   - `...?type=products` y `...?type=sales` deben devolver JSON y CORS.
3) Define las variables GET en la app; recarga la versión web y verifica que se cargan datos remotos al iniciar o al presionar “Sincronizar”.

---

## 6) Solución de problemas

- 403/401: Publica el Web App como “Cualquiera con el enlace”.
- CORS en GET: usa `json_` con `Access-Control-Allow-Origin: '*'` (incluido arriba).
- CSV/PDF: la app exporta CSV/PDF localmente; no afecta Sheets.
- Duplicados: la app evita enviar dos veces la misma transición (ej. de pendiente→pagado se registra en Ventas y se limpia PorCobrar).

---

## 7) Seguridad

- `EXPO_PUBLIC_*` no son secretos; se embeben en el bundle web.
- Para seguridad real, usa un backend propio (Cloud Functions/Run) con autenticación y acceso a Sheets con cuenta de servicio, y cambia la app para hablar con tu backend.

---

## 8) Referencias en el código

- Config: `src/config.ts`
- Servicios Sheets: `src/services/sheets.ts`
- Estado Productos: `src/state/ProductsContext.tsx`
- Estado Ventas: `src/state/SalesContext.tsx`
- UI sincronización: `src/screens/ProductsScreen.tsx`, `src/screens/ReportsScreen.tsx`
