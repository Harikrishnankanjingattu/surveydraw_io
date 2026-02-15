
export type Tool = 'SELECT' | 'POINT' | 'LINE' | 'TRIANGLE' | 'HARITRIANGLE' | 'PAN' | 'ERASER' | 'TEXT';

export interface Point {
  id: string;
  x: number; // World X in meters
  y: number; // World Y in meters
  label: string;
  color: string;
}

export interface Line {
  id: string;
  p1: string; // Point ID
  p2: string; // Point ID
  color: string;
  thickness: number;
}

export interface Triangle {
  id: string;
  points: [string, string, string]; // Point IDs
  name: string;
  fillColor: string;
  borderColor: string;
  opacity: number;
  area: number;
}

export interface TextObject {
  id: string;
  x: number;
  y: number;
  content: string;
  color: string;
  size: number;
}

export interface AppState {
  points: Point[];
  lines: Line[];
  triangles: Triangle[];
  texts: TextObject[];
  selection: {
    type: 'POINT' | 'LINE' | 'TRIANGLE' | 'TEXT' | null;
    id: string | null;
  };
  offset: { x: number; y: number };
  scale: number;
  gridVisible: boolean;
  snapToGrid: boolean;
  theme: 'dark' | 'light';
  activeTool: Tool;
  sheetMode: 'infinite' | 'A4_PORTRAIT' | 'A4_LANDSCAPE' | 'A6_PORTRAIT' | 'A6_LANDSCAPE';
  borderWidth: number;
  borderColor: string;
  isInitialized: boolean;
}

export type Action =
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'ADD_POINT'; payload: Point }
  | { type: 'ADD_LINE'; payload: Line }
  | { type: 'ADD_TRIANGLE'; payload: Triangle }
  | { type: 'DELETE_ITEM'; payload: { type: 'POINT' | 'LINE' | 'TRIANGLE', id: string } }
  | { type: 'UPDATE_TRIANGLE'; payload: Partial<Triangle> & { id: string } }
  | { type: 'UPDATE_POINT'; payload: Partial<Point> & { id: string } }
  | { type: 'SELECT_ITEM'; payload: { type: 'POINT' | 'LINE' | 'TRIANGLE' | 'TEXT' | null, id: string | null } }
  | { type: 'SET_TOOL'; payload: Tool }
  | { type: 'SET_VIEW'; payload: { offset?: { x: number, y: number }, scale?: number } }
  | { type: 'TOGGLE_GRID' }
  | { type: 'TOGGLE_SNAP' }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_SHEET_MODE'; payload: AppState['sheetMode'] }
  | { type: 'SET_BORDER'; payload: { width: number, color: string } };
