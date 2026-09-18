import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, CalendarClock, FileText, MapPin, Users, Video,
} from 'lucide-react';
import { requireAuth } from '@/lib/auth/context';
import { getMeeting } from '@/server/services/meetings.service';
import { listMemberOptions } from '@/server/services/members.service';
import { hasEntitlement } from '@/lib/billing/subscription';
import { NotFoundError } from '@/lib/http/errors';
import { PageBody } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { formatDateTime, formatTime } from '@/lib/utils/format';
import { MeetingIntelligence } from './meeting-intelligence';
import { MeetingRsvp } from './meeting-rsvp';

export const metadata: Metadata = { title: 'Reunião' };

const STATUS_META = {
  SCHEDULED: { label: 'Agendada', tone: 'brand' as const },
  LIVE: { label: 'Ao vivo', tone: 'success' as const },
  ENDED: { label: 'Encerrada', tone: 'neutral' as const },
  CANCELED: { label: 'Cancelada', tone: 'danger' as const },
};

const RESPONSE_META = {
  ACCEPTED: { label: 'Confirmado', tone: 'success' as const },
  DECLINED: { label: 'Recusou', tone: 'danger' as const },
  TENTATIVE: { label: 'Talvez', tone: 'warning' as const },
  PENDING: { label: 'Aguardando', tone: 'neutral' as const },
};

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;

  let meeting;
  try {
    meeting = await getMeeting(ctx, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [members, aiEnabled] = await Promise.all([
    listMemberOptions(ctx),
    hasEntitlement(ctx.companyId, 'ai.meeting_summary'),
  ]);

  const status = STATUS_META[meeting.status];
  const myParticipation = meeting.participants.find(
    (participant) => participant.membership.id === ctx.membershipId,
  );
  const canManage = ctx.can('meetings.manage') || meeting.organizerId === ctx.membershipId;

  const summary = meeting.notes.find((note) => note.kind === 'SUMMARY');
  const decisions = meeting.notes.find((note) => note.kind === 'DECISIONS');
  const transcript = meeting.notes.find((note) => note.kind === 'TRANSCRIPT');
  const minutes = meeting.notes.find((note) => note.kind === 'MINUTES');

  return (
    <>
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <Link
          href="/reunioes"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-ink-subtle transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Voltar para reuniões
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={status.tone} dot={meeting.status === 'LIVE'}>{status.label}</Badge>
              {meeting.project ? (
                <Link href={`/projetos/${meeting.project.id}`}>
                  <Badge>
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: meeting.project.color }} aria-hidden />
                    {meeting.project.name}
                  </Badge>
                </Link>
              ) : null}
              {meeting.recurrenceRule ? <Badge tone="accent">Recorrente</Badge> : null}
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-balance text-ink">{meeting.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-4 text-ink-faint" aria-hidden />
                {formatDateTime(meeting.startsAt)} — {formatTime(meeting.endsAt)}
              </span>
              {meeting.location ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-ink-faint" aria-hidden />
                  {meeting.location}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <Users className="size-4 text-ink-faint" aria-hidden />
                {meeting.participants.length} participantes
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            {meeting.roomUrl && meeting.status !== 'ENDED' ? (
              <a
                href={meeting.roomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
              >
                <Video className="size-4" aria-hidden /> Entrar na sala
              </a>
            ) : null}

            {myParticipation && meeting.status === 'SCHEDULED' ? (
              <MeetingRsvp meetingId={meeting.id} current={myParticipation.response} />
            ) : null}
          </div>
        </div>
      </div>

      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            {meeting.description || meeting.agenda ? (
              <Card>
                <CardHeader>
                  <CardTitle>Pauta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {meeting.description ? (
                    <p className="text-sm whitespace-pre-wrap text-ink-muted">{meeting.description}</p>
                  ) : null}
                  {meeting.agenda ? (
                    <p className="text-sm whitespace-pre-wrap text-ink-muted">{meeting.agenda}</p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <MeetingIntelligence
              meetingId={meeting.id}
              canManage={canManage}
              aiEnabled={aiEnabled}
              summary={summary?.content ?? null}
              decisions={decisions?.content ? decisions.content.split('\n').filter(Boolean) : []}
              minutes={minutes?.content ?? null}
              hasTranscript={Boolean(transcript)}
              actionItems={meeting.actionItems.map((item) => ({
                id: item.id,
                title: item.title,
                assigneeHint: item.assigneeHint,
                dueHint: item.dueHint,
                dueAt: item.dueAt ? item.dueAt.toISOString() : null,
                confidence: item.confidence,
                status: item.status,
                task: item.task,
              }))}
              members={members.map((member) => ({ id: member.id, name: member.user.name }))}
            />
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Participantes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2.5 border-b border-line pb-3">
                  <Avatar
                    name={meeting.organizer.user.name}
                    src={meeting.organizer.user.avatarUrl}
                    id={meeting.organizer.id}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{meeting.organizer.user.name}</p>
                    <p className="text-xs text-ink-faint">Organizador</p>
                  </div>
                </div>

                {meeting.participants
                  .filter((participant) => participant.membership.id !== meeting.organizerId)
                  .map((participant) => {
                    const response = RESPONSE_META[participant.response];
                    return (
                      <div key={participant.membership.id} className="flex items-center gap-2.5">
                        <Avatar
                          name={participant.membership.user.name}
                          src={participant.membership.user.avatarUrl}
                          id={participant.membership.id}
                          size="xs"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                          {participant.membership.user.name}
                        </span>
                        <Badge tone={response.tone}>{response.label}</Badge>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>

            {meeting.files.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="size-4" aria-hidden /> Arquivos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {meeting.files.map((file) => (
                    <a key={file.id} href={`/api/arquivos/${file.id}`} className="block truncate text-sm text-ink-muted hover:text-ink">
                      {file.name}
                    </a>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </PageBody>
    </>
  );
}
