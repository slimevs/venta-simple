# Venta Simple (Móvil)

App móvil sencilla para:

- Registrar y gestionar ventas de productos.
- Gestionar (CRUD) de productos con stock y precio.
- Ver reportes básicos: ingresos, unidades vendidas, top productos, ventas por día.

La app usa React Navigation (Bottom Tabs) para navegar entre `Ventas`, `Por Cobrar`, `Productos` y `Reportes`.

Persistencia de datos: la aplicación usa **Google Sheets** como mecanismo principal de lectura/escritura (integración por defecto). La persistencia local con `AsyncStorage` no está habilitada por defecto; si deseas usarla, instala opcionalmente `@react-native-async-storage/async-storage` y crea una abstracción en `src/storage` para integrarla.

## Requisitos

- Node.js 18+
- Expo CLI (`npm i -g expo`)

## Instalación

1. Instala dependencias:

   npm install

   Si deseas persistencia real en dispositivos, instala también:

   npm install @react-native-async-storage/async-storage

2. Inicia el proyecto:

   npm run start

   - Android: `npm run android`
   - iOS: `npm run ios`
   - Web: `npm run web`

## Configuracion local (Sheets)

Para usar una sheet distinta cuando ejecutas local:

1. Crea un archivo `.env.local` (no se versiona) con tus URLs locales:

```
EXPO_PUBLIC_SHEETS_SALES_URL=...
EXPO_PUBLIC_SHEETS_PRODUCTS_URL=...
EXPO_PUBLIC_SHEETS_DUES_URL=...
EXPO_PUBLIC_SHEETS_PRODUCTS_GET_URL=...
EXPO_PUBLIC_SHEETS_SALES_GET_URL=...
```

2. Expo CLI carga `.env.local` automaticamente al ejecutar `npm run start` o `npm run web`.

Tambien se incluye `.env.example` como plantilla.

### Scripts de conveniencia para Google Sheets

- macOS/Linux:
  - `npm run start:sheets:unix`
  - `npm run web:sheets:unix`
  - `npm run export:web:sheets`
- Windows (PowerShell):
  - `npm run start:sheets:win`
  - `npm run web:sheets:win`
  - `npm run export:web:sheets:win`

Antes de usarlos (solo si no quieres usar los que ya traen la URL), reemplaza los placeholders en `package.json` o define las variables de entorno necesarias. En CI (GitHub Pages), las variables ya se inyectan vía Actions Variables (`EXPO_PUBLIC_SHEETS_SALES_URL`, `EXPO_PUBLIC_SHEETS_PRODUCTS_URL`).

## Despliegue en GitHub Pages (Web)

Con el workflow incluido (`.github/workflows/deploy-pages.yml`), cada push a `main` construye la app web y la publica en GitHub Pages.

Pasos:

1) Crea el repo en GitHub y sube el código (`main` por defecto).
2) En GitHub, ve a Settings → Pages y elige:
   - Source: "GitHub Actions".
3) Haz un push a `main` o ejecuta el workflow manualmente (Actions → Deploy Web to GitHub Pages → Run workflow).
4) La URL de Pages aparece en el job de "Deploy" (algo como `https://<usuario>.github.io/<repo>/`).

Base href configurable:
- El workflow inserta `<base href>` para que los assets se sirvan correctamente.
- Puedes controlar el valor con una variable de Actions llamada `BASE_HREF` (Settings → Secrets and variables → Actions → Variables):
  - Dominio propio (sin subruta): `BASE_HREF=/`
  - GitHub Pages bajo subruta (por defecto): `BASE_HREF=/<repo>/`
  - Si no defines `BASE_HREF`, el workflow usa `/<repo>/` automáticamente.

Notas:

- El export web usa `expo export --platform web` y genera en `dist/`.
- Se copia `index.html` a `404.html` para permitir SPA fallback en Pages.
- El workflow inyecta `<base href="/<repo>/">` en `index.html` y `404.html` y reescribe referencias absolutas para evitar 404.

## Estructura

 - `App.tsx`: Configura React Navigation con tabs (Ventas, Por Cobrar, Productos, Reportes).
 - `src/models`: Tipos de `Product` y `Sale`.
 - `src/state`: Contextos de productos y ventas (carga/guarda — actualmente sincronizados con Google Sheets).
 - `src/services`: Integraciones externas (por ejemplo, Google Sheets).
 - `src/screens`: Pantallas de `Ventas`, `Por Cobrar`, `Productos` y `Reportes`.
 - `src/components/Common.tsx`: UI reutilizable (botones, inputs, estilos).

 - `docs/google-sheets.md`: Guía para integrarse con Google Sheets.

## Pantalla "Por Cobrar"

Se agregó una pantalla dedicada a gestionar las ventas pendientes (deudas):

- Resumen del total por cobrar y número de deudas.
- Filtros por departamento y tipo de pago (efectivo/transferencia).
- Ordenamiento por fecha o monto.
- Acciones por deuda: marcar como cobrada (elige metodo de pago), ver detalle (modal) y eliminar (restaurando stock).

La nueva pantalla está en `src/screens/DuesScreen.tsx` y aparece como la pestaña "Por Cobrar" en la navegación.

## Notas de uso

- Productos: crea/edita/elimina, define precio y stock.
  - Soporta productos unitarios y por kilogramo (kg). El precio se interpreta por unidad o por kg según selección, y el stock acepta decimales si es por kg.
- Ventas: agrega productos a la venta, valida stock y guarda; el stock se descuenta automáticamente.
  - Campos adicionales: departamento y estado de pago (pagado/pendiente).
  - Sección “Ventas por cobrar”: lista ventas en estado pendiente y permite actualizar su estado a pagado/pendiente con método de pago.
  - Cantidad en ventas: si el producto es por kg, permite decimales (ej. 1.25).
- Reportes: resumen de ingresos y unidades, top productos y gráfico simple por día.
  - Filtros por rango de fechas (campos Desde/Hasta y accesos rápidos 7/30 días).
  - Botón “Exportar CSV”: genera un CSV y lo comparte (o guarda en caché si no hay mecanismo de compartir disponible).
  - Botón “Exportar PDF”: genera un PDF (nativo con `expo-print` en iOS/Android; en web abre la ventana de impresión del navegador para guardar como PDF).

## Próximos pasos sugeridos

- Añadir exportación de reportes a PDF y filtros por rango de fechas.
- Añadir autenticación y sincronización remota (si se requiere multi-dispositivo).

## Mejoras de rendimiento (scroll en móvil)

Se aplicaron optimizaciones para mejorar la fluidez del scroll en móviles:

- Aumentado `scrollEventThrottle` a `32` en ScrollView principales para reducir la frecuencia de eventos.
- Habilitado `removeClippedSubviews` en `ScrollView` y `FlatList` donde aplica para evitar renderizar vistas fuera de pantalla.
- Añadidos parámetros de virtualización en `FlatList`: `initialNumToRender`, `maxToRenderPerBatch` y `updateCellsBatchingPeriod`.
- Memoización de componentes y callbacks (`React.memo`, `useCallback`) para evitar re-renders innecesarios.

Estos cambios mejoran la experiencia en pantallas con listas largas (Por Cobrar, Productos, Reportes).

Changelog:

- 2026-01-05: Añadida la pantalla `Por Cobrar` y optimizaciones de scroll y renderizado en listas (aumentado `scrollEventThrottle`, virtualización de `FlatList`, memoización de items y callbacks).

## Cómo probar los cambios (móvil)

1. Instala dependencias:

```bash
npm install
```

2. Inicia Expo y abre en dispositivo móvil (con Expo Go) o emulador:

```bash
npm start
# o
npm run android
# o
npm run ios
```

3. Navega a la pestaña "Por Cobrar" y prueba desplazamiento en listas con muchos items; verifica que el desplazamiento sea más fluido.

Si quieres, puedo ajustar los valores de `initialNumToRender`/`maxToRenderPerBatch` según la cantidad real de datos que manejes.
