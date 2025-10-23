# Integración con Google Sheets (Ventas, Productos y Por Cobrar)

Esta guía explica cómo enviar automáticamente ventas, cambios de productos y ventas por cobrar (pendientes/parciales) a Google Sheets usando un Google Apps Script publicado como Web App.

---

## 1) Preparar la Hoja de Cálculo

Crea una Hoja en Google Drive con estas pestañas y encabezados:

- Ventas (pestaña: `Ventas`)
  - Encabezados (fila 1, en este orden):
    - fecha, departamento, estado_pago, producto, unidad, cantidad, precio, subtotal, total_venta

- Productos (pestaña: `Productos`)
  - Encabezados (fila 1, en este orden):
    - fecha, accion, id, nombre, unidad, precio, stock, creado_en, actualizado_en

- Por cobrar (pendiente/parcial) (pestaña: `PorCobrar`)
  - Encabezados (fila 1, en este orden):
    - venta_id, fecha, departamento, estado_pago, producto, unidad, cantidad, precio, subtotal, total_venta

- Histórico (pagos conciliados) (pestaña: `Historico`)
  - Encabezados (fila 1, en este orden):
    - venta_id, pagado_en, fecha, departamento, estado_pago, producto, unidad, cantidad, precio, subtotal, total_venta

Notas:
- accion: create | update | delete
- unidad: unit | kg
- fechas: ISO (ej. 2025-10-23T12:34:56.000Z)
- números: usa punto decimal si aplicara (cantidad/precio/subtotal/total)

---

## 2) Crear el Apps Script (Web App)

1) En la Hoja, ve a Extensiones → Apps Script. Crea un nuevo proyecto y pega este código unificado:

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

    // Mover de PorCobrar a Historico cuando la venta pase a pagado
    if (data && data.dueClear === true && data.id) {
      return movePorCobrarToHistorico_(data.id);
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

function appendVentas_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Ventas') || ss.insertSheet('Ventas');
  var rows = [];
  (data.items || []).forEach(function(it) {
    rows.push([
      data.date, data.department || '', data.paymentStatus || '',
      it.name || '', it.unit || '', it.quantity || 0, it.price || 0, it.subtotal || 0,
      data.total || 0,
    ]);
  });
  if (rows.length) sh.getRange(sh.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
  return json_({ ok: true, count: rows.length });
}

function appendPorCobrar_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('PorCobrar') || ss.insertSheet('PorCobrar');
  var rows = [];
  (data.items || []).forEach(function(it) {
    rows.push([
      data.id || '',
      data.date, data.department || '', data.paymentStatus || '',
      it.name || '', it.unit || '', it.quantity || 0, it.price || 0, it.subtotal || 0,
      data.total || 0,
    ]);
  });
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
  var rng = shDue.getRange(2, 1, last - 1, 10); // columnas A:J en PorCobrar
  var vals = rng.getValues();
  var moved = 0;
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === String(id)) {
      var row = vals[i];
      // Construir fila para Historico: venta_id, pagado_en(now), luego columnas existentes
      var out = [row[0], new Date().toISOString()].concat(row.slice(1));
      shHist.appendRow(out);
      shDue.deleteRow(i + 2);
      moved++;
    }
  }
  return json_({ ok: true, moved: moved });
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

function json_(obj, status) {
  var out = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*');
  if (status) out.setHeader('Status', String(status));
  return out;
}
```

2) Guarda el proyecto.

3) Despliega como Web App: Implementar → Implementar como aplicación web.
- Ejecutar la app como: Tu usuario.
- Acceso: Cualquiera con el enlace.
- Copia la URL: la usarás en la app.

Puedes usar la misma URL para ventas, productos y por cobrar, o crear proyectos separados. La app soporta ambas opciones (una o varias URLs).

---

## 3) Configurar variables en la app

La app lee URLs públicas (sin secretos) desde variables `EXPO_PUBLIC_*` y envía POST JSON (sin CORS estricto).

- Ventas: `EXPO_PUBLIC_SHEETS_SALES_URL`
- Productos: `EXPO_PUBLIC_SHEETS_PRODUCTS_URL`
- Por cobrar (pendiente/parcial): `EXPO_PUBLIC_SHEETS_DUES_URL` (opcional; si no se define, se usa la de Ventas indicando `due: true`)

Cómo definirlas:
- Local (macOS/Linux):
  - `export EXPO_PUBLIC_SHEETS_SALES_URL="<URL>"; export EXPO_PUBLIC_SHEETS_PRODUCTS_URL="<URL>"; export EXPO_PUBLIC_SHEETS_DUES_URL="<URL>"; npm run start`
- Local (Windows PowerShell):
  - `$Env:EXPO_PUBLIC_SHEETS_SALES_URL="<URL>"; $Env:EXPO_PUBLIC_SHEETS_PRODUCTS_URL="<URL>"; $Env:EXPO_PUBLIC_SHEETS_DUES_URL="<URL>"; npm run start`
- GitHub Pages (Actions Variables):
  - GitHub → Settings → Secrets and variables → Actions → Variables → crea las variables anteriores.

En el código:
- Config: `src/config.ts`
- Servicio: `src/services/sheets.ts`
  - Ventas: `sendSaleToSheets(sale, products)`
  - Productos: `sendProductChangeToSheets({ action, product })`
  - Por cobrar: `sendDueSaleToSheets(sale, products)`
- Invocación:
  - Ventas: `src/state/SalesContext.tsx` dentro de `add` (y registra por cobrar si corresponde)
  - Productos: `src/state/ProductsContext.tsx` en `add`/`update`/`remove`
  - Por cobrar: `src/state/SalesContext.tsx` en `add` y `update` cuando `paymentStatus` es `pendiente` o `parcial`

---

## 4) Prueba rápida

- Crear/editar/borrar un producto → verifica filas en `Productos`.
- Registrar venta con pago “pagado” → filas en `Ventas`.
- Registrar venta “pendiente” o “parcial” → filas en `PorCobrar` (si tienes `EXPO_PUBLIC_SHEETS_DUES_URL` o si tu Apps Script redirige por `data.due`).
- Revisa la consola del navegador por avisos `[sheets]` si algo falla.

Ejemplo de payload (venta por cobrar):
```
{
  "due": true,
  "date": "2025-10-23T12:00:00.000Z",
  "department": 10,
  "paymentStatus": "pendiente",
  "total": 12050,
  "items": [
    { "productId": "p1", "name": "Manzana", "unit": "kg", "quantity": 2.5, "price": 2000, "subtotal": 5000 },
    { "productId": "p2", "name": "Botella", "unit": "unit", "quantity": 2, "price": 3525, "subtotal": 7050 }
  ]
}
```

---

## 5) Solución de problemas

- 403/401 Web App: revisa que el despliegue sea “Cualquiera con el enlace”.
- 404 o CORS:
  - El cliente envía `mode: 'no-cors'` y sin headers personalizados para evitar preflight; no se lee la respuesta.
  - Asegúrate de que la URL sea correcta.
- Filas duplicadas: no dispares manualmente los envíos; la app ya envía tras guardar.
- Zona horaria: las fechas se envían en ISO UTC. Ajusta formato en Sheets según tu zona.

---

## 6) Seguridad y buenas prácticas

- Variables `EXPO_PUBLIC_*` no son secretas; se incorporan al bundle.
- Para seguridad real, usa un backend (Cloud Functions/Run) con auth y acceso a Sheets con cuenta de servicio.
- Para robustez offline (reintentos): implementa una cola local y un botón “Reintentar envíos pendientes”.

---

## 7) Referencias

- Config: `src/config.ts`
- Servicio: `src/services/sheets.ts`
- Estado Ventas: `src/state/SalesContext.tsx`
- Estado Productos: `src/state/ProductsContext.tsx`
