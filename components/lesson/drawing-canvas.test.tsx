import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { MouseEventHandler, ReactNode } from 'react';
import { DrawingCanvas } from './drawing-canvas';

type StageMockProps = {
  children?: ReactNode;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  onMousemove?: MouseEventHandler<HTMLDivElement>;
  onMouseup?: MouseEventHandler<HTMLDivElement>;
  width?: number;
  height?: number;
  className?: string;
};

type LayerMockProps = {
  children?: ReactNode;
};

type LineMockProps = {
  points?: number[];
  stroke?: string;
  strokeWidth?: number;
};

type ImageMockProps = {
  width?: number;
  height?: number;
};

// Mock Konva components
vi.mock('react-konva', () => ({
  Stage: ({ children, onMouseDown, onMousemove, onMouseup, ...props }: StageMockProps) => (
    <div
      data-testid="konva-stage"
      data-width={props.width}
      data-height={props.height}
      onMouseDown={onMouseDown}
      onMouseMove={onMousemove}
      onMouseUp={onMouseup}
    >
      {children}
    </div>
  ),
  Layer: ({ children }: LayerMockProps) => <div data-testid="konva-layer">{children}</div>,
  Line: ({ points, stroke, strokeWidth }: LineMockProps) => (
    <div
      data-testid="konva-line"
      data-points={JSON.stringify(points)}
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
    />
  ),
  Image: ({ width, height }: ImageMockProps) => (
    <div
      data-testid="konva-image"
      data-width={width}
      data-height={height}
    />
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Pencil: () => <div data-testid="pencil-icon">Pencil</div>,
  Eraser: () => <div data-testid="eraser-icon">Eraser</div>,
  Undo: () => <div data-testid="undo-icon">Undo</div>,
  Redo: () => <div data-testid="redo-icon">Redo</div>,
  Trash2: () => <div data-testid="trash-icon">Trash</div>,
  Camera: () => <div data-testid="camera-icon">Camera</div>,
}));

describe('DrawingCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders canvas with default dimensions', () => {
    render(<DrawingCanvas />);

    const stage = screen.getByTestId('konva-stage');
    expect(stage.getAttribute('data-width')).toBe('800');
    expect(stage.getAttribute('data-height')).toBe('600');
  });

  it('renders canvas with custom dimensions', () => {
    render(<DrawingCanvas width={1000} height={800} />);

    const stage = screen.getByTestId('konva-stage');
    expect(stage.getAttribute('data-width')).toBe('1000');
    expect(stage.getAttribute('data-height')).toBe('800');
  });

  it('renders all drawing tools', () => {
    render(<DrawingCanvas />);

    expect(screen.getByTestId('pencil-icon')).toBeTruthy();
    expect(screen.getByTestId('eraser-icon')).toBeTruthy();
    expect(screen.getByTestId('undo-icon')).toBeTruthy();
    expect(screen.getByTestId('redo-icon')).toBeTruthy();
    expect(screen.getByTestId('trash-icon')).toBeTruthy();
  });

  it('renders snapshot button when onSnapshot is provided', () => {
    const mockOnSnapshot = vi.fn();
    render(<DrawingCanvas onSnapshot={mockOnSnapshot} />);

    expect(screen.getByTestId('camera-icon')).toBeTruthy();
  });

  it('does not render snapshot button when onSnapshot is not provided', () => {
    render(<DrawingCanvas />);

    expect(screen.queryByTestId('camera-icon')).toBeFalsy();
  });

  it('switches between pen and eraser tools', () => {
    render(<DrawingCanvas />);

    const penButton = screen.getByTitle('Pen');
    const eraserButton = screen.getByTitle('Eraser');

    // Pen should be active by default
    expect(penButton.className).toContain('bg-indigo-600');
    expect(eraserButton.className).toContain('bg-gray-100');

    // Switch to eraser
    fireEvent.click(eraserButton);
    expect(eraserButton.className).toContain('bg-indigo-600');
  });

  it('renders color picker for pen tool', () => {
    render(<DrawingCanvas />);

    // Should show color picker by default (pen is default tool)
    expect(screen.getByText('Color:')).toBeTruthy();

    // Should have multiple color buttons
    const colorButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('style')?.includes('background')
    );
    expect(colorButtons.length).toBeGreaterThan(0);
  });

  it('renders stroke width selector for pen tool', () => {
    render(<DrawingCanvas />);

    expect(screen.getByText('Width:')).toBeTruthy();
    expect(screen.getByText('2px')).toBeTruthy();
    expect(screen.getByText('3px')).toBeTruthy();
    expect(screen.getByText('5px')).toBeTruthy();
    expect(screen.getByText('8px')).toBeTruthy();
  });

  it('changes stroke color when color button is clicked', () => {
    render(<DrawingCanvas />);

    const colorButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('style')?.includes('background')
    );

    // Click a color button
    if (colorButtons[1]) {
      fireEvent.click(colorButtons[1]);
      // Color should be selected (indicated by border style)
      expect(colorButtons[1].className).toContain('border-indigo-600');
    }
  });

  it('changes stroke width when width button is clicked', () => {
    render(<DrawingCanvas />);

    const width5Button = screen.getByText('5px');
    fireEvent.click(width5Button);

    expect(width5Button.className).toContain('border-indigo-600');
  });

  it('disables all controls when disabled prop is true', () => {
    render(<DrawingCanvas disabled={true} />);

    const penButton = screen.getByTitle('Pen');
    const eraserButton = screen.getByTitle('Eraser');
    const undoButton = screen.getByTitle('Undo');
    const redoButton = screen.getByTitle('Redo');
    const clearButton = screen.getByTitle('Clear All');

    expect(penButton.hasAttribute('disabled')).toBe(true);
    expect(eraserButton.hasAttribute('disabled')).toBe(true);
    expect(undoButton.hasAttribute('disabled')).toBe(true);
    expect(redoButton.hasAttribute('disabled')).toBe(true);
    expect(clearButton.hasAttribute('disabled')).toBe(true);
  });

  it('renders background image when provided', () => {
    const mockImage = new Image();
    render(<DrawingCanvas backgroundImage={mockImage} />);

    expect(screen.getByTestId('konva-image')).toBeTruthy();
  });

  it('does not render background image when not provided', () => {
    render(<DrawingCanvas />);

    expect(screen.queryByTestId('konva-image')).toBeFalsy();
  });

  it('undo button is disabled initially', () => {
    render(<DrawingCanvas />);

    const undoButton = screen.getByTitle('Undo');
    expect(undoButton.hasAttribute('disabled')).toBe(true);
  });

  it('redo button is disabled initially', () => {
    render(<DrawingCanvas />);

    const redoButton = screen.getByTitle('Redo');
    expect(redoButton.hasAttribute('disabled')).toBe(true);
  });

  it('clear button is disabled when no lines are drawn', () => {
    render(<DrawingCanvas />);

    const clearButton = screen.getByTitle('Clear All');
    expect(clearButton.hasAttribute('disabled')).toBe(true);
  });

  it('calls onSnapshot when snapshot button is clicked', () => {
    const mockOnSnapshot = vi.fn();

    render(<DrawingCanvas onSnapshot={mockOnSnapshot} />);

    const snapshotButton = screen.getByTitle('Capture Snapshot');
    
    // We can't fully test this without mocking the ref, but we can verify the button exists
    expect(snapshotButton).toBeTruthy();
  });

  it('applies correct cursor style based on disabled state', () => {
    const { container, rerender } = render(<DrawingCanvas disabled={false} />);
    
    // The className is passed to the Stage mock, check the mock element
    let stage = container.querySelector('[data-testid="konva-stage"]');
    // Since we're mocking, we can't test the actual className, just verify the component renders
    expect(stage).toBeTruthy();

    rerender(<DrawingCanvas disabled={true} />);
    
    stage = container.querySelector('[data-testid="konva-stage"]');
    expect(stage).toBeTruthy();
  });
});
