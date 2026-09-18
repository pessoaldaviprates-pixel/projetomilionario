import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarClock, MapPin, Users, Video } from 'lucide-react';
import { requireAuth } from '@/lib/auth/context';
import { listMeetings } from '@/server/services/meetings.service';
import { listMemberOptions } from '@/server/services/members.service';
import { listProjects } from '@/server/services/projects.service';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AvatarStack } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/misc';
import { formatDateTime, formatTime, pluralize } from '@/lib/utils/format';
import { MeetingCreateButton } from './meeting-create-button';

export const metadata: Metadata = { title: 'Reuniões' };

const STATUS_META = {
  SCHEDULED: { label: 'Agendada', tone: 'brand' as const },
  LIVE: { label: 'Ao vivo', tone: 'success' as const },
  ENDED: { label: 'Encerrada', tone: 'neutral' as const },
  CANCELED: { label: 'Cancelada', tone: 'danger' as const },
};

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ nova?: string }>;
}) {
  const ctx = await requireAuth();
  const params = await searchParams;

  const [meetings, members, projects] = await Promise.all([
    listMeetings(ctx),
    listMemberOptions(ctx),
    listProjects(ctx),
  ]);

  const now = new Date();
  const upcoming = meetings.filter((meeting) => meeting.endsAt >= now && meeting.status !== 'CANCELED');
  const past = meetings
    .filter((meeting) => meeting.endsAt < now || meeting.status === 'CANCELED')
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

  return (
    <>
      <PageHeader
        title="Reuniões"
        description="Agende, participe e transforme o que foi decidido em tarefas."
        actions={
          ctx.can('meetings.create') ? (
            <MeetingCreateButton
              members={members.map((member) => ({
                id: member.id,
                name: member.user.name,
                avatarUrl: member.user.avatarUrl,
              }))}
              projects={projects.map((project) => ({ id: project.id, name: project.name }))}
              openInitially={params.nova === '1'}
            />
          ) : null
        }
      />

      <PageBody className="space-y-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">Próximas ({upcoming.length})</h2>

          {upcoming.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Video className="size-5" />}
                title="Nenhuma reunião agendada"
                description="Agende uma reunião e ela aparece automaticamente na agenda de todos os participantes."
              />
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">Anteriores</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {past.slice(0, 9).map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          </section>
        ) : null}
      </PageBody>
    </>
  );
}

type MeetingSummary = Awaited<ReturnType<typeof listMeetings>>[number];

function MeetingCard({ meeting }: { meeting: MeetingSummary }) {
  const status = STATUS_META[meeting.status];

  return (
    <Link href={`/reunioes/${meeting.id}`}>
      <Card className="h-full p-4 transition-colors hover:border-brand/40">
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-ink">{meeting.title}</h3>
          <Badge tone={status.tone} dot={meeting.status === 'LIVE'}>{status.label}</Badge>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <CalendarClock className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
          {formatDateTime(meeting.startsAt)} — {formatTime(meeting.endsAt)}
        </p>

        {meeting.location ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {meeting.location}
          </p>
        ) : null}

        {meeting.project ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: meeting.project.color }} aria-hidden />
            {meeting.project.name}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          <AvatarStack
            people={meeting.participants.map((participant) => ({
              id: participant.membership.id,
              name: participant.membership.user.name,
              avatarUrl: participant.membership.user.avatarUrl,
            }))}
            max={4}
            size="xs"
          />
          <span className="flex items-center gap-1 text-xs text-ink-faint">
            <Users className="size-3" aria-hidden />
            {pluralize(meeting._count.participants, 'participante', 'participantes')}
          </span>
        </div>

        {meeting._count.actionItems > 0 ? (
          <p className="mt-2 text-xs text-accent">
            {pluralize(meeting._count.actionItems, 'item de ação', 'itens de ação')}
          </p>
        ) : null}
      </Card>
    </Link>
  );
}
