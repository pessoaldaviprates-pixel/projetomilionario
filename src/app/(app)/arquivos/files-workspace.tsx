'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  File as FileIcon, FileArchive, FileSpreadsheet, FileText, Image as ImageIcon,
  Music, Presentation, Search, Trash2, Upload, Video,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, Progress } from '@/components/ui/misc';
import { formatBytes } from '@/lib/storage/format';
import { formatRelative } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface FileDto {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  createdAt: string;
  ownerName: string;
  ownerId: string;
  projectName: string | null;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  AUDIO: Music,
  PDF: FileText,
  DOCUMENT: FileText,
  SPREADSHEET: FileSpreadsheet,
  PRESENTATION: Presentation,
  ARCHIVE: FileArchive,
  OTHER: FileIcon,
};

const CATEGORY_LABELS: Record<string, string> = {
  IMAGE: 'Imagens',
  VIDEO: 'Vídeos',
  AUDIO: 'Áudios',
  PDF: 'PDFs',
  DOCUMENT: 'Documentos',
  SPREADSHEET: 'Planilhas',
  PRESENTATION: 'Apresentações',
  ARCHIVE: 'Compactados',
  OTHER: 'Outros',
};

export function FilesWorkspace({
  initialFiles,
  usage,
  storageLimitGb,
  projects,
  canUpload,
  canDelete,
  currentMembershipId,
}: {
  initialFiles: FileDto[];
  usage: { totalBytes: number; totalFiles: number; byCategory: { category: string; bytes: number; count: number }[] };
  storageLimitGb: number;
  projects: { id: string; name: string }[];
  canUpload: boolean;
  canDelete: boolean;
  currentMembershipId: string;
}) {
  const [files, setFiles] = useState(initialFiles);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return files.filter((file) => {
      if (category && file.category !== category) return false;
      if (term && !file.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [files, search, category]);

  const limitBytes = storageLimitGb * 1024 * 1024 * 1024;
  const usedPercent = limitBytes === 0 ? 0 : Math.min(100, (usage.totalBytes / limitBytes) * 100);

  async function upload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    let succeeded = 0;

    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/arquivos', { method: 'POST', body: formData });
        const json = await response.json();

        if (!response.ok) {
          toast.error(`${file.name}: ${json.error?.message ?? 'falha no envio'}`);
          continue;
        }

        setFiles((current) => [
          {
            id: json.data.id,
            name: json.data.name,
            mimeType: json.data.mimeType,
            sizeBytes: json.data.sizeBytes,
            category: json.data.category,
            createdAt: json.data.createdAt,
            ownerName: 'Você',
            ownerId: currentMembershipId,
            projectName: null,
          },
          ...current,
        ]);
        succeeded++;
      } catch {
        toast.error(`${file.name}: erro inesperado no envio.`);
      }
    }

    setUploading(false);
    if (succeeded > 0) {
      toast.success(`${succeeded} arquivo(s) enviado(s).`);
      router.refresh();
    }
  }

  async function remove(fileId: string, name: string) {
    const previous = files;
    setFiles((current) => current.filter((file) => file.id !== fileId));

    try {
      const response = await fetch(`/api/arquivos/${fileId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('falha');
      toast.success(`"${name}" excluído.`);
      router.refresh();
    } catch {
      setFiles(previous);
      toast.error('Não foi possível excluir o arquivo.');
    }
  }

  return (
    <>
      <PageHeader
        title="Arquivos"
        description="Seus documentos, sempre organizados e ligados ao contexto certo."
        actions={
          canUpload ? (
            <>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  upload(event.target.files);
                  event.target.value = '';
                }}
              />
              <Button size="sm" onClick={() => inputRef.current?.click()} loading={uploading}>
                <Upload className="size-4" aria-hidden /> Enviar arquivo
              </Button>
            </>
          ) : null
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar arquivo…"
              aria-label="Buscar arquivo"
              className="h-9 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-faint focus:border-brand/60 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            <FilterChip label="Todos" active={category === ''} onClick={() => setCategory('')} />
            {usage.byCategory.map((entry) => (
              <FilterChip
                key={entry.category}
                label={`${CATEGORY_LABELS[entry.category] ?? entry.category} (${entry.count})`}
                active={category === entry.category}
                onClick={() => setCategory(entry.category)}
              />
            ))}
          </div>
        </div>
      </PageHeader>

      <PageBody className="space-y-5">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-muted">
              {formatBytes(usage.totalBytes)} de {storageLimitGb} GB usados
            </span>
            <span className="text-ink-faint">{usage.totalFiles} arquivos</span>
          </div>
          <Progress
            value={usedPercent}
            tone={usedPercent > 90 ? 'danger' : usedPercent > 70 ? 'warning' : 'brand'}
            className="mt-2"
            label="Uso do armazenamento"
          />
        </Card>

        {canUpload ? (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              upload(event.dataTransfer.files);
            }}
            className={cn(
              'rounded-card border border-dashed p-6 text-center transition-colors',
              dragOver ? 'border-brand bg-brand/[0.06]' : 'border-line',
            )}
          >
            <Upload className="mx-auto mb-2 size-5 text-ink-faint" aria-hidden />
            <p className="text-sm text-ink-muted">
              Arraste arquivos para cá ou{' '}
              <button type="button" onClick={() => inputRef.current?.click()} className="text-brand hover:underline">
                escolha do computador
              </button>
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Documentos, imagens, planilhas, PDFs, áudio e vídeo. Arquivos executáveis são bloqueados.
            </p>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileIcon className="size-5" />}
              title="Nenhum arquivo encontrado"
              description={search || category ? 'Ajuste os filtros para ver mais resultados.' : 'Envie o primeiro arquivo da empresa.'}
            />
          </Card>
        ) : (
          <Card className="p-0">
            <div className="relative w-full overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[520px]">
              <caption className="sr-only">Arquivos da empresa</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-ink-faint">Nome</th>
                  <th scope="col" className="hidden px-4 py-2.5 text-xs font-medium text-ink-faint sm:table-cell">Tamanho</th>
                  <th scope="col" className="hidden px-4 py-2.5 text-xs font-medium text-ink-faint lg:table-cell">Enviado por</th>
                  <th scope="col" className="hidden px-4 py-2.5 text-xs font-medium text-ink-faint md:table-cell">Modificado</th>
                  <th scope="col" className="w-10 px-4 py-2.5"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((file) => {
                  const Icon = CATEGORY_ICONS[file.category] ?? FileIcon;
                  const canRemove = canDelete || file.ownerId === currentMembershipId;

                  return (
                    <tr key={file.id} className="transition-colors hover:bg-surface-overlay">
                      <td className="px-4 py-2.5">
                        <a href={`/api/arquivos/${file.id}`} className="flex min-w-0 items-center gap-2.5">
                          <Icon className="size-4 shrink-0 text-ink-faint" aria-hidden />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-ink">{file.name}</span>
                            {file.projectName ? (
                              <span className="block truncate text-xs text-ink-faint">{file.projectName}</span>
                            ) : null}
                          </span>
                        </a>
                      </td>
                      <td className="hidden px-4 py-2.5 text-xs whitespace-nowrap text-ink-subtle sm:table-cell">
                        {formatBytes(file.sizeBytes)}
                      </td>
                      <td className="hidden px-4 py-2.5 text-xs whitespace-nowrap text-ink-subtle lg:table-cell">
                        {file.ownerName}
                      </td>
                      <td className="hidden px-4 py-2.5 text-xs whitespace-nowrap text-ink-subtle md:table-cell">
                        {formatRelative(file.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        {canRemove ? (
                          <button
                            type="button"
                            onClick={() => remove(file.id, file.name)}
                            aria-label={`Excluir ${file.name}`}
                            className="rounded p-1.5 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </Card>
        )}
      </PageBody>
    </>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-surface-overlay text-ink' : 'text-ink-subtle hover:bg-surface-overlay hover:text-ink',
      )}
    >
      {label}
    </button>
  );
}
