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
