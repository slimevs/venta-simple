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

export function formatNumber2(value: number): string {
  if (!isFinite(value)) return '0.00';
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2);
}
