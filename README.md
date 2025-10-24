# Venta Simple (Móvil)

App móvil sencilla para:

- Registrar y gestionar ventas de productos.
- Gestionar (CRUD) de productos con stock y precio.
- Ver reportes básicos: ingresos, unidades vendidas, top productos, ventas por día.

La app usa React Navigation (Bottom Tabs) para navegar entre Ventas, Productos y Reportes. Usa almacenamiento local con AsyncStorage si está disponible (con fallback en memoria si no está instalado).

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

- `App.tsx`: Configura React Navigation con tabs (Ventas, Productos, Reportes).
- `src/models`: Tipos de `Product` y `Sale`.
- `src/state`: Contextos de productos y ventas (carga/guarda en almacenamiento).
- `src/storage`: Abstracción para `AsyncStorage` con fallback.
- `src/screens`: Pantallas de Productos, Ventas y Reportes.
- `src/components/Common.tsx`: UI reutilizable (botones, inputs, estilos).
- `docs/google-sheets.md`: Guía para integrarse con Google Sheets.

## Notas de uso

- Productos: crea/edita/elimina, define precio y stock.
  - Soporta productos unitarios y por kilogramo (kg). El precio se interpreta por unidad o por kg según selección, y el stock acepta decimales si es por kg.
- Ventas: agrega productos a la venta, valida stock y guarda; el stock se descuenta automáticamente.
  - Campos adicionales: departamento y estado de pago (pagado/pendiente).
  - Sección “Ventas por cobrar”: lista ventas en estado pendiente y permite actualizar su estado a pagado/pendiente.
- Reportes: resumen de ingresos y unidades, top productos y gráfico simple por día.
  - Filtros por rango de fechas (campos Desde/Hasta y accesos rápidos 7/30 días).
  - Botón “Exportar CSV”: genera un CSV y lo comparte (o guarda en caché si no hay mecanismo de compartir disponible).
  - Botón “Exportar PDF”: genera un PDF (nativo con `expo-print` en iOS/Android; en web abre la ventana de impresión del navegador para guardar como PDF).

## Próximos pasos sugeridos

- Añadir exportación de reportes a PDF y filtros por rango de fechas.
- Añadir autenticación y sincronización remota (si se requiere multi-dispositivo).
