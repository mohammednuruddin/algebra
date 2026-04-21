import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CanvasContainer } from './canvas-container';

type DrawingCanvasMockProps = {
  onSnapshot?: (dataUrl: string) => void;
  disabled?: boolean;
  backgroundImage?: HTMLImageElement | null;
};

vi.mock('./drawing-canvas', () => ({
  DrawingCanvas: ({ onSnapshot, disabled, backgroundImage }: DrawingCanvasMockProps) => (
    <div data-testid="drawing-canvas" data-disabled={disabled}>
      <button
        onClick={() => onSnapshot?.('data:image/png;base64,mock')}
        data-testid="mock-snapshot-button"
      >
        Capture
      </button>
      {backgroundImage && <div data-testid="has-background">Has Background</div>}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Image: () => <div data-testid="image-icon">Image</div>,
  Upload: () => <div data-testid="upload-icon">Upload</div>,
  X: () => <div data-testid="x-icon">X</div>,
}));

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';

  constructor() {
    setTimeout(() => {
      this.onload?.();
    }, 0);
  }
}

global.Image = MockImage as unknown as typeof Image;

describe('CanvasContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in draw mode by default', () => {
    render(<CanvasContainer sessionId="session1" />);

    expect(screen.getByText('Draw')).toBeTruthy();
    expect(screen.getByTestId('drawing-canvas')).toBeTruthy();
  });

  it('switches to annotate mode when button is clicked', () => {
    render(<CanvasContainer sessionId="session1" />);

    fireEvent.click(screen.getByText('Annotate Image'));

    expect(screen.getByText('Upload an image to annotate')).toBeTruthy();
  });

  it('shows upload button in annotate mode', () => {
    render(<CanvasContainer sessionId="session1" />);

    fireEvent.click(screen.getByText('Annotate Image'));
    expect(screen.getByText('Upload Image')).toBeTruthy();
  });

  it('shows error for non-image file', async () => {
    render(<CanvasContainer sessionId="session1" />);

    fireEvent.click(screen.getByText('Annotate Image'));

    const fileInput = screen.getByLabelText('Upload Image');
    const file = new File(['text'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.queryByText('Please select an image file')).toBeTruthy();
    });
  });

  it('returns local snapshot data when captured', async () => {
    const onSnapshotCaptured = vi.fn();

    render(
      <CanvasContainer
        sessionId="session1"
        onSnapshotCaptured={onSnapshotCaptured}
      />
    );

    fireEvent.click(screen.getByTestId('mock-snapshot-button'));

    await waitFor(() => {
      expect(onSnapshotCaptured).toHaveBeenCalledWith(
        'data:image/png;base64,mock',
        expect.objectContaining({
          summary: 'Drawing snapshot captured for lesson review.',
          markings: [],
          sessionId: 'session1',
        })
      );
    });
  });

  it('disables canvas when disabled prop is true', () => {
    render(<CanvasContainer sessionId="session1" disabled />);

    expect(screen.getByTestId('drawing-canvas').getAttribute('data-disabled')).toBe(
      'true'
    );
  });

  it('disables mode buttons when disabled', () => {
    render(<CanvasContainer sessionId="session1" disabled />);

    expect(screen.getByText('Draw').closest('button')?.hasAttribute('disabled')).toBe(
      true
    );
    expect(
      screen.getByText('Annotate Image').closest('button')?.hasAttribute('disabled')
    ).toBe(true);
  });

  it('includes session ID in local interpretation payload', async () => {
    const onSnapshotCaptured = vi.fn();

    render(
      <CanvasContainer
        sessionId="test-session-123"
        onSnapshotCaptured={onSnapshotCaptured}
      />
    );

    fireEvent.click(screen.getByTestId('mock-snapshot-button'));

    await waitFor(() => {
      expect(onSnapshotCaptured).toHaveBeenCalledWith(
        'data:image/png;base64,mock',
        expect.objectContaining({
          sessionId: 'test-session-123',
        })
      );
    });
  });
});
