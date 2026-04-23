'use client';

import { useRef, useState, useCallback } from 'react';
import { Stage, Layer, Line, Image as KonvaImage } from 'react-konva';
import { Pencil, Eraser, Undo, Redo, Trash2, Camera } from 'lucide-react';
import Konva from 'konva';

export type DrawingTool = 'pen' | 'eraser';

export interface DrawingLine {
  tool: DrawingTool;
  points: number[];
  strokeColor: string;
  strokeWidth: number;
}

export interface DrawingCanvasProps {
  width?: number;
  height?: number;
  backgroundImage?: HTMLImageElement | null;
  onSnapshot?: (
    dataUrl: string,
    metadata?: {
      overlayDataUrl: string;
      strokeColors: string[];
      strokeCount: number;
      canvasWidth: number;
      canvasHeight: number;
    }
  ) => void;
  disabled?: boolean;
}

export function DrawingCanvas({
  width = 800,
  height = 600,
  backgroundImage = null,
  onSnapshot,
  disabled = false,
}: DrawingCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [lines, setLines] = useState<DrawingLine[]>([]);
  const [history, setHistory] = useState<DrawingLine[][]>([]);
  const [historyStep, setHistoryStep] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);

  const colors = [
    '#000000', // Black
    '#FF0000', // Red
    '#0000FF', // Blue
    '#00FF00', // Green
    '#FFFF00', // Yellow
    '#FF00FF', // Magenta
    '#00FFFF', // Cyan
    '#FFA500', // Orange
  ];

  const strokeWidths = [2, 3, 5, 8];

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (disabled) return;

      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;

      setIsDrawing(true);

      const newLine: DrawingLine = {
        tool,
        points: [pos.x, pos.y],
        strokeColor: tool === 'eraser' ? '#FFFFFF' : strokeColor,
        strokeWidth: tool === 'eraser' ? 20 : strokeWidth,
      };

      setLines((prevLines) => [...prevLines, newLine]);
    },
    [disabled, tool, strokeColor, strokeWidth]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isDrawing || disabled) return;

      const stage = e.target.getStage();
      const point = stage?.getPointerPosition();
      if (!point) return;

      setLines((prevLines) => {
        const lastLine = prevLines[prevLines.length - 1];
        if (!lastLine) return prevLines;

        const updatedLine = {
          ...lastLine,
          points: lastLine.points.concat([point.x, point.y]),
        };

        return [...prevLines.slice(0, -1), updatedLine];
      });
    },
    [isDrawing, disabled]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    // Save to history for undo/redo
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push([...lines]);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  }, [isDrawing, lines, history, historyStep]);

  const handleUndo = useCallback(() => {
    if (historyStep === 0) return;
    
    const newStep = historyStep - 1;
    setHistoryStep(newStep);
    setLines(history[newStep] || []);
  }, [historyStep, history]);

  const handleRedo = useCallback(() => {
    if (historyStep >= history.length - 1) return;
    
    const newStep = historyStep + 1;
    setHistoryStep(newStep);
    setLines(history[newStep] || []);
  }, [historyStep, history]);

  const handleClear = useCallback(() => {
    setLines([]);
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  }, [history, historyStep]);

  const handleSnapshot = useCallback(() => {
    if (!stageRef.current || !onSnapshot) return;

    const dataUrl = stageRef.current.toDataURL({
      pixelRatio: 2,
      mimeType: 'image/png',
    });
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = width;
    overlayCanvas.height = height;
    const overlayContext = overlayCanvas.getContext('2d');

    if (!overlayContext) {
      onSnapshot(dataUrl);
      return;
    }

    for (const line of lines) {
      if (line.points.length < 2) {
        continue;
      }

      overlayContext.save();
      overlayContext.beginPath();
      overlayContext.moveTo(line.points[0] || 0, line.points[1] || 0);

      for (let index = 2; index < line.points.length; index += 2) {
        overlayContext.lineTo(line.points[index] || 0, line.points[index + 1] || 0);
      }

      overlayContext.strokeStyle = line.strokeColor;
      overlayContext.lineWidth = line.strokeWidth;
      overlayContext.lineCap = 'round';
      overlayContext.lineJoin = 'round';
      overlayContext.globalCompositeOperation =
        line.tool === 'eraser' ? 'destination-out' : 'source-over';
      overlayContext.stroke();
      overlayContext.restore();
    }

    onSnapshot(dataUrl, {
      overlayDataUrl: overlayCanvas.toDataURL('image/png'),
      strokeColors: Array.from(new Set(lines.map((line) => line.strokeColor))),
      strokeCount: lines.length,
      canvasWidth: width,
      canvasHeight: height,
    });
  }, [height, lines, onSnapshot, width]);

  return (
    <div className="flex flex-col space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        {/* Drawing Tools */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700 mr-2">Tool:</span>
          <button
            onClick={() => setTool('pen')}
            disabled={disabled}
            className={`p-2 rounded-lg transition-colors ${
              tool === 'pen'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Pen"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={() => setTool('eraser')}
            disabled={disabled}
            className={`p-2 rounded-lg transition-colors ${
              tool === 'eraser'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Eraser"
          >
            <Eraser className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-gray-300 mx-2" />

          {/* Undo/Redo */}
          <button
            onClick={handleUndo}
            disabled={disabled || historyStep === 0}
            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Undo"
          >
            <Undo className="w-5 h-5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={disabled || historyStep >= history.length - 1}
            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Redo"
          >
            <Redo className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-gray-300 mx-2" />

          {/* Clear */}
          <button
            onClick={handleClear}
            disabled={disabled || lines.length === 0}
            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Clear All"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Snapshot */}
          {onSnapshot && (
            <>
              <div className="w-px h-8 bg-gray-300 mx-2" />
              <button
                onClick={handleSnapshot}
                disabled={disabled}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Submit Markup"
              >
                <Camera className="w-5 h-5" />
                <span>Submit Markup</span>
              </button>
            </>
          )}
        </div>

        {/* Color Picker */}
        {tool === 'pen' && (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Color:</span>
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => setStrokeColor(color)}
                disabled={disabled}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  strokeColor === color
                    ? 'border-indigo-600 scale-110'
                    : 'border-gray-300 hover:scale-105'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        )}

        {/* Stroke Width */}
        {tool === 'pen' && (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Width:</span>
            {strokeWidths.map((width) => (
              <button
                key={width}
                onClick={() => setStrokeWidth(width)}
                disabled={disabled}
                className={`px-3 py-1 rounded-lg border-2 transition-all text-sm font-medium ${
                  strokeWidth === width
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {width}px
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border-2 border-gray-200">
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          className={disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}
        >
          <Layer>
            {/* Background Image */}
            {backgroundImage && (
              <KonvaImage
                image={backgroundImage}
                width={width}
                height={height}
              />
            )}

            {/* Drawing Lines */}
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke={line.strokeColor}
                strokeWidth={line.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
