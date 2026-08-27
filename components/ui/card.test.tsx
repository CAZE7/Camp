import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from './card';

describe('Card Component Suite', () => {
  describe('Card', () => {
    it('renders correctly with default props', () => {
      render(<Card data-testid="card">Card Body</Card>);
      const card = screen.getByTestId('card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-slot', 'card');
      expect(card).toHaveAttribute('data-size', 'default');
      expect(card).toHaveTextContent('Card Body');
      expect(card).toHaveClass('group/card', 'bg-card');
    });

    it('applies custom size prop', () => {
      render(
        <Card data-testid="card-sm" size="sm">
          Small Card
        </Card>
      );
      const card = screen.getByTestId('card-sm');
      expect(card).toHaveAttribute('data-size', 'sm');
    });

    it('merges custom className properly', () => {
      render(
        <Card data-testid="card" className="custom-card-class">
          Content
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-card-class');
      expect(card).toHaveClass('bg-card');
    });
  });

  describe('CardHeader', () => {
    it('renders with data-slot and custom className', () => {
      render(
        <CardHeader data-testid="header" className="custom-header">
          Header Content
        </CardHeader>
      );
      const header = screen.getByTestId('header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveAttribute('data-slot', 'card-header');
      expect(header).toHaveClass('custom-header', 'group/card-header');
      expect(header).toHaveTextContent('Header Content');
    });
  });

  describe('CardTitle', () => {
    it('renders title element with proper styling classes and attributes', () => {
      render(
        <CardTitle data-testid="title" className="custom-title">
          Card Title
        </CardTitle>
      );
      const title = screen.getByTestId('title');
      expect(title).toBeInTheDocument();
      expect(title).toHaveAttribute('data-slot', 'card-title');
      expect(title).toHaveClass('font-heading', 'custom-title');
      expect(title).toHaveTextContent('Card Title');
    });
  });

  describe('CardDescription', () => {
    it('renders description with text-muted-foreground class', () => {
      render(
        <CardDescription data-testid="desc" className="custom-desc">
          Description text
        </CardDescription>
      );
      const desc = screen.getByTestId('desc');
      expect(desc).toBeInTheDocument();
      expect(desc).toHaveAttribute('data-slot', 'card-description');
      expect(desc).toHaveClass('text-muted-foreground', 'custom-desc');
      expect(desc).toHaveTextContent('Description text');
    });
  });

  describe('CardAction', () => {
    it('renders card action container', () => {
      render(
        <CardAction data-testid="action" className="custom-action">
          Action Button
        </CardAction>
      );
      const action = screen.getByTestId('action');
      expect(action).toBeInTheDocument();
      expect(action).toHaveAttribute('data-slot', 'card-action');
      expect(action).toHaveClass('col-start-2', 'custom-action');
      expect(action).toHaveTextContent('Action Button');
    });
  });

  describe('CardContent', () => {
    it('renders content container correctly', () => {
      render(
        <CardContent data-testid="content" className="custom-content">
          Body content
        </CardContent>
      );
      const content = screen.getByTestId('content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveAttribute('data-slot', 'card-content');
      expect(content).toHaveClass('px-4', 'custom-content');
      expect(content).toHaveTextContent('Body content');
    });
  });

  describe('CardFooter', () => {
    it('renders footer container with default styling and data-slot', () => {
      render(
        <CardFooter data-testid="footer" className="custom-footer">
          Footer Content
        </CardFooter>
      );
      const footer = screen.getByTestId('footer');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveAttribute('data-slot', 'card-footer');
      expect(footer).toHaveClass('border-t', 'bg-muted/50', 'custom-footer');
      expect(footer).toHaveTextContent('Footer Content');
    });
  });

  describe('Full Card Composition', () => {
    it('renders a full card component hierarchy without errors', () => {
      render(
        <Card data-testid="full-card">
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Subtext</CardDescription>
            <CardAction>
              <button>Action</button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p>Main details go here</p>
          </CardContent>
          <CardFooter>
            <span>Footer text</span>
          </CardFooter>
        </Card>
      );

      expect(screen.getByTestId('full-card')).toBeInTheDocument();
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Subtext')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
      expect(screen.getByText('Main details go here')).toBeInTheDocument();
      expect(screen.getByText('Footer text')).toBeInTheDocument();
    });
  });
});
