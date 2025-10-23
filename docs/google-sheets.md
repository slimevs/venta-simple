# Integración con Google Sheets (Ventas y Productos)

Esta guía explica, paso a paso, cómo enviar automáticamente ventas y cambios de productos a una Hoja de Cálculo de Google usando Google Apps Script como endpoint HTTP (Web App).

---

## 1) Preparar la Hoja de Cálculo

Crea una Hoja en Google Drive con, al menos, dos pestañas:

- Ventas (pestaña: `Ventas`)
  - Cabeceras (fila 1, en este orden):
    - fecha, departamento, estado_pago, producto, unidad, cantidad, precio, subtotal, total_venta

- Productos (pestaña: `Productos`)
  - Cabeceras (fila 1, en este orden):
    - fecha, accion, id, nombre, unidad, precio, stock, creado_en, actualizado_en

Notas sobre los campos:
- accion: create | update | delete
- unidad: unit | kg
- fechas: ISO (ej. 2025-10-23T12:34:56.000Z)
- precio/stock/cantidad/subtotal/total_venta: numéricos (punto decimal)

---

## 2) Crear el Apps Script (Web App)

1) En la hoja, ve a Extensiones → Apps Script. Crea un proyecto y pega este código que acepta tanto ventas como cambios de productos en el mismo endpoint:

```
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    // ¿Es una venta? (tiene 'items')
    if (Array.isArray(data.items)) {
      return appendVentas_(data);
    }
    // ¿Es un cambio de producto? (tiene 'action' y 'id')
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

3) Despliega como Web App: Botón “Implementar” → “Implementar como aplicación web”.
- Descripción: lo que prefieras.
- ¿Ejecutar la app como?: Tú (tu cuenta).
- ¿Quién tiene acceso?: “Cualquiera con el enlace”.
- Da clic en “Implementar” y copia la URL (la usarás en la app).

Puedes usar este mismo Web App para ventas y productos, o crear dos proyectos separados. La app soporta ambas opciones (2 URLs o 1 URL compartida).

---

## 3) Configurar variables en la app

La app lee URLs públicas (sin secretos) desde variables `EXPO_PUBLIC_*` y envía POST JSON.

- Ventas: `EXPO_PUBLIC_SHEETS_SALES_URL`
- Productos: `EXPO_PUBLIC_SHEETS_PRODUCTS_URL`

Cómo definirlas:
- Local (desarrollo):
  - macOS/Linux: `export EXPO_PUBLIC_SHEETS_SALES_URL="<URL>"; export EXPO_PUBLIC_SHEETS_PRODUCTS_URL="<URL>"; npm run start`
  - Windows (PowerShell): `$Env:EXPO_PUBLIC_SHEETS_SALES_URL="<URL>"; $Env:EXPO_PUBLIC_SHEETS_PRODUCTS_URL="<URL>"; npm run start`
- GitHub Pages (Actions Variables):
  - GitHub → Settings → Secrets and variables → Actions → Variables → New variable
  - Nombre: `EXPO_PUBLIC_SHEETS_SALES_URL` (y opcionalmente `EXPO_PUBLIC_SHEETS_PRODUCTS_URL`)
  - Valor: pega la URL del Web App

En el código:
- Ventas: `src/services/sheets.ts` → `sendSaleToSheets`
- Productos: `src/services/sheets.ts` → `sendProductChangeToSheets`

La app envía en segundo plano; si la red falla, no bloquea el guardado local.

---

## 4) Prueba rápida

- Crea/edita/borra un producto; verifica que aparezca una fila en la pestaña `Productos`.
- Registra una venta; verifica filas en `Ventas` (una por ítem de la venta).
- Revisa la consola del navegador (F12 → Console) por si aparece `[sheets]` con advertencias.

Ejemplo de payload (venta):
```
{
  "date": "2025-10-23T12:00:00.000Z",
  "department": "Almacén A",
  "paymentStatus": "pendiente",
  "total": 120.5,
  "items": [
    { "productId": "p1", "name": "Manzana", "unit": "kg", "quantity": 2.5, "price": 20.1, "subtotal": 50.25 },
    { "productId": "p2", "name": "Botella", "unit": "unit", "quantity": 2, "price": 35.125, "subtotal": 70.25 }
  ]
}
```

Ejemplo de payload (producto):
```
{
  "date": "2025-10-23T12:00:00.000Z",
  "action": "update",
  "id": "p1",
  "name": "Manzana",
  "unit": "kg",
  "price": 20.1,
  "stock": 12.5,
  "createdAt": 1698050000000,
  "updatedAt": 1761200000000
}
```

---

## 5) Solución de problemas

- 403/401 al llamar el Web App:
  - Revisa que el despliegue esté como “Cualquiera con el enlace”.
  - Si usas un Web App corporativo, valida políticas de acceso.
- 404 o CORS:
  - Asegúrate de copiar la URL correcta.
  - El Apps Script del ejemplo ya devuelve `Access-Control-Allow-Origin: *`.
- Filas duplicadas:
  - Evita enviar manualmente el mismo payload; la app envía automáticamente tras cada guardado/cambio.
- Zonas horarias:
  - Las fechas son ISO en UTC; usa fórmulas o formato en Sheets para visualizar en tu zona.

---

## 6) Seguridad y buenas prácticas

- `EXPO_PUBLIC_*` no son secretos; cualquier persona que pueda cargar la app puede leerlos en el bundle.
- Para escenarios con control de acceso, crea un backend propio (Cloud Functions/Cloud Run) que:
  - Valide autenticación/roles.
  - Escriba en Sheets con credenciales de servicio.
  - Oculte la URL verdadera de la Hoja.
- Si necesitas robustez offline (reintentos, cola), se puede implementar una cola local (IndexedDB/AsyncStorage) y un botón “Reintentar envíos pendientes”.

---

## 7) Referencias en el código

- Config: `src/config.ts`
- Servicio: `src/services/sheets.ts`
  - Ventas: `sendSaleToSheets(sale, products)`
  - Productos: `sendProductChangeToSheets({ action, product })`
- Dónde se invoca:
  - Ventas: `src/state/SalesContext.tsx` al final de `add`
  - Productos: `src/state/ProductsContext.tsx` en `add`/`update`/`remove`
