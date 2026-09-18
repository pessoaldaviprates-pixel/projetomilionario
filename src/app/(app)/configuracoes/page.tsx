import Link from 'next/link';
import type { Metadata } from 'next';
import { Building2, Shield, Sparkles, User, Wallet } from 'lucide-react';
import { requireAuth } from '@/lib/auth/context';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CompanyForm } from './company-form';

export const metadata: Metadata = { title: 'Configurações' };

export default async function SettingsPage() {
  const ctx = await requireAuth();

  const shortcuts = [
    { href: '/configuracoes/perfil', label: 'Meu perfil', description: 'Nome, e-mail e preferências', icon: User, show: true },
    { href: '/admin/cargos', label: 'Cargos e permissões', description: 'Quem pode fazer o quê', icon: Shield, show: ctx.can('roles.view') },
    { href: '/admin/assinatura', label: 'Assinatura', description: 'Plano, faturas e limites', icon: Wallet, show: ctx.can('billing.view') },
    { href: '/admin/seguranca', label: 'Segurança e logs', description: 'Auditoria e sessões', icon: Shield, show: ctx.can('audit.view') },
  ].filter((item) => item.show);

  return (
    <>
      <PageHeader title="Configurações" description="Dados da empresa e preferências do sistema." />

      <PageBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((shortcut) => (
            <Link key={shortcut.href} href={shortcut.href}>
              <Card className="h-full p-4 transition-colors hover:border-brand/40">
                <shortcut.icon className="mb-3 size-4 text-brand" aria-hidden />
                <p className="text-sm font-medium text-ink">{shortcut.label}</p>
                <p className="mt-1 text-xs text-ink-subtle">{shortcut.description}</p>
              </Card>
            </Link>
          ))}
        </div>

        {ctx.can('company.manage') ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4" aria-hidden /> Dados da empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CompanyForm
                defaults={{
                  name: ctx.company.name,
                }}
              />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" aria-hidden /> Inteligência artificial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-ink-muted">
            <p>
              A Nexora analisa mensagens e transcrições para sugerir tarefas, prazos e responsáveis.
              As sugestões são sempre propostas — nada é criado sem confirmação de uma pessoa.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">Respeita as permissões do usuário</Badge>
              <Badge tone="brand">Nenhuma escrita automática</Badge>
              <Badge tone="brand">Origem das respostas sempre citada</Badge>
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
