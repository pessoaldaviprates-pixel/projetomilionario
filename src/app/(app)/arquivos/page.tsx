import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/context';
import { getStorageUsage, listFiles } from '@/server/services/files.service';
import { listProjects } from '@/server/services/projects.service';
import { getCompanyEntitlements } from '@/lib/billing/subscription';
import { FilesWorkspace } from './files-workspace';

export const metadata: Metadata = { title: 'Arquivos' };

export default async function FilesPage() {
  const ctx = await requireAuth();

  const [files, usage, projects, plan] = await Promise.all([
    listFiles(ctx),
    getStorageUsage(ctx),
    listProjects(ctx),
    getCompanyEntitlements(ctx.companyId),
  ]);

  return (
    <FilesWorkspace
      initialFiles={files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        category: file.category,
        createdAt: file.createdAt.toISOString(),
        ownerName: file.owner.user.name,
        ownerId: file.owner.id,
        projectName: file.project?.name ?? null,
      }))}
      usage={usage}
      storageLimitGb={plan.storageGb}
      projects={projects.map((project) => ({ id: project.id, name: project.name }))}
      canUpload={ctx.can('files.upload')}
      canDelete={ctx.can('files.delete')}
      currentMembershipId={ctx.membershipId}
    />
  );
}
