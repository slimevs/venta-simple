# Venta Simple (Móvil)

App móvil sencilla para:

- Registrar y gestionar ventas de productos.
- Gestionar (CRUD) de productos con stock y precio.
- Ver reportes básicos: ingresos, unidades vendidas, top productos, ventas por día.

Implementación sin librerías de navegación para facilitar ejecución inicial. Usa un tab bar simple y almacenamiento local con AsyncStorage si está disponible (con fallback en memoria si no está instalado).

## Requisitos

- Node.js 18+
- Expo CLI (`npm i -g expo`)

## Instalación

1. Instala dependencias:

   npm install

   Si deseas persistencia real en dispositivos, instala también:

   npm install @react-native-async-storage/async-storage

2. Instala navegación y módulos de exportación (si no se instalaron automáticamente con el paso anterior):

   npm install @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated expo-file-system expo-sharing

   Nota: Reanimated requiere el plugin en `babel.config.js` (ya incluido).

3. Inicia el proyecto:

   npm run start

   - Android: `npm run android`
   - iOS: `npm run ios`
   - Web: `npm run web`

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
- El workflow inyecta `<base href="/<repo>/">` en `index.html` y `404.html` para que los assets se resuelvan bajo la subruta de GitHub Pages y evitar 404.

Si cambias el nombre del repositorio o publicas en un dominio personalizado sin subruta, elimina ese paso o ajusta el `href`.
- Si sirves el sitio bajo `/<repo>/`, Expo web debería funcionar con rutas relativas del export. Si ves rutas rotas, avísame para ajustar el base path del export.

## Estructura

- `App.tsx`: Configura React Navigation con tabs (Ventas, Productos, Reportes).
- `src/models`: Tipos de `Product` y `Sale`.
- `src/state`: Contextos de productos y ventas (carga/guarda en almacenamiento).
- `src/storage`: Abstracción para `AsyncStorage` con fallback.
- `src/screens`: Pantallas de Productos, Ventas y Reportes.
- `src/components/Common.tsx`: UI reutilizable (botones, inputs, estilos).

## Notas de uso

- Productos: crea/edita/elimina, define precio y stock.
  - Soporta productos unitarios y por kilogramo (kg). El precio se interpreta por unidad o por kg según selección, y el stock acepta decimales si es por kg.
- Ventas: agrega productos a la venta, valida stock y guarda; el stock se descuenta automáticamente.
  - Campos adicionales: departamento y estado de pago (pagado/pendiente/parcial).
  - Sección “Ventas por cobrar”: lista ventas en estado pendiente o parcial y permite actualizar su estado a pagado/pendiente/parcial.
- Reportes: resumen de ingresos y unidades, top productos y gráfico simple por día.
  - Botón “Exportar CSV”: genera un CSV y lo comparte (o guarda en caché si no hay mecanismo de compartir disponible).

## Próximos pasos sugeridos

- Sustituir el tab bar manual por React Navigation.
- Añadir exportación de reportes (CSV/PDF) y filtros por rango de fechas.
- Añadir autenticación y sincronización remota (si se requiere multi-dispositivo).
