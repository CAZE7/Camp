import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NavigationSidebar from './NavigationSidebar';
import { usePathname } from 'next/navigation';
import '@testing-library/jest-dom';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, className, onClick, title }: any) => {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (onClick) onClick(e);
    };
    return (
      <a href={href} className={className} onClick={handleClick} title={title}>
        {children}
      </a>
    );
  },
}));

// Mock GSAP and plugins
vi.mock('gsap', () => {
  const mockTimeline = {
    to: vi.fn(),
  };
  return {
    default: {
      registerPlugin: vi.fn(),
      ticker: { lagSmoothing: vi.fn() },
      timeline: vi.fn(() => mockTimeline),
      set: vi.fn(),
      to: vi.fn(),
    },
  };
});

vi.mock('@gsap/react', () => ({
  useGSAP: vi.fn((callback) => {
    // We can execute the callback in a safe way if needed, or just ignore
    // For simple component rendering tests, ignoring is usually fine
  }),
}));

vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));
vi.mock('gsap/MotionPathPlugin', () => ({ MotionPathPlugin: {} }));

describe('NavigationSidebar Component', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/');
  });

  describe('Rendering', () => {
    it('renders the brand logo and text', () => {
      render(<NavigationSidebar />);
      expect(screen.getByText('CampCraft')).toBeInTheDocument();
      expect(screen.getByText('VanLife Plattform')).toBeInTheDocument();
    });

    it('renders navigation links', () => {
      render(<NavigationSidebar />);
      expect(screen.getByText('Startseite')).toBeInTheDocument();
      expect(screen.getByText('Elektrik-Planer')).toBeInTheDocument();
      expect(screen.getByText('Dach-Planer')).toBeInTheDocument();
      expect(screen.getByText('Heizlast-Rechner')).toBeInTheDocument();
      expect(screen.getByText('KI-Assistent')).toBeInTheDocument();
      expect(screen.getByText('Ausbau-Guide')).toBeInTheDocument();
      expect(screen.getByText('Ausbau-Fahrplan')).toBeInTheDocument();
      expect(screen.getByText('Holzausbau')).toBeInTheDocument();
    });

    it('marks the active link based on pathname', () => {
      vi.mocked(usePathname).mockReturnValue('/elektrik-planung');
      render(<NavigationSidebar />);

      const elektrikLink = screen.getByText('Elektrik-Planer').closest('a');
      expect(elektrikLink).toHaveClass('bg-emerald-600/20');
      expect(elektrikLink).toHaveClass('text-emerald-400');

      const startseiteLink = screen.getByText('Startseite').closest('a');
      expect(startseiteLink).not.toHaveClass('bg-emerald-600/20');
    });

    it('renders in collapsed state', () => {
      render(<NavigationSidebar isCollapsed={true} />);
      // Text should not be rendered when collapsed
      expect(screen.queryByText('CampCraft')).not.toBeInTheDocument();
      expect(screen.queryByText('VanLife Plattform')).not.toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('toggles mobile menu when button is clicked', () => {
      render(<NavigationSidebar />);

      const toggleButton = screen.getByLabelText('Navigation öffnen');
      expect(toggleButton).toBeInTheDocument();

      // Initial state: menu is translated off-screen (implied by classes, but let's check basic structure)
      // The overlay shouldn't exist initially
      expect(document.querySelector('.bg-black\\/40')).not.toBeInTheDocument();

      // Click toggle
      fireEvent.click(toggleButton);

      // Overlay should now be present
      expect(document.querySelector('.bg-black\\/40')).toBeInTheDocument();

      // Click overlay to close
      fireEvent.click(document.querySelector('.bg-black\\/40')!);

      // Overlay should be gone again
      expect(document.querySelector('.bg-black\\/40')).not.toBeInTheDocument();
    });

    it('calls onToggle when desktop toggle button is clicked', () => {
      const onToggleMock = vi.fn();
      render(<NavigationSidebar onToggle={onToggleMock} />);

      const desktopToggleButton = screen.getByLabelText('Sidebar einklappen');
      fireEvent.click(desktopToggleButton);

      expect(onToggleMock).toHaveBeenCalledTimes(1);
    });

    it('closes mobile menu when a link is clicked', () => {
      render(<NavigationSidebar />);

      const toggleButton = screen.getByLabelText('Navigation öffnen');
      fireEvent.click(toggleButton);

      // Overlay present
      expect(document.querySelector('.bg-black\\/40')).toBeInTheDocument();

      // Click a link
      const link = screen.getByText('Elektrik-Planer').closest('a');
      fireEvent.click(link!);

      // Overlay should be gone
      expect(document.querySelector('.bg-black\\/40')).not.toBeInTheDocument();
    });
  });
});
