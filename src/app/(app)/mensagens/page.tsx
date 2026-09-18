import { MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/misc';

export const metadata: Metadata = { title: 'Mensagens' };

export default function MessagesIndexPage() {
  return (
    <div className="hidden h-full items-center justify-center md:flex">
      <EmptyState
        icon={<MessageSquare className="size-5" />}
        title="Selecione uma conversa"
        description="Escolha um canal ou uma conversa direta à esquerda para começar."
      />
    </div>
  );
}
