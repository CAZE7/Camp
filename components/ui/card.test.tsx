import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from './card';

describe('Card Component Suite', () => {
  describe('Card', () => {
    it('renders with default size and attributes', () => {
      render(<Card data-testid="card">Card Content</Card>);
      const card = screen.getByTestId('card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-slot', 'card');
      expect(card).toHaveAttribute('data-size', 'default');
      expect(card).toHaveTextContent('Card Content');
    });

    it('renders with size="sm"', () => {
      render(<Card data-testid="card" size="sm">Small Card</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('data-size', 'sm');
    });

    it('merges custom className', () => {
      render(<Card data-testid="card" className="custom-class" />);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-class');
      expect(card).toHaveClass('group/card');
    });

    it('passes standard div HTML attributes', () => {
      render(<Card data-testid="card" aria-label="Card Label" id="test-card" />);
      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('aria-label', 'Card Label');
      expect(card).toHaveAttribute('id', 'test-card');
    });
  });

  describe('CardHeader', () => {
    it('renders correctly with data-slot and custom className', () => {
      render(<CardHeader data-testid="card-header" className="header-class">Header</CardHeader>);
      const header = screen.getByTestId('card-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveAttribute('data-slot', 'card-header');
      expect(header).toHaveClass('header-class');
      expect(header).toHaveTextContent('Header');
    });
  });

  describe('CardTitle', () => {
    it('renders correctly with data-slot and custom className', () => {
      render(<CardTitle data-testid="card-title" className="title-class">Title</CardTitle>);
      const title = screen.getByTestId('card-title');
      expect(title).toBeInTheDocument();
      expect(title).toHaveAttribute('data-slot', 'card-title');
      expect(title).toHaveClass('title-class');
      expect(title).toHaveTextContent('Title');
    });
  });

  describe('CardDescription', () => {
    it('renders correctly with data-slot and custom className', () => {
      render(<CardDescription data-testid="card-desc" className="desc-class">Description</CardDescription>);
      const desc = screen.getByTestId('card-desc');
      expect(desc).toBeInTheDocument();
      expect(desc).toHaveAttribute('data-slot', 'card-description');
      expect(desc).toHaveClass('desc-class');
      expect(desc).toHaveTextContent('Description');
    });
  });

  describe('CardAction', () => {
    it('renders correctly with data-slot and custom className', () => {
      render(<CardAction data-testid="card-action" className="action-class">Action</CardAction>);
      const action = screen.getByTestId('card-action');
      expect(action).toBeInTheDocument();
      expect(action).toHaveAttribute('data-slot', 'card-action');
      expect(action).toHaveClass('action-class');
      expect(action).toHaveTextContent('Action');
    });
  });

  describe('CardContent', () => {
    it('renders correctly with data-slot and custom className', () => {
      render(<CardContent data-testid="card-content" className="content-class">Content</CardContent>);
      const content = screen.getByTestId('card-content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveAttribute('data-slot', 'card-content');
      expect(content).toHaveClass('content-class');
      expect(content).toHaveTextContent('Content');
    });
  });

  describe('CardFooter', () => {
    it('renders correctly with data-slot and custom className', () => {
      render(<CardFooter data-testid="card-footer" className="footer-class">Footer</CardFooter>);
      const footer = screen.getByTestId('card-footer');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveAttribute('data-slot', 'card-footer');
      expect(footer).toHaveClass('footer-class');
      expect(footer).toHaveTextContent('Footer');
    });
  });

  describe('Full Card Composition', () => {
    it('renders full card component structure together seamlessly', () => {
      render(
        <Card data-testid="full-card">
          <CardHeader>
            <CardTitle>Test Title</CardTitle>
            <CardDescription>Test Description</CardDescription>
            <CardAction><button>Action</button></CardAction>
          </CardHeader>
          <CardContent>Body Content</CardContent>
          <CardFooter>Footer Content</CardFooter>
        </Card>
      );

      expect(screen.getByTestId('full-card')).toBeInTheDocument();
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
      expect(screen.getByText('Body Content')).toBeInTheDocument();
      expect(screen.getByText('Footer Content')).toBeInTheDocument();
    });
  });
});
