// Configuración pública (queda embebida en el bundle). No pongas secretos aquí.
export const SHEETS_SALES_URL = process.env.EXPO_PUBLIC_SHEETS_SALES_URL || '';
export const SHEETS_PRODUCTS_URL = process.env.EXPO_PUBLIC_SHEETS_PRODUCTS_URL || '';
export const SHEETS_DUES_URL = process.env.EXPO_PUBLIC_SHEETS_DUES_URL || '';
// Endpoints de lectura (GET) opcionales para sincronizar desde Google Sheets
export const SHEETS_PRODUCTS_GET_URL = process.env.EXPO_PUBLIC_SHEETS_PRODUCTS_GET_URL || '';
export const SHEETS_SALES_GET_URL = process.env.EXPO_PUBLIC_SHEETS_SALES_GET_URL || '';
