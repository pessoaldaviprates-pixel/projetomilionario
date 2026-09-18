import { z } from 'zod';
import { created, ok, route } from '@/lib/http/api';
import { handleError } from '@/lib/http/api';
import { getAuthContext } from '@/lib/auth/context';
import { UnauthorizedError, ValidationError } from '@/lib/http/errors';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { listFiles, uploadFile } from '@/server/services/files.service';
import { NextResponse, type NextRequest } from 'next/server';
import type { FileCategory } from '@/generated/prisma/enums';

const querySchema = z.object({
  categoria: z.string().optional(),
  projeto: z.string().optional(),
  q: z.string().optional(),
  minhas: z.string().optional(),
});

export const GET = route({ query: querySchema }, async ({ auth, query }) => {
  return ok(
    await listFiles(auth, {
      category: query.categoria as FileCategory | undefined,
      projectId: query.projeto,
      search: query.q,
      onlyMine: query.minhas === '1',
    }),
  );
});

/**
 * Upload multipart.
 *
 * Não usa o wrapper `route` porque o corpo é FormData, não JSON — a validação
 * do arquivo (tipo, tamanho, extensão) acontece na camada de storage.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new UnauthorizedError();

    await enforceRateLimit('upload', auth.membershipId);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) throw new ValidationError('Nenhum arquivo enviado.');

    const buffer = Buffer.from(await file.arrayBuffer());
    const projectId = formData.get('projectId');
    const taskId = formData.get('taskId');

    const stored = await uploadFile(auth, {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      data: buffer,
      projectId: typeof projectId === 'string' && projectId ? projectId : null,
      taskId: typeof taskId === 'string' && taskId ? taskId : null,
    });

    return NextResponse.json({ data: stored }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
