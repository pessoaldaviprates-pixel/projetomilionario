import { cn } from '@/lib/utils/cn';
import { colorFromId, initials } from '@/lib/utils/format';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<Size, string> = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
};

const PRESENCE_TONES = {
  ONLINE: 'bg-success',
  AWAY: 'bg-warning',
  BUSY: 'bg-danger',
  OFFLINE: 'bg-ink-faint',
} as const;

const PRESENCE_LABELS = {
  ONLINE: 'Disponível',
  AWAY: 'Ausente',
  BUSY: 'Ocupado',
  OFFLINE: 'Offline',
} as const;

export interface AvatarProps {
  name: string;
  src?: string | null;
  id?: string;
  size?: Size;
  presence?: keyof typeof PRESENCE_TONES | null;
  className?: string;
}

export function Avatar({ name, src, id, size = 'md', presence, className }: AvatarProps) {
  const seed = id ?? name;

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className={cn('rounded-full border border-line object-cover', SIZES[size])}
        />
      ) : (
        <span
          role="img"
          aria-label={name}
          className={cn(
            'inline-flex items-center justify-center rounded-full font-semibold text-white',
            SIZES[size],
          )}
          style={{ backgroundColor: colorFromId(seed) }}
        >
          {initials(name)}
        </span>
      )}
      {presence ? (
        <span
          title={PRESENCE_LABELS[presence]}
          className={cn(
            'absolute right-0 bottom-0 rounded-full border-2 border-surface-raised',
            size === 'xs' || size === 'sm' ? 'size-2.5' : 'size-3',
            PRESENCE_TONES[presence],
          )}
        >
          <span className="sr-only">{PRESENCE_LABELS[presence]}</span>
        </span>
      ) : null}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = 'sm',
}: {
  people: { id?: string; name: string; avatarUrl?: string | null }[];
  max?: number;
  size?: Size;
}) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((person, index) => (
        <span key={person.id ?? `${person.name}-${index}`} className="ring-2 ring-surface-raised rounded-full">
          <Avatar name={person.name} src={person.avatarUrl} id={person.id} size={size} />
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-surface-overlay font-medium text-ink-subtle ring-2 ring-surface-raised',
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
