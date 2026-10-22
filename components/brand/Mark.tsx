import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Mark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link
      href="/"
      className={cn(
        'inline-flex min-h-11 items-center px-1 no-underline focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
        className
      )}
      aria-label="Elektroplaner Startseite"
    >
      <span className={cn('wordmark', inverted ? 'text-paper' : 'text-ink')}>Elektroplaner</span>
    </Link>
  );
}
