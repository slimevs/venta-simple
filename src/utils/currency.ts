export function formatCLP(value: number): string {
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(value || 0));
  } catch {
    const n = Math.round(value || 0);
    return `$${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }
}

