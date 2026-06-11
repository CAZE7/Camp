import { render, screen, fireEvent } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import NavigationSidebar from './NavigationSidebar';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));

const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;

describe('NavigationSidebar Component', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  describe('Rendering', () => {
    it('renders the sidebar', () => {
      render(<NavigationSidebar />);
      expect(screen.getByText('CampCraft')).toBeInTheDocument();
    });

    it('renders all navigation links', () => {
      render(<NavigationSidebar />);
      expect(screen.getByText('Startseite')).toBeInTheDocument();
      expect(screen.getByText('Elektrik-Planer')).toBeInTheDocument();
      expect(screen.getByText('Dach-Planer')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('highlights the active link', () => {
      mockUsePathname.mockReturnValue('/tools/elektrik-planer');
      render(<NavigationSidebar />);

      const elektrikLink = screen.getByText('Elektrik-Planer').closest('a');
      expect(elektrikLink).toHaveClass('bg-emerald-100');
      expect(elektrikLink).toHaveClass('text-emerald-800');

      const startseiteLink = screen.getByText('Startseite').closest('a');
      expect(startseiteLink).not.toHaveClass('bg-emerald-100');
    });
  });

  describe('Interaction', () => {
    it('renders as a desktop-first sidebar without mobile overlay controls', () => {
      render(<NavigationSidebar />);

      expect(screen.queryByLabelText('Navigation öffnen')).not.toBeInTheDocument();
      expect(document.querySelector('.bg-black\/40')).not.toBeInTheDocument();
    });

    it('calls onToggle when toggle button is clicked', () => {
      const onToggleMock = vi.fn();
      render(<NavigationSidebar onToggle={onToggleMock} />);

      const toggleButton = screen.getByLabelText('Sidebar einklappen');
      fireEvent.click(toggleButton);

      expect(onToggleMock).toHaveBeenCalledTimes(1);
    });

    it('keeps links clickable in desktop mode', () => {
      render(<NavigationSidebar />);

      const link = screen.getByText('Elektrik-Planer').closest('a');
      expect(link).toBeInTheDocument();
      fireEvent.click(link!);

      expect(document.querySelector('.bg-black\/40')).not.toBeInTheDocument();
    });
  });
});
