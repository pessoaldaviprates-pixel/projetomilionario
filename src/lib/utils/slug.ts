/** Geração de slugs estáveis e legíveis (usados em URLs e chaves de tenant). */

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Garante unicidade consultando o que já existe.
 * `exists` recebe o candidato e devolve true se já estiver em uso.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
  fallback = 'item',
): Promise<string> {
  const root = slugify(base) || fallback;
  if (!(await exists(root))) return root;

  for (let suffix = 2; suffix <= 99; suffix++) {
    const candidate = `${root}-${suffix}`;
    if (!(await exists(candidate))) return candidate;
  }

  return `${root}-${Date.now().toString(36)}`;
}

/** Prefixo curto de projeto: "Novo Site Institucional" → "NSI". */
export function projectKeyFrom(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const initials = words
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join('');

  const fallback = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  return (initials || fallback || 'PRJ').slice(0, 4);
}
