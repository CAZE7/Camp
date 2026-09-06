import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Mark({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn('inline-flex items-center no-underline', className)}
      aria-label="WERFT Startseite"
    >
      <span
        className={cn(
          'text-[1.05rem] font-semibold tracking-tight',
          inverted ? 'text-paper' : 'text-ink'
        )}
      >
        Werft
      </span>
    </Link>
  );
}
