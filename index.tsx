import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Tool, Point, Line, Triangle, AppState, TextObject
} from './types';
import {
  worldToCanvas, canvasToWorld, calculateArea, generateId, hexToRgba, calculateDistance,
  getSheetDimensions, clampPointToSheet, clampPointWithDirection,
  calculateSSSVertex, rotatePoint
} from './utils';
import { useHistory } from './hooks/useHistory';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { InfoBar } from './components/InfoBar';
import { SetupModal } from './components/SetupModal';
import { Layers, Edit3, Triangle as TriangleIcon, ZoomIn, ZoomOut, Type } from 'lucide-react';

const INITIAL_STATE: AppState = {
  points: [],
  lines: [],
  triangles: [],
  texts: [],
  selection: { type: null, id: null },
  offset: { x: 0, y: 0 },
  scale: 40, // Default zoom
  gridVisible: true,
  snapToGrid: true,
  theme: 'light',
  activeTool: 'SELECT',
  sheetMode: 'infinite',
  borderWidth: 2,
  borderColor: '#64748b',
  isInitialized: false
};

const App = () => {
  const { state, push, replace, undo, redo, canUndo, canRedo } = useHistory<AppState>(INITIAL_STATE);
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [tempPoints, setTempPoints] = useState<string[]>([]);
  const [precisionPrompt, setPrecisionPrompt] = useState<{ x: number, y: number, angle: number } | null>(null);
  const [lengthInput, setLengthInput] = useState('');
  const [sssPrompt, setSssPrompt] = useState<{ p1Id: string, p2Id: string, x: number, y: number } | null>(null);
  const [sssInputs, setSssInputs] = useState({ b: '', c: '' });
  const [rotationPrompt, setRotationPrompt] = useState<{ id: string, type: 'TRIANGLE' | 'GLOBAL', x: number, y: number } | null>(null);
  const [rotationInput, setRotationInput] = useState('');
  const [textPrompt, setTextPrompt] = useState<{ worldX: number, worldY: number, x: number, y: number } | null>(null);
  const [textInput, setTextInput] = useState('');
  const [hariPrompt, setHariPrompt] = useState<{ p1Id: string, p2Id?: string, p3Id?: string, x: number, y: number } | null>(null);
  const [hariInputs, setHariInputs] = useState({ a: '', b: '', c: '' });
  const [lineLengthPrompt, setLineLengthPrompt] = useState<{ id: string, x: number, y: number } | null>(null);
  const [lineLengthInput, setLineLengthInput] = useState('');
  const [isRotating, setIsRotating] = useState(false);
  const [isScaling, setIsScaling] = useState(false);
  const [rotationStartCenter, setRotationStartCenter] = useState({ x: 0, y: 0 });
  const [scalingStartDist, setScalingStartDist] = useState(1);
  const [initialPoints, setInitialPoints] = useState<Point[]>([]);
  const [initialPointsForScaling, setInitialPointsForScaling] = useState<Point[]>([]);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  const updateState = useCallback((updater: (s: AppState) => AppState, shouldPush = true) => {
    const newState = updater(state);
    if (shouldPush) {
      push(newState);
    } else {
      replace(newState);
    }
  }, [state, push, replace]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set internal resolution to match display size
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const { width, height } = canvas;
    const { offset, scale, points, lines, triangles, gridVisible, theme, sheetMode, borderWidth, borderColor } = state;

    // Background
    ctx.fillStyle = theme === 'dark' ? '#020617' : '#f1f5f9';
    ctx.fillRect(0, 0, width, height);

    // Sheet Rendering (A4, A6)
    const { w: sheetW, h: sheetH } = getSheetDimensions(sheetMode);

    if (sheetMode !== 'infinite') {
      const topLeft = worldToCanvas(-sheetW / 2, sheetH / 2, offset, scale, width, height);
      const bottomRight = worldToCanvas(sheetW / 2, -sheetH / 2, offset, scale, width, height);

      // Paper Shadow
      ctx.shadowBlur = 40;
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.fillStyle = theme === 'dark' ? '#1e293b' : '#ffffff';
      ctx.roundRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y, 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Paper Border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    }

    // Grid
    if (gridVisible) {
      ctx.beginPath();
      ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;

      const step = 1; // 1 meter grid
      const worldStart = canvasToWorld(0, 0, offset, scale, width, height);
      const worldEnd = canvasToWorld(width, height, offset, scale, width, height);

      for (let x = Math.floor(worldStart.x); x <= Math.ceil(worldEnd.x); x += step) {
        const p = worldToCanvas(x, 0, offset, scale, width, height);
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x, height);
      }
      for (let y = Math.floor(worldEnd.y); y <= Math.ceil(worldStart.y); y += step) {
        const p = worldToCanvas(0, y, offset, scale, width, height);
        ctx.moveTo(0, p.y);
        ctx.lineTo(width, p.y);
      }
      ctx.stroke();
    }

    // Snap Indicator
    if (state.snapToGrid && !isPanning && !isDragging) {
      const worldMouse = canvasToWorld(mousePos.x, mousePos.y, offset, scale, width, height);
      const snappedWorld = { x: Math.round(worldMouse.x), y: Math.round(worldMouse.y) };
      const snappedCanvas = worldToCanvas(snappedWorld.x, snappedWorld.y, offset, scale, width, height);

      if (Math.hypot(snappedCanvas.x - mousePos.x, snappedCanvas.y - mousePos.y) < 30) {
        ctx.beginPath();
        ctx.arc(snappedCanvas.x, snappedCanvas.y, 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(59,130,246,0.3)';
        ctx.fill();
      }
    }

    // Triangles
    triangles.forEach(t => {
      const pts = t.points.map(pid => points.find(p => p.id === pid)).filter(Boolean) as Point[];
      if (pts.length !== 3) return;

      ctx.beginPath();
      const cp1 = worldToCanvas(pts[0].x, pts[0].y, offset, scale, width, height);
      ctx.moveTo(cp1.x, cp1.y);
      pts.slice(1).forEach(pt => {
        const p = worldToCanvas(pt.x, pt.y, offset, scale, width, height);
        ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();

      ctx.fillStyle = hexToRgba(t.fillColor, t.opacity);
      ctx.fill();
      ctx.strokeStyle = t.borderColor;
      ctx.lineWidth = 1; // Subtle border for the fill
      ctx.stroke();

      const centerX = (pts[0].x + pts[1].x + pts[2].x) / 3;
      const centerY = (pts[0].y + pts[1].y + pts[2].y) / 3;
      const c = worldToCanvas(centerX, centerY, offset, scale, width, height);

      // Plot Metadata HUD on Canvas
      ctx.save();
      ctx.fillStyle = theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.roundRect(c.x - 40, c.y - 12, 80, 24, 8);
      ctx.fill();

      ctx.fillStyle = theme === 'dark' ? '#f1f5f9' : '#0f172a';
      ctx.font = '900 9px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(t.name.toUpperCase(), c.x, c.y - 2);

      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 11px JetBrains Mono';
      ctx.fillText(`${t.area.toFixed(5)}m²`, c.x, c.y + 10);
      ctx.restore();

      // Render Rotation Handle (Nobe) if selected
      if (state.selection.type === 'TRIANGLE' && state.selection.id === t.id) {
        const handleLength = 50;
        const handleX = c.x;
        const handleY = c.y - handleLength;

        // Rotation Handle
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(handleX, handleY);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 1]);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(handleX, handleY, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();

        ctx.fillStyle = '#000';
        ctx.font = 'bold 9px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('R', handleX, handleY + 3);

        // Rotation Angle Gauge
        if (isRotating) {
          const currentAngle = Math.atan2(mousePos.y - c.y, mousePos.x - c.x);
          const startAngle = -Math.PI / 2;
          let deg = (currentAngle - startAngle) * (180 / Math.PI);
          while (deg > 180) deg -= 360;
          while (deg < -180) deg += 360;

          ctx.beginPath();
          ctx.arc(c.x, c.y, 30, startAngle, currentAngle, deg < 0);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
          ctx.lineWidth = 15;
          ctx.stroke();

          ctx.fillStyle = '#fbbf24';
          ctx.font = 'black 14px JetBrains Mono';
          ctx.fillText(`${deg > 0 ? '+' : ''}${deg.toFixed(1)}°`, handleX, handleY - 20);
        }
        ctx.restore();

        // Scaling Handle (Nobe) - Positioned below centroid
        const scaleHandleY = c.y + handleLength;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x, scaleHandleY);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 1]);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(c.x, scaleHandleY, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#6366f1';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('S', c.x, scaleHandleY + 3);

        if (isScaling) {
          const currentDist = Math.hypot(mousePos.x - c.x, mousePos.y - c.y);
          const startDist = handleLength; // Scaling start reference is the handle length in canvas space
          const factor = currentDist / startDist;
          ctx.fillStyle = '#6366f1';
          ctx.font = 'black 14px JetBrains Mono';
          ctx.fillText(`${(factor * 100).toFixed(0)}%`, c.x, scaleHandleY + 30);
        }
        ctx.restore();
      }
    });

    // Lines
    lines.forEach(l => {
      const p1 = points.find(p => p.id === l.p1);
      const p2 = points.find(p => p.id === l.p2);
      if (!p1 || !p2) return;

      const cp1 = worldToCanvas(p1.x, p1.y, offset, scale, width, height);
      const cp2 = worldToCanvas(p2.x, p2.y, offset, scale, width, height);

      ctx.beginPath();
      ctx.moveTo(cp1.x, cp1.y);
      ctx.lineTo(cp2.x, cp2.y);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.thickness;
      if (theme === 'dark') ctx.setLineDash([5, 5]); // Surveyors markers style
      ctx.stroke();
      ctx.setLineDash([]);

      const dist = calculateDistance(p1, p2);
      const midX = (cp1.x + cp2.x) / 2;
      const midY = (cp1.y + cp2.y) / 2;
      const angle = Math.atan2(cp2.y - cp1.y, cp2.x - cp1.x);

      // Metrology Pill
      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(angle);

      // Label Background
      ctx.fillStyle = theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.roundRect(-22, -8, 44, 16, 4);
      ctx.fill();
      ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
      ctx.stroke();

      ctx.fillStyle = theme === 'dark' ? '#94a3b8' : '#475569';
      ctx.font = 'bold 10px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(`${dist.toFixed(5)}m`, 0, 4);
      ctx.restore();
    });

    // Points
    points.forEach(p => {
      const cp = worldToCanvas(p.x, p.y, offset, scale, width, height);

      const gradient = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, 6);
      gradient.addColorStop(0, p.color);
      gradient.addColorStop(1, '#000');

      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      if (state.selection.id === p.id) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = theme === 'dark' ? '#fff' : '#000';
      ctx.font = '900 11px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(p.label, cp.x + 12, cp.y + 4);
    });

    // Texts / Titles
    state.texts.forEach(txt => {
      const cp = worldToCanvas(txt.x, txt.y, offset, scale, width, height);
      ctx.fillStyle = txt.color;
      ctx.font = `black ${txt.size}px Inter`;
      ctx.textAlign = 'center';
      ctx.fillText(txt.content, cp.x, cp.y);

      if (state.selection.type === 'TEXT' && state.selection.id === txt.id) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        const metrics = ctx.measureText(txt.content);
        ctx.strokeRect(cp.x - metrics.width / 2 - 4, cp.y - txt.size, metrics.width + 8, txt.size + 8);
      }
    });

    // Temp selection indicators
    if (tempPoints.length > 0) {
      tempPoints.forEach(pid => {
        const p = points.find(pt => pt.id === pid);
        if (p) {
          const cp = worldToCanvas(p.x, p.y, offset, scale, width, height);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }

    // Precision Vector Guide
    if (precisionPrompt && tempPoints.length > 0) {
      const basePoint = points.find(p => p.id === tempPoints[0]);
      if (basePoint) {
        const cp1 = worldToCanvas(basePoint.x, basePoint.y, offset, scale, width, height);
        ctx.beginPath();
        ctx.setLineDash([10, 5]);
        ctx.moveTo(cp1.x, cp1.y);
        ctx.lineTo(cp1.x + 2000 * Math.cos(precisionPrompt.angle), cp1.y - 2000 * Math.sin(precisionPrompt.angle));
        ctx.strokeStyle = 'rgba(59,130,246,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Drafting Guide (Ghost Line & Distance)
    if (state.activeTool === 'LINE' && tempPoints.length === 1) {
      const p1 = points.find(p => p.id === tempPoints[0]);
      if (p1) {
        const cp1 = worldToCanvas(p1.x, p1.y, offset, scale, width, height);
        const worldMouse = canvasToWorld(mousePos.x, mousePos.y, offset, scale, width, height);
        const dist = Math.hypot(worldMouse.x - p1.x, worldMouse.y - p1.y);

        ctx.beginPath();
        ctx.moveTo(cp1.x, cp1.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = theme === 'dark' ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = theme === 'dark' ? '#60a5fa' : '#3b82f6';
        ctx.font = 'bold 11px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText(`${dist.toFixed(2)}m`, mousePos.x, mousePos.y - 15);
      }
    }

    requestRef.current = requestAnimationFrame(draw);
  }, [state, tempPoints, mousePos, isPanning, isDragging, precisionPrompt, isRotating, rotationStartCenter, initialPoints, isScaling, scalingStartDist, initialPointsForScaling, textPrompt, textInput]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { button } = e;
    const worldPos = canvasToWorld(x, y, state.offset, state.scale, rect.width, rect.height);

    // Middle mouse pan support
    if (button === 1 || state.activeTool === 'PAN') {
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (state.activeTool === 'TEXT') {
      setTextPrompt({
        worldX: worldPos.x,
        worldY: worldPos.y,
        x, y
      });
      setTextInput('');
      return;
    }

    if (state.activeTool === 'SELECT') {
      // 0. Rotation Handle Hit Test
      if (state.selection.type === 'TRIANGLE' && state.selection.id) {
        const t = state.triangles.find(tr => tr.id === state.selection.id);
        if (t) {
          const pts = t.points.map(pid => state.points.find(p => p.id === pid)).filter(Boolean) as Point[];
          if (pts.length === 3) {
            const centerX = (pts[0].x + pts[1].x + pts[2].x) / 3;
            const centerY = (pts[0].y + pts[1].y + pts[2].y) / 3;
            const c = worldToCanvas(centerX, centerY, state.offset, state.scale, rect.width, rect.height);

            const handleLength = 40;
            const handleX = c.x;
            const handleY = c.y - handleLength;

            if (Math.hypot(x - handleX, y - handleY) < 15) {
              setIsRotating(true);
              setRotationStartCenter({ x: centerX, y: centerY });
              setInitialPoints([...state.points]);
              return;
            }

            // Scaling Handle Hit Test
            const scaleHandleY = c.y + 50;
            if (Math.hypot(x - handleX, y - scaleHandleY) < 15) {
              setIsScaling(true);
              setRotationStartCenter({ x: centerX, y: centerY }); // Use same center for scaling
              setScalingStartDist(50); // Canvas space reference dist
              setInitialPointsForScaling([...state.points]);
              return;
            }
          }
        }
      }

      // 1. Prioritize Metrology Pill
      const clickedPillLine = state.lines.find(l => {
        const p1 = state.points.find(pt => pt.id === l.p1);
        const p2 = state.points.find(pt => pt.id === l.p2);
        if (!p1 || !p2) return false;

        const cp1 = worldToCanvas(p1.x, p1.y, state.offset, state.scale, rect.width, rect.height);
        const cp2 = worldToCanvas(p2.x, p2.y, state.offset, state.scale, rect.width, rect.height);
        const midX = (cp1.x + cp2.x) / 2;
        const midY = (cp1.y + cp2.y) / 2;

        return Math.hypot(x - midX, y - midY) < 20;
      });

      if (clickedPillLine) {
        const l = clickedPillLine;
        const p1 = state.points.find(pt => pt.id === l.p1)!;
        const p2 = state.points.find(pt => pt.id === l.p2)!;

        const parentTriangle = state.triangles.find(t => t.points.includes(l.p1) && t.points.includes(l.p2));

        if (parentTriangle) {
          const pts = parentTriangle.points.map(id => state.points.find(p => p.id === id)!);
          // Standardize order: P1 is anchor, P2 is second, P3 is vertex
          setHariInputs({
            a: calculateDistance(pts[0], pts[1]).toFixed(5),
            b: calculateDistance(pts[0], pts[2]).toFixed(5),
            c: calculateDistance(pts[1], pts[2]).toFixed(5)
          });
          setHariPrompt({
            p1Id: parentTriangle.points[0],
            p2Id: parentTriangle.points[1],
            p3Id: parentTriangle.points[2],
            x: e.clientX, y: e.clientY
          });
          return;
        }

        setLineLengthInput(calculateDistance(p1, p2).toFixed(5));
        setLineLengthPrompt({ id: l.id, x: e.clientX, y: e.clientY });
        return;
      }

      // 2. Point selection
      const clickedPoint = state.points.find(p => {
        const cp = worldToCanvas(p.x, p.y, state.offset, state.scale, rect.width, rect.height);
        return Math.hypot(cp.x - x, cp.y - y) < 15;
      });

      if (clickedPoint) {
        updateState(s => ({ ...s, selection: { type: 'POINT', id: clickedPoint.id } }), false);
        setIsDragging(true);
        return;
      }

      // 3. Triangle selection (hit test)
      const clickedTriangle = [...state.triangles].reverse().find(t => {
        const pts = t.points.map(pid => state.points.find(p => p.id === pid)).filter(Boolean) as Point[];
        if (pts.length !== 3) return false;

        const aOuter = calculateArea(pts[0], pts[1], pts[2]);
        const a1 = calculateArea({ x: worldPos.x, y: worldPos.y } as Point, pts[1], pts[2]);
        const a2 = calculateArea(pts[0], { x: worldPos.x, y: worldPos.y } as Point, pts[2]);
        const a3 = calculateArea(pts[0], pts[1], { x: worldPos.x, y: worldPos.y } as Point);
        return Math.abs(aOuter - (a1 + a2 + a3)) < 0.01;
      });

      if (clickedTriangle) {
        updateState(s => ({ ...s, selection: { type: 'TRIANGLE', id: clickedTriangle.id } }), false);
        return;
      }

      // 4. Text selection
      const clickedText = [...state.texts].reverse().find(txt => {
        const cp = worldToCanvas(txt.x, txt.y, state.offset, state.scale, rect.width, rect.height);
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return false;
        canvasCtx.font = `black ${txt.size}px Inter`;
        const metrics = canvasCtx.measureText(txt.content);
        return x >= cp.x - metrics.width / 2 - 10 && x <= cp.x + metrics.width / 2 + 10 &&
          y >= cp.y - txt.size - 10 && y <= cp.y + 10;
      });

      if (clickedText) {
        updateState(s => ({ ...s, selection: { type: 'TEXT', id: clickedText.id } }), false);
        return;
      }

      updateState(s => ({ ...s, selection: { type: null, id: null } }), false);
    } else if (state.activeTool === 'POINT' || state.activeTool === 'LINE' || state.activeTool === 'HARITRIANGLE') {
      const clickedPoint = state.points.find(p => {
        const cp = worldToCanvas(p.x, p.y, state.offset, state.scale, rect.width, rect.height);
        return Math.hypot(cp.x - x, cp.y - y) < 15;
      });

      if (state.activeTool === 'HARITRIANGLE') {
        const targetPoint = clickedPoint || {
          id: generateId('P', state.points.length),
          x: worldPos.x,
          y: worldPos.y,
          label: `P${state.points.length + 1}`,
          color: '#3b82f6'
        };

        if (!clickedPoint) {
          updateState(s => ({ ...s, points: [...s.points, targetPoint as Point] }));
        }

        setHariPrompt({ p1Id: targetPoint.id, x: e.clientX, y: e.clientY });
        return;
      }

      // Handle LINE tool connection vs precision prompt
      if (state.activeTool === 'LINE' && tempPoints.length === 1) {
        if (clickedPoint) {
          // Connect to existing point immediately
          if (tempPoints[0] !== clickedPoint.id) {
            const newLine: Line = {
              id: generateId('L', state.lines.length),
              p1: tempPoints[0], p2: clickedPoint.id,
              color: state.theme === 'dark' ? '#94a3b8' : '#475569',
              thickness: 2
            };
            updateState(s => ({ ...s, lines: [...s.lines, newLine] }));
          }
          setTempPoints([]);
          return;
        } else {
          // Clicked empty space: trigger length prompt
          const basePoint = state.points.find(p => p.id === tempPoints[0]);
          if (basePoint) {
            const angle = Math.atan2(worldPos.y - basePoint.y, worldPos.x - basePoint.x);
            setPrecisionPrompt({ x: e.clientX, y: e.clientY, angle });
            return;
          }
        }
      }

      // Handle POINT tool sequence starting from existing point
      if (state.activeTool === 'POINT' && clickedPoint) {
        const angle = Math.atan2(worldPos.y - clickedPoint.y, worldPos.x - clickedPoint.x);
        setPrecisionPrompt({ x: e.clientX, y: e.clientY, angle });
        setTempPoints([clickedPoint.id]);
        return;
      }

      // Normal behavior if no sequence or first click
      if (state.activeTool === 'POINT') {
        let { x: wx, y: wy } = worldPos;
        const clamped = clampPointToSheet(wx, wy, state.sheetMode);
        wx = clamped.x; wy = clamped.y;
        if (state.snapToGrid) { wx = Math.round(wx); wy = Math.round(wy); }

        const newPoint: Point = {
          id: generateId('P', state.points.length),
          x: wx, y: wy,
          label: `P${state.points.length + 1}`,
          color: '#3b82f6'
        };
        updateState(s => ({ ...s, points: [...s.points, newPoint] }));
      } else if (state.activeTool === 'LINE') {
        if (clickedPoint) {
          const newTemp = [...tempPoints, clickedPoint.id];
          if (newTemp.length === 2) {
            if (newTemp[0] !== newTemp[1]) {
              const newLine: Line = {
                id: generateId('L', state.lines.length),
                p1: newTemp[0], p2: newTemp[1],
                color: state.theme === 'dark' ? '#94a3b8' : '#475569',
                thickness: 2
              };
              updateState(s => ({ ...s, lines: [...s.lines, newLine] }));
            }
            setTempPoints([]);
          } else {
            setTempPoints([clickedPoint.id]);
          }
        }
      }
    }
    else if (state.activeTool === 'TRIANGLE') {
      const clickedPoint = state.points.find(p => {
        const cp = worldToCanvas(p.x, p.y, state.offset, state.scale, rect.width, rect.height);
        return Math.hypot(cp.x - x, cp.y - y) < 15;
      });

      const clickedLine = !clickedPoint ? state.lines.find(l => {
        const p1 = state.points.find(p => p.id === l.p1);
        const p2 = state.points.find(p => p.id === l.p2);
        if (!p1 || !p2) return false;
        const cp1 = worldToCanvas(p1.x, p1.y, state.offset, state.scale, rect.width, rect.height);
        const cp2 = worldToCanvas(p2.x, p2.y, state.offset, state.scale, rect.width, rect.height);
        // Dist from point to segment
        const A = x - cp1.x; const B = y - cp1.y; const C = cp2.x - cp1.x; const D = cp2.y - cp1.y;
        const dot = A * C + B * D; const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0) param = dot / len_sq;
        let xx, yy;
        if (param < 0) { xx = cp1.x; yy = cp1.y; }
        else if (param > 1) { xx = cp2.x; yy = cp2.y; }
        else { xx = cp1.x + param * C; yy = cp1.y + param * D; }
        return Math.hypot(x - xx, y - yy) < 10;
      }) : null;

      if (state.activeTool === 'HARITRIANGLE') {
        const targetPoint = clickedPoint || {
          id: generateId('P', state.points.length),
          x: worldPos.x,
          y: worldPos.y,
          label: `P${state.points.length + 1}`,
          color: '#3b82f6'
        };

        if (!clickedPoint) {
          updateState(s => ({ ...s, points: [...s.points, targetPoint as Point] }));
        }

        setHariPrompt({ p1Id: targetPoint.id, x: e.clientX, y: e.clientY });
        return;
      }

      if (clickedPoint || clickedLine) {
        let newTemp = [...tempPoints];
        if (clickedPoint && !newTemp.includes(clickedPoint.id)) {
          newTemp.push(clickedPoint.id);
        } else if (clickedLine) {
          if (!newTemp.includes(clickedLine.p1)) newTemp.push(clickedLine.p1);
          if (!newTemp.includes(clickedLine.p2)) newTemp.push(clickedLine.p2);
        }

        // Trigger SSS if exactly 2 points are selected and we click again
        if (newTemp.length === 2 && (clickedPoint || clickedLine)) {
          setSssPrompt({ p1Id: newTemp[0], p2Id: newTemp[1], x: e.clientX, y: e.clientY });
          setTempPoints(newTemp);
          return;
        }

        if (newTemp.length >= 3) {
          const uniquePoints = Array.from(new Set(newTemp)).slice(0, 3);
          const pts = uniquePoints.map(id => state.points.find(p => p.id === id)!);

          setHariInputs({
            a: calculateDistance(pts[0], pts[1]).toFixed(5),
            b: calculateDistance(pts[0], pts[2]).toFixed(5),
            c: calculateDistance(pts[1], pts[2]).toFixed(5)
          });

          setHariPrompt({
            p1Id: uniquePoints[0],
            p2Id: uniquePoints[1],
            p3Id: uniquePoints[2],
            x: e.clientX, y: e.clientY
          });

          setTempPoints([]);
          return;
        }
        setTempPoints(newTemp);
      }
    } else if (state.activeTool === 'ERASER') {
      const clickedPoint = state.points.find(p => {
        const cp = worldToCanvas(p.x, p.y, state.offset, state.scale, rect.width, rect.height);
        return Math.hypot(cp.x - x, cp.y - y) < 15;
      });
      if (clickedPoint) {
        updateState(s => ({
          ...s,
          points: s.points.filter(pt => pt.id !== clickedPoint.id),
          lines: s.lines.filter(l => l.p1 !== clickedPoint.id && l.p2 !== clickedPoint.id),
          triangles: s.triangles.filter(t => !t.points.includes(clickedPoint.id))
        }));
        return;
      }

      const clickedTriangle = [...state.triangles].reverse().find(t => {
        const pts = t.points.map(pid => state.points.find(p => p.id === pid)).filter(Boolean) as Point[];
        if (pts.length !== 3) return false;
        const a = calculateArea(pts[0], pts[1], pts[2]);
        const a1 = calculateArea({ x: worldPos.x, y: worldPos.y } as Point, pts[1], pts[2]);
        const a2 = calculateArea(pts[0], { x: worldPos.x, y: worldPos.y } as Point, pts[2]);
        const a3 = calculateArea(pts[0], pts[1], { x: worldPos.x, y: worldPos.y } as Point);
        return Math.abs(a - (a1 + a2 + a3)) < 0.01;
      });
      if (clickedTriangle) {
        updateState(s => ({ ...s, triangles: s.triangles.filter(t => t.id !== clickedTriangle.id) }));
        return;
      }

      const clickedText = [...state.texts].reverse().find(txt => {
        const cp = worldToCanvas(txt.x, txt.y, state.offset, state.scale, rect.width, rect.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        ctx.font = `black ${txt.size}px Inter`;
        const metrics = ctx.measureText(txt.content);
        return x >= cp.x - metrics.width / 2 - 10 && x <= cp.x + metrics.width / 2 + 10 &&
          y >= cp.y - txt.size - 10 && y <= cp.y + 10;
      });
      if (clickedText) {
        updateState(s => ({ ...s, texts: s.texts.filter(t => t.id !== clickedText.id) }));
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
    if (isPanning) {
      const dx = (e.clientX - panStart.x) / state.scale;
      const dy = -(e.clientY - panStart.y) / state.scale;
      updateState(s => ({
        ...s,
        offset: { x: s.offset.x + dx, y: s.offset.y + dy }
      }), false);
      setPanStart({ x: e.clientX, y: e.clientY });
    } else if (isRotating && state.selection.id) {
      const t = state.triangles.find(tr => tr.id === state.selection.id);
      if (t) {
        const center_canv = worldToCanvas(rotationStartCenter.x, rotationStartCenter.y, state.offset, state.scale, rect.width, rect.height);
        const currentAngle = Math.atan2(y - center_canv.y, x - center_canv.x);
        const deltaAngle = currentAngle - (-Math.PI / 2);

        updateState(s => {
          const t_curr = s.triangles.find(tr => tr.id === state.selection.id);
          if (!t_curr) return s;

          const newPoints = s.points.map(p => {
            if (t_curr.points.includes(p.id)) {
              const initP = initialPoints.find(ip => ip.id === p.id);
              if (initP) {
                const rotated = rotatePoint(initP.x, initP.y, rotationStartCenter.x, rotationStartCenter.y, deltaAngle * (180 / Math.PI));
                return { ...p, x: rotated.x, y: rotated.y };
              }
            }
            return p;
          });

          return { ...s, points: newPoints };
        }, false);
      }
    } else if (isScaling && state.selection.id) {
      const t = state.triangles.find(tr => tr.id === state.selection.id);
      if (t) {
        const center_canv = worldToCanvas(rotationStartCenter.x, rotationStartCenter.y, state.offset, state.scale, rect.width, rect.height);
        const currentDist = Math.hypot(x - center_canv.x, y - center_canv.y);
        const factor = currentDist / scalingStartDist;

        updateState(s => {
          const t_curr = s.triangles.find(tr => tr.id === state.selection.id);
          if (!t_curr) return s;

          const newPoints = s.points.map(p => {
            if (t_curr.points.includes(p.id)) {
              const initP = initialPointsForScaling.find(ip => ip.id === p.id);
              if (initP) {
                // Scale from centroid: P' = C + (P - C) * factor
                const nx = rotationStartCenter.x + (initP.x - rotationStartCenter.x) * factor;
                const ny = rotationStartCenter.y + (initP.y - rotationStartCenter.y) * factor;
                return { ...p, x: nx, y: ny };
              }
            }
            return p;
          });

          const newTriangles = s.triangles.map(tr => {
            if (tr.id === t_curr.id) {
              const pts = tr.points.map(pid => newPoints.find(pt => pt.id === pid)!);
              return { ...tr, area: calculateArea(pts[0], pts[1], pts[2]) };
            }
            return tr;
          });

          return { ...s, points: newPoints, triangles: newTriangles };
        }, false);
      }
    } else if (isDragging && state.selection.type === 'POINT' && state.selection.id) {
      const worldPos = canvasToWorld(x, y, state.offset, state.scale, rect.width, rect.height);
      let { x: wx, y: wy } = worldPos;
      if (state.snapToGrid) { wx = Math.round(wx); wy = Math.round(wy); }

      const pid = state.selection.id;
      updateState(s => {
        const newPoints = s.points.map(p => p.id === pid ? { ...p, x: wx, y: wy } : p);
        const newTriangles = s.triangles.map(t => {
          if (t.points.includes(pid)) {
            const pts = t.points.map(id => newPoints.find(p => p.id === id)!);
            return { ...t, area: calculateArea(pts[0], pts[1], pts[2]) };
          }
          return t;
        });
        return { ...s, points: newPoints, triangles: newTriangles };
      }, false);
    }
  };

  const handleMouseUp = () => {
    if (isDragging || isRotating || isScaling) {
      push(state);
      setIsDragging(false);
      setIsRotating(false);
      setIsScaling(false);
    }
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(state.scale * factor, 5), 1000);
    updateState(s => ({ ...s, scale: newScale }), false);
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `survey-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const applyText = () => {
    if (!textPrompt || !textInput.trim()) {
      setTextPrompt(null);
      return;
    }

    const newText: TextObject = {
      id: generateId('T', state.texts.length),
      x: textPrompt.worldX,
      y: textPrompt.worldY,
      content: textInput,
      color: state.theme === 'dark' ? '#fff' : '#000',
      size: 24
    };

    updateState(s => ({ ...s, texts: [...s.texts, newText] }));
    setTextPrompt(null);
    setTextInput('');
  };

  const applyPrecisionLength = () => {
    if (!precisionPrompt) return;
    const length = parseFloat(lengthInput);
    if (isNaN(length) || length <= 0) {
      setPrecisionPrompt(null);
      return;
    }

    const basePoint = state.points.find(p => p.id === tempPoints[0]);
    if (!basePoint) {
      setPrecisionPrompt(null);
      setTempPoints([]);
      return;
    }

    const newX = basePoint.x + length * Math.cos(precisionPrompt.angle);
    const newY = basePoint.y + length * Math.sin(precisionPrompt.angle);

    const newPointId = generateId('P', state.points.length);
    const newPoint: Point = {
      id: newPointId,
      x: newX, y: newY,
      label: `P${state.points.length + 1}`,
      color: '#3b82f6'
    };

    if (state.activeTool === 'LINE') {
      const newLine: Line = {
        id: generateId('L', state.lines.length),
        p1: basePoint.id,
        p2: newPointId,
        color: state.theme === 'dark' ? '#94a3b8' : '#475569',
        thickness: 2
      };
      updateState(s => ({ ...s, points: [...s.points, newPoint], lines: [...s.lines, newLine] }));
    } else {
      updateState(s => ({ ...s, points: [...s.points, newPoint] }));
    }

    setPrecisionPrompt(null);
    setTempPoints([]);
  };

  const applySSSConstruction = () => {
    if (!sssPrompt) return;
    const b = parseFloat(sssInputs.b);
    const c = parseFloat(sssInputs.c);
    if (isNaN(b) || isNaN(c) || b <= 0 || c <= 0) {
      setSssPrompt(null);
      return;
    }

    updateState(s => {
      const p1 = s.points.find(p => p.id === sssPrompt.p1Id);
      const p2 = s.points.find(p => p.id === sssPrompt.p2Id);
      if (!p1 || !p2) return s;

      const result = calculateSSSVertex(p1, p2, b, c);
      if (!result) {
        alert("Invalid side lengths: These lengths cannot form a triangle.");
        return s;
      }

      const { x: newX, y: newY } = result;
      const newPointId = generateId('P', s.points.length);
      const newPoint: Point = {
        id: newPointId,
        x: newX, y: newY,
        label: `P${s.points.length + 1}`,
        color: '#3b82f6'
      };

      const newTriangle: Triangle = {
        id: generateId('T', s.triangles.length),
        points: [p1.id, p2.id, newPointId],
        name: `Plot ${s.triangles.length + 1}`,
        fillColor: '#3b82f6',
        borderColor: '#2563eb',
        opacity: 0.25,
        area: calculateArea(p1, p2, newPoint)
      };

      return {
        ...s,
        points: [...s.points, newPoint],
        triangles: [...s.triangles, newTriangle]
      };
    });

    setSssPrompt(null);
    setTempPoints([]);
    setSssInputs({ b: '', c: '' });
  };

  const applyRotation = () => {
    if (!rotationPrompt) return;
    const angle = parseFloat(rotationInput);
    if (isNaN(angle)) {
      setRotationPrompt(null);
      return;
    }

    if (rotationPrompt.type === 'GLOBAL') {
      handleRotateEntireProject(angle);
    } else {
      const triangle = state.triangles.find(t => t.id === rotationPrompt.id);
      if (triangle) {
        const pts = triangle.points.map(pid => state.points.find(p => p.id === pid)!);
        const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
        const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;

        const newPoints = state.points.map(p => {
          if (triangle.points.includes(p.id)) {
            const rotated = rotatePoint(p.x, p.y, cx, cy, angle);
            return { ...p, ...clampPointToSheet(rotated.x, rotated.y, state.sheetMode) };
          }
          return p;
        });
        updateState(s => ({ ...s, points: newPoints }));
      }
    }
    setRotationPrompt(null);
    setRotationInput('');
  };

  const applyHariTriangle = () => {
    if (!hariPrompt) return;
    const a = parseFloat(hariInputs.a);
    const b = parseFloat(hariInputs.b);
    const c = parseFloat(hariInputs.c);

    if (isNaN(a) || isNaN(b) || isNaN(c) || a <= 0 || b <= 0 || c <= 0) {
      setHariPrompt(null);
      return;
    }

    updateState(s => {
      const p1 = s.points.find(p => p.id === hariPrompt.p1Id);
      if (!p1) return s;

      // Preserve baseline angle if p2 already exists
      let angle = 0;
      let side = 1;
      if (hariPrompt.p2Id) {
        const p2_orig = s.points.find(p => p.id === hariPrompt.p2Id);
        if (p2_orig) {
          angle = Math.atan2(p2_orig.y - p1.y, p2_orig.x - p1.x);

          // Detect handedness if p3 also exists to prevent flipping
          if (hariPrompt.p3Id) {
            const p3_orig = s.points.find(p => p.id === hariPrompt.p3Id);
            if (p3_orig) {
              const cross = (p2_orig.x - p1.x) * (p3_orig.y - p1.y) - (p2_orig.y - p1.y) * (p3_orig.x - p1.x);
              side = cross >= 0 ? 1 : -1;
            }
          }
        }
      }

      const rawP2 = {
        x: p1.x + a * Math.cos(angle),
        y: p1.y + a * Math.sin(angle)
      };

      // Calculate P3 relative to intended P2, preserving original side
      const result3 = calculateSSSVertex(p1, { ...p1, ...rawP2 }, b, c, side);
      // Final world coordinates (Unconstrained)
      const p2X = rawP2.x;
      const p2Y = rawP2.y;
      const p3X = result3.x;
      const p3Y = result3.y;

      const p2Id = hariPrompt.p2Id || generateId('P', s.points.length);
      const p3Id = hariPrompt.p3Id || generateId('P', s.points.length + (hariPrompt.p2Id ? 0 : 1));

      const getLabel = (id: string, defIdx: number) => {
        const existing = s.points.find(p => p.id === id);
        return existing ? existing.label : `P${defIdx + 1}`;
      };

      const finalP2: Point = { id: p2Id, x: p2X, y: p2Y, label: getLabel(p2Id, s.points.length), color: '#3b82f6' };
      const finalP3: Point = { id: p3Id, x: p3X, y: p3Y, label: getLabel(p3Id, s.points.length + (hariPrompt.p2Id ? 0 : 1)), color: '#3b82f6' };

      // Update Points Array atomically
      let nextPoints = s.points;
      const updateOrAdd = (pts: Point[], np: Point) => pts.find(p => p.id === np.id) ? pts.map(p => p.id === np.id ? np : p) : [...pts, np];
      nextPoints = updateOrAdd(nextPoints, finalP2);
      nextPoints = updateOrAdd(nextPoints, finalP3);

      const existingTriangle = s.triangles.find(t =>
        t.points.includes(p1.id) && t.points.includes(p2Id) && t.points.includes(p3Id)
      );

      const newTriangle: Triangle = {
        id: existingTriangle?.id || generateId('T', s.triangles.length),
        points: [p1.id, p2Id, p3Id],
        name: existingTriangle?.name || `HariPlot ${s.triangles.length + 1}`,
        fillColor: '#3b82f6',
        borderColor: '#2563eb',
        opacity: 0.25,
        area: calculateArea(p1, finalP2, finalP3)
      };

      // Handle Lines (Avoid duplicates)
      const linePairs = [[p1.id, p2Id], [p2Id, p3Id], [p3Id, p1.id]];
      let nextLines = s.lines;

      linePairs.forEach(([id1, id2]) => {
        const exists = nextLines.find(l => (l.p1 === id1 && l.p2 === id2) || (l.p2 === id1 && l.p1 === id2));
        if (!exists) {
          nextLines = [...nextLines, { id: generateId('L', nextLines.length), p1: id1, p2: id2, color: '#475569', thickness: 2 }];
        }
      });

      return {
        ...s,
        points: nextPoints,
        lines: nextLines,
        triangles: existingTriangle ? s.triangles.map(t => t.id === existingTriangle.id ? newTriangle : t) : [...s.triangles, newTriangle]
      };
    });

    setHariPrompt(null);
    setHariInputs({ a: '', b: '', c: '' });
  };

  const handleScaleTriangle = (id: string, factor: number) => {
    updateState(s => {
      const triangle = s.triangles.find(t => t.id === id);
      if (!triangle) return s;

      const pts = triangle.points.map(pid => s.points.find(p => p.id === pid)).filter(Boolean) as Point[];
      if (pts.length !== 3) return s;

      const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
      const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;

      const newPoints = s.points.map(p => {
        if (triangle.points.includes(p.id)) {
          const dx = p.x - cx;
          const dy = p.y - cy;
          return { ...p, x: cx + dx * factor, y: cy + dy * factor };
        }
        return p;
      });

      const updatedPts = triangle.points.map(pid => newPoints.find(p => p.id === pid)!);
      return {
        ...s,
        points: newPoints,
        triangles: s.triangles.map(t => t.id === id ? { ...t, area: calculateArea(updatedPts[0], updatedPts[1], updatedPts[2]) } : t)
      };
    });
  };

  const handleRotateEntireProject = (angleDegrees: number) => {
    const angle = (angleDegrees * Math.PI) / 180;
    updateState(s => {
      if (s.points.length === 0) return s;

      const dims = getSheetDimensions(s.sheetMode);
      const cx = dims ? dims.w / 2 : 0;
      const cy = dims ? dims.h / 2 : 0;

      const newPoints = s.points.map(p => {
        const rotated = rotatePoint(p.x, p.y, cx, cy, angle);
        return { ...p, x: rotated.x, y: rotated.y };
      });

      return { ...s, points: newPoints };
    });
  };

  const applyLineLength = () => {
    if (!lineLengthPrompt) return;
    const newLen = parseFloat(lineLengthInput);
    if (isNaN(newLen) || newLen <= 0) {
      setLineLengthPrompt(null);
      return;
    }

    updateState(s => {
      const line = s.lines.find(l => l.id === lineLengthPrompt.id);
      if (!line) return s;
      const p1 = s.points.find(p => p.id === line.p1);
      const p2 = s.points.find(p => p.id === line.p2);
      if (!p1 || !p2) return s;

      const currentLen = calculateDistance(p1, p2);
      if (currentLen === 0) return s;

      const ratio = newLen / currentLen;
      const dx = (p2.x - p1.x) * ratio;
      const dy = (p2.y - p1.y) * ratio;

      const newX = p1.x + dx;
      const newY = p1.y + dy;

      const newPoints = s.points.map(p =>
        p.id === p2.id ? { ...p, x: newX, y: newY } : p
      );

      const newTriangles = s.triangles.map(t => {
        if (t.points.includes(p2.id)) {
          const tpts = t.points.map(id => newPoints.find(pt => pt.id === id)!);
          if (tpts.length === 3) {
            return { ...t, area: calculateArea(tpts[0], tpts[1], tpts[2]) };
          }
        }
        return t;
      });

      return { ...s, points: newPoints, triangles: newTriangles };
    });

    setLineLengthPrompt(null);
    setLineLengthInput('');
  };

  const totalArea = useMemo(() => state.triangles.reduce((acc, t) => acc + t.area, 0), [state.triangles]);

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden transition-all duration-500 font-sans ${state.theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {!state.isInitialized && (
        <SetupModal
          theme={state.theme}
          onComplete={(mode) => updateState(s => ({ ...s, sheetMode: mode, isInitialized: true }), false)}
        />
      )}

      {precisionPrompt && (
        <div
          className="fixed z-[150] p-6 rounded-[2rem] bg-slate-900/90 backdrop-blur-2xl border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] animate-in zoom-in slide-in-from-top-4 duration-300"
          style={{ left: precisionPrompt.x + 40, top: precisionPrompt.y - 40 }}
        >
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Precision Length Input</label>
            </div>
            <div className="flex items-center space-x-3 bg-black/40 p-1.5 rounded-2xl border border-white/5">
              <input
                autoFocus
                className="bg-transparent px-4 py-2 text-white font-black mono text-xl outline-none focus:text-blue-400 w-32 placeholder-slate-700"
                placeholder="0.00"
                value={lengthInput}
                onChange={(e) => setLengthInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyPrecisionLength();
                  if (e.key === 'Escape') setPrecisionPrompt(null);
                }}
              />
              <div className="text-slate-500 font-black pr-4 text-xs tracking-tighter">METERS</div>
              <button
                onClick={applyPrecisionLength}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/20 active:scale-95"
              >
                Draft
              </button>
            </div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest opacity-60 text-center">Aligned to click vector at {(precisionPrompt.angle * 180 / Math.PI).toFixed(1)}°</p>
          </div>
        </div>
      )}

      <div className="z-50 shadow-2xl">
        <InfoBar totalArea={totalArea} activeTool={state.activeTool} zoom={state.scale} selectedItem={state.selection} />
        <Toolbar
          activeTool={state.activeTool}
          setActiveTool={(t) => { setTempPoints([]); updateState(s => ({ ...s, activeTool: t }), false); }}
          onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
          onClear={() => updateState(() => INITIAL_STATE)}
          onZoomIn={() => updateState(s => ({ ...s, scale: s.scale * 1.2 }), false)}
          onZoomOut={() => updateState(s => ({ ...s, scale: s.scale / 1.2 }), false)}
          gridVisible={state.gridVisible}
          onToggleGrid={() => updateState(s => ({ ...s, gridVisible: !s.gridVisible }), false)}
          snapToGrid={state.snapToGrid}
          onToggleSnap={() => updateState(s => ({ ...s, snapToGrid: !s.snapToGrid }), false)}
          theme={state.theme}
          onToggleTheme={() => updateState(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }), false)}
          onExport={exportPNG}
          onGlobalRotate={() => setRotationPrompt({ id: 'GLOBAL', type: 'GLOBAL', x: window.innerWidth / 2, y: window.innerHeight / 2 })}
        />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="absolute inset-0 block w-full h-full cursor-crosshair bg-transparent"
        />
        <div className="absolute top-4 left-4 pointer-events-none p-4 rounded-2xl bg-white/10 dark:bg-black/10 backdrop-blur-md border border-white/20 dark:border-white/5 shadow-xl transition-all duration-500">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full animate-pulse ${state.activeTool === 'SELECT' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">System Ready</span>
          </div>
        </div>
        <Sidebar
          state={state}
          updateState={updateState}
          onRotate={(id) => setRotationPrompt({ id, type: 'TRIANGLE', x: window.innerWidth / 2, y: window.innerHeight / 2 })}
          isVisible={sidebarVisible}
          onToggle={() => setSidebarVisible(!sidebarVisible)}
        />

        {/* Mobile Sidebar Toggle */}
        <button
          onClick={() => setSidebarVisible(!sidebarVisible)}
          className="lg:hidden fixed bottom-24 right-6 z-[60] p-4 bg-blue-600 text-white rounded-full shadow-2xl active:scale-90 transition-transform"
        >
          <Layers size={24} />
        </button>

        {/* Triangle Scaling HUD (Top Right) */}
        {state.selection.type === 'TRIANGLE' && state.selection.id && (
          <div className="absolute top-6 right-80 z-[100] animate-in slide-in-from-right-10 duration-500">
            <div className="flex items-center space-x-2 p-2 bg-slate-900/90 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl">
              <div className="flex flex-col px-4 py-1 border-r border-white/5 mr-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Plot Scaling</span>
                <span className="text-[10px] font-bold text-white uppercase italic">Parametric HUD</span>
              </div>
              <button
                onClick={() => handleScaleTriangle(state.selection.id!, 0.9)}
                className="p-3 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-all active:scale-90 group"
                title="Scale Down (10%)"
              >
                <ZoomOut size={18} className="group-hover:scale-110 transition-transform" />
              </button>
              <button
                onClick={() => handleScaleTriangle(state.selection.id!, 1.1)}
                className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-90 group"
                title="Scale Up (10%)"
              >
                <ZoomIn size={18} className="group-hover:scale-110 transition-transform" />
              </button>
              <button
                onClick={() => {
                  const triangle = state.triangles.find(t => t.id === state.selection.id);
                  if (triangle) {
                    const pts = triangle.points.map(pid => state.points.find(p => p.id === pid)).filter(Boolean) as Point[];
                    if (pts.length === 3) {
                      const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
                      const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;
                      setRotationPrompt({ id: triangle.id, type: 'TRIANGLE', x: cx, y: cy });
                    }
                  }
                }}
                className="p-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-90 group"
                title="Rotate Selection"
              >
                <Edit3 size={18} className="group-hover:rotate-12 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {sssPrompt && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300 p-4">
            <div className="w-full max-w-md p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] bg-slate-900 border border-white/10 shadow-2xl flex flex-col items-center">
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20">
                  <Layers size={20} className="text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Geometry Engine</span>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">SSS Construction</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="flex flex-col space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2">Side B (P1→P3)</label>
                  <input
                    autoFocus
                    className="bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-white font-black mono text-lg outline-none focus:border-blue-500 transition-all w-32"
                    placeholder="Length"
                    value={sssInputs.b}
                    onChange={(e) => setSssInputs(s => ({ ...s, b: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2">Side C (P2→P3)</label>
                  <input
                    className="bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-white font-black mono text-lg outline-none focus:border-blue-500 transition-all w-32"
                    placeholder="Length"
                    value={sssInputs.c}
                    onChange={(e) => setSssInputs(s => ({ ...s, c: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && applySSSConstruction()}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 w-full">
                <button
                  onClick={() => setSssPrompt(null)}
                  className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={applySSSConstruction}
                  className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                >
                  Draft Plot
                </button>
              </div>
            </div>
          </div>
        )}

        {rotationPrompt && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
            <div className="w-full max-w-xs p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] bg-slate-900 border border-white/10 shadow-2xl flex flex-col items-center">
              <div className="p-4 bg-emerald-500/10 rounded-full mb-6">
                <Edit3 size={24} className="text-emerald-500" />
              </div>
              <h3 className="text-lg font-black text-white mb-2 uppercase tracking-tighter text-center leading-none">Rotation Matrix</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-8 text-center px-4">Relative to centroid</p>

              <div className="flex items-center space-x-4 mb-8">
                <input
                  autoFocus
                  className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white font-black mono text-2xl outline-none focus:border-emerald-500 transition-all w-32 text-center"
                  placeholder="0°"
                  value={rotationInput}
                  onChange={(e) => setRotationInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyRotation()}
                />
                <span className="text-emerald-500 font-black text-xl">DEG</span>
              </div>

              <div className="flex flex-col w-full space-y-3">
                <button
                  onClick={applyRotation}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                >
                  Execute Rotation
                </button>
                <button
                  onClick={() => setRotationPrompt(null)}
                  className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors"
                >
                  Terminate Command
                </button>
              </div>
            </div>
          </div>
        )}

        {hariPrompt && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-500 p-4">
            <div className="w-full max-w-sm p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] bg-slate-900/98 backdrop-blur-3xl border border-white/10 shadow-[0_32px_128px_-16px_rgba(37,99,235,0.4)] animate-in zoom-in slide-in-from-bottom-10 duration-700 flex flex-col items-center border-blue-500/20">
              <div className="flex items-center space-x-5 mb-8">
                <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl shadow-2xl shadow-blue-500/40">
                  <TriangleIcon size={24} className="text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400/80 mb-1">SSS Metrology Core</span>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none italic">HariTriangle</h3>
                </div>
              </div>

              <div className="flex flex-col space-y-6 w-72 mb-10">
                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-3">Baseline Vector (Side A)</label>
                  <div className="relative group">
                    <input
                      autoFocus
                      className="bg-black/60 border border-white/5 rounded-2xl px-6 py-4 text-white font-black mono text-xl outline-none focus:border-blue-500/50 focus:bg-black transition-all w-full pr-12"
                      placeholder="0.00"
                      value={hariInputs.a}
                      onChange={(e) => setHariInputs(s => ({ ...s, a: e.target.value }))}
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-blue-500 font-black text-xs opacity-40 group-focus-within:opacity-100 transition-opacity">M</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-3 flex items-baseline">
                      Side B
                      <span className="ml-auto text-[8px] opacity-40 tracking-normal">(P1-P3)</span>
                    </label>
                    <input
                      className="bg-black/60 border border-white/5 rounded-2xl px-6 py-4 text-white font-black mono text-lg outline-none focus:border-blue-500/50 focus:bg-black transition-all w-full"
                      placeholder="0.00"
                      value={hariInputs.b}
                      onChange={(e) => setHariInputs(s => ({ ...s, b: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-3 flex items-baseline">
                      Side C
                      <span className="ml-auto text-[8px] opacity-40 tracking-normal">(P2-P3)</span>
                    </label>
                    <input
                      className="bg-black/60 border border-white/5 rounded-2xl px-6 py-4 text-white font-black mono text-lg outline-none focus:border-blue-500/50 focus:bg-black transition-all w-full"
                      placeholder="0.00"
                      value={hariInputs.c}
                      onChange={(e) => setHariInputs(s => ({ ...s, c: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && applyHariTriangle()}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4 w-full">
                <button
                  onClick={() => setHariPrompt(null)}
                  className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                >
                  Abort
                </button>
                <button
                  onClick={applyHariTriangle}
                  className="flex-[2] py-5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-[1.5rem] text-[12px] font-black uppercase tracking-[0.15em] transition-all shadow-2xl shadow-blue-500/30 active:scale-95 border border-white/10"
                >
                  Draft Unified Plot
                </button>
              </div>
            </div>
          </div>
        )}

        {lineLengthPrompt && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="p-6 rounded-[2rem] bg-indigo-950/98 backdrop-blur-3xl border border-indigo-500/30 shadow-[0_32px_128px_-16px_rgba(79,70,229,0.5)] animate-in zoom-in duration-300 flex flex-col items-center">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-indigo-500 rounded-lg shadow-lg">
                  <Edit3 size={14} className="text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Rescale Segment</span>
              </div>

              <div className="relative group mb-5">
                <input
                  autoFocus
                  className="bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-black mono text-xl outline-none focus:border-indigo-500 transition-all w-32 placeholder-slate-700"
                  value={lineLengthInput}
                  onChange={(e) => setLineLengthInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyLineLength();
                    if (e.key === 'Escape') setLineLengthPrompt(null);
                  }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-500 opacity-60">M</span>
              </div>

              <div className="flex items-center space-x-2 w-full">
                <button
                  onClick={() => setLineLengthPrompt(null)}
                  className="flex-1 py-2 text-[10px] font-bold text-slate-500 hover:text-white transition-colors"
                >
                  Abort
                </button>
                <button
                  onClick={applyLineLength}
                  className="flex-[2] py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 active:scale-95 border border-white/10"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        {textPrompt && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300 p-4">
            <div className="w-full max-w-lg p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] bg-slate-900 border border-white/10 shadow-2xl flex flex-col items-center animate-in zoom-in duration-300">
              <div className="flex items-center space-x-4 mb-8">
                <div className="p-3 bg-fuchsia-500 rounded-2xl shadow-lg shadow-fuchsia-500/20">
                  <Type size={20} className="text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Annotation Engine</span>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Create World Title</h3>
                </div>
              </div>

              <input
                autoFocus
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-white font-black text-2xl outline-none focus:border-fuchsia-500 transition-all text-center mb-8 placeholder:text-slate-700"
                placeholder="Enter Title Content..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyText();
                  if (e.key === 'Escape') setTextPrompt(null);
                }}
              />

              <div className="flex items-center space-x-4 w-full">
                <button
                  onClick={() => setTextPrompt(null)}
                  className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={applyText}
                  className="flex-[2] py-5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-fuchsia-500/20 active:scale-95"
                >
                  Pin to Canvas
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}