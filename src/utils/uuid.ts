export function uuid(): string {
  // Sencillo generador UUID v4-like
  // No garantiza unicidad criptográfica, pero suficiente para app local
  const rnd = (n = 16) => Math.floor(Math.random() * n);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = rnd();
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

