import { NextResponse, type NextRequest } from 'next/server';
import { handleError, noContent, route } from '@/lib/http/api';
import { getAuthContext } from '@/lib/auth/context';
import { UnauthorizedError } from '@/lib/http/errors';
import { deleteFile, getFileForDownload } from '@/server/services/files.service';

/**
 * Download autenticado.
 *
 * O binário nunca é servido de um caminho público: a rota revalida sessão,
 * tenant, visibilidade e permissão a cada requisição, e força download em
 * vez de renderização inline — um arquivo enviado por terceiros não executa
 * no contexto da nossa origem.
 */
export async function GET(
  _request: NextRequest,
  segment: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new UnauthorizedError();

    const { id } = await segment.params;
    const file = await getFileForDownload(auth, id);

    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        'content-type': file.mimeType,
        'content-length': String(file.data.byteLength),
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export const DELETE = route({}, async ({ auth, params }) => {
  await deleteFile(auth, params.id!);
  return noContent();
});
