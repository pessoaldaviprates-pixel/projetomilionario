/**
 * Formatação de tamanho de arquivo — isomórfica.
 * Vive fora de `storage/index.ts` porque aquele módulo é server-only
 * (acessa disco e segredos) e a interface precisa exibir tamanhos.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
