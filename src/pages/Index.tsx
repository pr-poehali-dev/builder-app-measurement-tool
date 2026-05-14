import { useState, useRef } from 'react';
import Icon from '@/components/ui/icon';

type Tab = 'projects' | 'editor' | 'history' | 'export';
type DrawTool = 'select' | 'wall' | 'window' | 'door' | 'measure';

interface Point { x: number; y: number; }

interface Wall {
  id: string;
  start: Point;
  end: Point;
  length: number;
}

interface Opening {
  id: string;
  type: 'window' | 'door';
  wallId: string;
  t: number; // 0..1 position along wall
  width: number; // in meters
}

interface Room { id: string; name: string; floor: number; walls: Wall[]; }

interface Project {
  id: string;
  name: string;
  address: string;
  updatedAt: string;
  floors: number;
  rooms: Room[];
  measurements: Measurement[];
}

interface Measurement {
  id: string;
  value: number;
  unit: string;
  label: string;
  timestamp: string;
  source: 'manual' | 'bluetooth';
}

const ROOM_NAMES = ['Гостиная', 'Спальня', 'Кухня', 'Ванная', 'Коридор', 'Кабинет', 'Детская', 'Балкон', 'Кладовая', 'Санузел'];

function generateRooms(floors: number, roomsPerFloor: number): Room[] {
  const rooms: Room[] = [];
  for (let f = 1; f <= floors; f++) {
    for (let r = 0; r < roomsPerFloor; r++) {
      rooms.push({
        id: `f${f}r${r}_${Date.now()}`,
        name: ROOM_NAMES[r % ROOM_NAMES.length] + (floors > 1 ? ` (эт. ${f})` : ''),
        floor: f,
        walls: [],
      });
    }
  }
  return rooms;
}

const DEMO_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Кв. Ленина 14, кв. 23',
    address: 'ул. Ленина, 14, кв. 23',
    updatedAt: '14.05.2026 09:41',
    floors: 1,
    rooms: [{
      id: 'r1', name: 'Гостиная', floor: 1,
      walls: [
        { id: 'w1', start: { x: 80, y: 80 }, end: { x: 380, y: 80 }, length: 5.8 },
        { id: 'w2', start: { x: 380, y: 80 }, end: { x: 380, y: 280 }, length: 3.9 },
        { id: 'w3', start: { x: 380, y: 280 }, end: { x: 80, y: 280 }, length: 5.8 },
        { id: 'w4', start: { x: 80, y: 280 }, end: { x: 80, y: 80 }, length: 3.9 },
      ],
    }],
    measurements: [
      { id: 'm1', value: 5.8, unit: 'м', label: 'Стена A (Гостиная)', timestamp: '14.05.2026 09:15', source: 'bluetooth' },
      { id: 'm2', value: 3.9, unit: 'м', label: 'Стена B (Гостиная)', timestamp: '14.05.2026 09:18', source: 'bluetooth' },
      { id: 'm3', value: 2.7, unit: 'м', label: 'Высота потолка', timestamp: '14.05.2026 09:22', source: 'manual' },
    ],
  },
  { id: '2', name: 'Кв. Мира 8, кв. 5', address: 'пр. Мира, 8, кв. 5', updatedAt: '13.05.2026 16:30', floors: 1, rooms: generateRooms(1, 3), measurements: [] },
  { id: '3', name: 'Офис Садовая 22', address: 'ул. Садовая, 22, офис 4', updatedAt: '10.05.2026 11:05', floors: 2, rooms: generateRooms(2, 4), measurements: [] },
];

const DEMO_HISTORY: Measurement[] = [
  { id: 'h1', value: 5.8, unit: 'м', label: 'Стена A — Гостиная', timestamp: '14.05.2026 09:15', source: 'bluetooth' },
  { id: 'h2', value: 3.9, unit: 'м', label: 'Стена B — Гостиная', timestamp: '14.05.2026 09:18', source: 'bluetooth' },
  { id: 'h3', value: 2.7, unit: 'м', label: 'Высота потолка', timestamp: '14.05.2026 09:22', source: 'manual' },
  { id: 'h4', value: 1.2, unit: 'м', label: 'Ширина двери', timestamp: '14.05.2026 09:31', source: 'bluetooth' },
  { id: 'h5', value: 0.9, unit: 'м', label: 'Проём окна (ширина)', timestamp: '14.05.2026 09:35', source: 'bluetooth' },
  { id: 'h6', value: 1.4, unit: 'м', label: 'Проём окна (высота)', timestamp: '14.05.2026 09:36', source: 'bluetooth' },
  { id: 'h7', value: 4.2, unit: 'м', label: 'Стена C — Спальня', timestamp: '13.05.2026 16:10', source: 'bluetooth' },
  { id: 'h8', value: 3.1, unit: 'м', label: 'Стена D — Спальня', timestamp: '13.05.2026 16:14', source: 'manual' },
];

const SCALE = 50;

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function wallPixelLength(wall: Wall) {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function openingPixels(opening: Opening, wall: Wall) {
  const pxPerMeter = wallPixelLength(wall) / wall.length;
  const halfPx = (opening.width / 2) * pxPerMeter;
  const totalPx = wallPixelLength(wall);
  const center = lerp(wall.start, wall.end, opening.t);
  const dx = (wall.end.x - wall.start.x) / totalPx;
  const dy = (wall.end.y - wall.start.y) / totalPx;
  const p1 = { x: center.x - dx * halfPx, y: center.y - dy * halfPx };
  const p2 = { x: center.x + dx * halfPx, y: center.y + dy * halfPx };
  const nx = -dy;
  const ny = dx;
  return { p1, p2, nx, ny, center };
}

function closestWall(pt: Point, walls: Wall[]): { wall: Wall; t: number } | null {
  let best: { wall: Wall; t: number } | null = null;
  let bestDist = 30;
  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1) continue;
    let t = ((pt.x - wall.start.x) * dx + (pt.y - wall.start.y) * dy) / len2;
    t = Math.max(0.1, Math.min(0.9, t));
    const proj = lerp(wall.start, wall.end, t);
    const dist = Math.sqrt((pt.x - proj.x) ** 2 + (pt.y - proj.y) ** 2);
    if (dist < bestDist) { bestDist = dist; best = { wall, t }; }
  }
  return best;
}

const Index = () => {
  const [tab, setTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<Project[]>(DEMO_PROJECTS);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [btConnected, setBtConnected] = useState(false);
  const [btConnecting, setBtConnecting] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawTool>('select');
  const [walls, setWalls] = useState<Wall[]>([]);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'wall' | 'opening' | null>(null);
  const [showAddMeas, setShowAddMeas] = useState(false);
  const [newMeasVal, setNewMeasVal] = useState('');
  const [newMeasLabel, setNewMeasLabel] = useState('');
  const [exportOptions, setExportOptions] = useState({ history: true, logo: false, grid: true });
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjAddress, setNewProjAddress] = useState('');
  const [newProjFloors, setNewProjFloors] = useState(1);
  const [newProjRooms, setNewProjRooms] = useState(3);
  const canvasRef = useRef<HTMLDivElement>(null);

  const snapToGrid = (v: number) => Math.round(v / 10) * 10;
  const getCanvasPoint = (e: React.MouseEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: snapToGrid(e.clientX - rect.left), y: snapToGrid(e.clientY - rect.top) };
  };

  const openProject = (p: Project) => {
    setActiveProject(p);
    setWalls(p.rooms[0]?.walls ?? []);
    setOpenings([]);
    setSelectedId(null);
    setTab('editor');
  };

  const handleBluetooth = () => {
    if (btConnected) { setBtConnected(false); return; }
    setBtConnecting(true);
    setTimeout(() => { setBtConnecting(false); setBtConnected(true); }, 2000);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'wall') {
      setDrawStart(getCanvasPoint(e));
      setDrawing(true);
    } else if (activeTool === 'window' || activeTool === 'door') {
      const pt = getCanvasPoint(e);
      const hit = closestWall(pt, walls);
      if (hit) {
        setOpenings(prev => [...prev, {
          id: Date.now().toString(),
          type: activeTool,
          wallId: hit.wall.id,
          t: hit.t,
          width: activeTool === 'door' ? 0.9 : 1.2,
        }]);
      }
    } else if (activeTool === 'select') {
      setSelectedId(null);
      setSelectedType(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => setMousePos(getCanvasPoint(e));

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (!drawing || !drawStart || activeTool !== 'wall') return;
    const pt = getCanvasPoint(e);
    const dx = (pt.x - drawStart.x) / SCALE;
    const dy = (pt.y - drawStart.y) / SCALE;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.1) {
      setWalls(prev => [...prev, { id: Date.now().toString(), start: drawStart, end: pt, length: Math.round(len * 100) / 100 }]);
    }
    setDrawing(false);
    setDrawStart(null);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    if (selectedType === 'wall') {
      setWalls(prev => prev.filter(w => w.id !== selectedId));
      setOpenings(prev => prev.filter(o => o.wallId !== selectedId));
    } else if (selectedType === 'opening') {
      setOpenings(prev => prev.filter(o => o.id !== selectedId));
    }
    setSelectedId(null);
    setSelectedType(null);
  };

  const selectedOpening = selectedType === 'opening' ? openings.find(o => o.id === selectedId) : null;

  const startEditProject = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(p);
    setEditName(p.name);
    setEditAddress(p.address);
  };

  const saveEditProject = () => {
    if (!editingProject) return;
    setProjects(prev => prev.map(p => p.id === editingProject.id
      ? { ...p, name: editName.trim() || p.name, address: editAddress.trim() || p.address, updatedAt: new Date().toLocaleString('ru') }
      : p
    ));
    if (activeProject?.id === editingProject.id) {
      setActiveProject(prev => prev ? { ...prev, name: editName.trim() || prev.name, address: editAddress.trim() || prev.address } : null);
    }
    setEditingProject(null);
  };

  const createProject = () => {
    if (!newProjName.trim()) return;
    const np: Project = {
      id: Date.now().toString(),
      name: newProjName.trim(),
      address: newProjAddress.trim() || '',
      updatedAt: new Date().toLocaleString('ru'),
      floors: newProjFloors,
      rooms: generateRooms(newProjFloors, newProjRooms),
      measurements: [],
    };
    setProjects(prev => [np, ...prev]);
    setShowNewProject(false);
    setNewProjName('');
    setNewProjAddress('');
    setNewProjFloors(1);
    setNewProjRooms(3);
    openProject(np);
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProject?.id === id) { setActiveProject(null); setTab('projects'); }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'projects', label: 'Проекты', icon: 'FolderOpen' },
    { id: 'editor', label: 'Редактор', icon: 'PenTool' },
    { id: 'history', label: 'История', icon: 'Clock' },
    { id: 'export', label: 'Экспорт', icon: 'Download' },
  ];

  const tools: { id: DrawTool; icon: string; label: string }[] = [
    { id: 'select', icon: 'MousePointer2', label: 'Выбор' },
    { id: 'wall', icon: 'Minus', label: 'Стена' },
    { id: 'window', icon: 'AppWindow', label: 'Окно' },
    { id: 'door', icon: 'DoorOpen', label: 'Дверь' },
    { id: 'measure', icon: 'Ruler', label: 'Размер' },
  ];

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
              <Icon name="Ruler" size={14} className="text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-wide">ПланМер</span>
          </div>
          {activeProject && tab === 'editor' && (
            <>
              <span className="text-muted-foreground text-xs">/</span>
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">{activeProject.name}</span>
            </>
          )}
        </div>
        <button
          onClick={handleBluetooth}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all border ${
            btConnected ? 'bg-primary/10 border-primary/40 text-primary'
            : btConnecting ? 'bg-secondary border-border text-muted-foreground'
            : 'bg-secondary border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
          }`}
        >
          <Icon name="Bluetooth" size={13} className={btConnected || btConnecting ? 'bluetooth-pulse' : ''} />
          {btConnected ? 'Подключено' : btConnecting ? 'Подключение...' : 'Bluetooth'}
        </button>
      </header>

      {/* Nav */}
      <nav className="flex border-b border-border bg-card shrink-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-medium transition-all border-b-2 ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-hidden relative">

        {/* ── PROJECTS ── */}
        {tab === 'projects' && (
          <div className="h-full overflow-y-auto p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">Проекты</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{projects.length} объекта</p>
              </div>
              <button onClick={() => setShowNewProject(true)}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded text-xs font-semibold hover:bg-primary/90 transition-colors">
                <Icon name="Plus" size={13} />
                Новый проект
              </button>
            </div>
            <div className="grid gap-3">
              {projects.map((p, i) => (
                <div key={p.id} onClick={() => openProject(p)}
                  className="bg-card border border-border rounded p-4 cursor-pointer hover:border-primary/40 transition-all group animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground ml-4">{p.address}</p>
                      <div className="flex items-center gap-4 mt-3 ml-4">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Icon name="Layers" size={11} />
                          {p.floors} {p.floors === 1 ? 'этаж' : p.floors < 5 ? 'этажа' : 'этажей'}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Icon name="LayoutPanelLeft" size={11} />
                          {p.rooms.length} помещ.
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Icon name="Ruler" size={11} />
                          {p.measurements.length} замеров
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-1 ml-3 shrink-0">
                      <p className="text-xs text-muted-foreground">{p.updatedAt}</p>
                      <button onClick={e => startEditProject(p, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground ml-1">
                        <Icon name="Pencil" size={12} />
                      </button>
                      <button onClick={e => deleteProject(p.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Icon name="Trash2" size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── EDITOR ── */}
        {tab === 'editor' && (
          <div className="h-full flex flex-col animate-fade-in">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card shrink-0 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1 font-medium">Инструмент:</span>
              {tools.map(tool => (
                <button key={tool.id} onClick={() => setActiveTool(tool.id)} title={tool.label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all ${
                    activeTool === tool.id ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}>
                  <Icon name={tool.icon} size={13} />
                  <span className="hidden sm:inline">{tool.label}</span>
                </button>
              ))}
              <div className="flex-1" />
              {selectedId && (
                <button onClick={deleteSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-destructive hover:bg-destructive/10 transition-all">
                  <Icon name="Trash2" size={13} />
                  Удалить
                </button>
              )}
              <button onClick={() => setShowAddMeas(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-secondary text-foreground hover:bg-secondary/80 transition-all border border-border">
                <Icon name="Plus" size={13} />
                Замер
              </button>
              {walls.length > 0 && (
                <button onClick={() => { setWalls([]); setOpenings([]); setSelectedId(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-muted-foreground hover:text-destructive transition-all">
                  <Icon name="RotateCcw" size={13} />
                  Очистить
                </button>
              )}
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Canvas */}
              <div className="flex-1 relative overflow-hidden">
                <div ref={canvasRef}
                  className="w-full h-full canvas-grid-major select-none"
                  style={{ cursor: activeTool === 'wall' ? 'crosshair' : activeTool === 'window' || activeTool === 'door' ? 'cell' : 'default' }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}>
                  <svg className="absolute inset-0 w-full h-full">
                    {/* Walls */}
                    {walls.map(wall => {
                      const wallOpenings = openings.filter(o => o.wallId === wall.id);
                      const isSelected = selectedId === wall.id && selectedType === 'wall';
                      const totalPx = wallPixelLength(wall);
                      const dx = totalPx > 0 ? (wall.end.x - wall.start.x) / totalPx : 0;
                      const dy = totalPx > 0 ? (wall.end.y - wall.start.y) / totalPx : 0;

                      return (
                        <g key={wall.id}>
                          {/* Main wall line */}
                          <line
                            x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y}
                            stroke={isSelected ? 'hsl(43,96%,56%)' : 'hsl(210,20%,72%)'}
                            strokeWidth={isSelected ? 5 : 3.5}
                            strokeLinecap="round"
                            style={{ cursor: 'pointer' }}
                            onClick={e => { e.stopPropagation(); setSelectedId(wall.id === selectedId ? null : wall.id); setSelectedType('wall'); }}
                          />
                          {/* Openings rendered on top */}
                          {wallOpenings.map(op => {
                            const { p1, p2, nx, ny } = openingPixels(op, wall);
                            const isOpSel = selectedId === op.id && selectedType === 'opening';
                            const opColor = op.type === 'window' ? 'hsl(200,80%,60%)' : 'hsl(30,90%,55%)';
                            return (
                              <g key={op.id} style={{ cursor: 'pointer' }}
                                onClick={e => { e.stopPropagation(); setSelectedId(isOpSel ? null : op.id); setSelectedType('opening'); }}>
                                {/* Gap in wall (background color) */}
                                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                                  stroke="hsl(220,16%,8%)" strokeWidth={6} />
                                {op.type === 'window' ? (
                                  <>
                                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                                      stroke={isOpSel ? 'hsl(43,96%,80%)' : opColor} strokeWidth={2} />
                                    <line x1={p1.x + nx * 4} y1={p1.y + ny * 4} x2={p1.x - nx * 4} y2={p1.y - ny * 4}
                                      stroke={isOpSel ? 'hsl(43,96%,80%)' : opColor} strokeWidth={1.5} />
                                    <line x1={p2.x + nx * 4} y1={p2.y + ny * 4} x2={p2.x - nx * 4} y2={p2.y - ny * 4}
                                      stroke={isOpSel ? 'hsl(43,96%,80%)' : opColor} strokeWidth={1.5} />
                                  </>
                                ) : (
                                  <>
                                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                                      stroke={isOpSel ? 'hsl(43,96%,80%)' : opColor} strokeWidth={2} />
                                    {/* Door arc hint */}
                                    <path
                                      d={`M ${p1.x} ${p1.y} Q ${p1.x + nx * 18} ${p1.y + ny * 18} ${p1.x + dx * wallPixelLength(wall) * 0.001 + nx * 18} ${p1.y + dy * wallPixelLength(wall) * 0.001 + ny * 18}`}
                                      fill="none"
                                      stroke={isOpSel ? 'hsl(43,96%,80%)' : opColor}
                                      strokeWidth={1}
                                      strokeDasharray="3 2"
                                      opacity={0.6}
                                    />
                                  </>
                                )}
                              </g>
                            );
                          })}
                          {/* Length label */}
                          <text
                            x={(wall.start.x + wall.end.x) / 2}
                            y={(wall.start.y + wall.end.y) / 2 - 10}
                            fill="hsl(43,96%,56%)"
                            fontSize="10"
                            fontFamily="IBM Plex Mono, monospace"
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            {wall.length}м
                          </text>
                        </g>
                      );
                    })}

                    {/* Drawing preview */}
                    {drawing && drawStart && activeTool === 'wall' && (
                      <line x1={drawStart.x} y1={drawStart.y} x2={mousePos.x} y2={mousePos.y}
                        stroke="hsl(43,96%,56%)" strokeWidth={2} strokeDasharray="6 3" opacity={0.7} strokeLinecap="round" />
                    )}

                    {/* Window/Door cursor hint */}
                    {(activeTool === 'window' || activeTool === 'door') && walls.length > 0 && (() => {
                      const hit = closestWall(mousePos, walls);
                      if (!hit) return null;
                      const mockOp: Opening = { id: '_preview', type: activeTool, wallId: hit.wall.id, t: hit.t, width: activeTool === 'door' ? 0.9 : 1.2 };
                      const { p1, p2 } = openingPixels(mockOp, hit.wall);
                      return (
                        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                          stroke={activeTool === 'window' ? 'hsl(200,80%,60%)' : 'hsl(30,90%,55%)'}
                          strokeWidth={2} opacity={0.5} />
                      );
                    })()}
                  </svg>

                  {walls.length === 0 && !drawing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-center opacity-25">
                        <Icon name="PenTool" size={36} className="mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Выберите «Стена» и нарисуйте план</p>
                        <p className="text-xs text-muted-foreground mt-1">Затем добавьте окна и двери</p>
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 font-mono text-xs text-muted-foreground/40 pointer-events-none">
                    {(mousePos.x / SCALE).toFixed(2)}м × {(mousePos.y / SCALE).toFixed(2)}м
                  </div>
                  {btConnected && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded px-2 py-1 pointer-events-none">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary bluetooth-pulse" />
                      <span className="text-xs text-primary font-medium">BT активен</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Properties panel */}
              {selectedId && (
                <div className="w-56 border-l border-border bg-card p-4 shrink-0 animate-fade-in overflow-y-auto">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Свойства</p>
                  {selectedType === 'wall' && (() => {
                    const w = walls.find(x => x.id === selectedId);
                    if (!w) return null;
                    return (
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Тип</p>
                          <p className="text-xs font-medium">Стена</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Длина</p>
                          <p className="text-sm font-mono font-semibold text-primary">{w.length} м</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Координаты</p>
                          <p className="text-xs font-mono text-muted-foreground">
                            ({(w.start.x / SCALE).toFixed(1)}, {(w.start.y / SCALE).toFixed(1)}) →<br />
                            ({(w.end.x / SCALE).toFixed(1)}, {(w.end.y / SCALE).toFixed(1)})
                          </p>
                        </div>
                        <div className="pt-2 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">Проёмы на стене</p>
                          {openings.filter(o => o.wallId === w.id).length === 0
                            ? <p className="text-xs text-muted-foreground/60">нет</p>
                            : openings.filter(o => o.wallId === w.id).map(o => (
                              <div key={o.id} className="flex items-center gap-2 py-1">
                                <Icon name={o.type === 'window' ? 'AppWindow' : 'DoorOpen'} size={11}
                                  className={o.type === 'window' ? 'text-blue-400' : 'text-orange-400'} />
                                <span className="text-xs">{o.type === 'window' ? 'Окно' : 'Дверь'} {o.width}м</span>
                              </div>
                            ))
                          }
                        </div>
                        <button onClick={deleteSelected}
                          className="w-full mt-2 py-1.5 rounded text-xs text-destructive border border-destructive/20 hover:bg-destructive/10 transition-colors">
                          Удалить стену
                        </button>
                      </div>
                    );
                  })()}
                  {selectedType === 'opening' && selectedOpening && (() => {
                    return (
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Тип</p>
                          <div className="flex items-center gap-2">
                            <Icon name={selectedOpening.type === 'window' ? 'AppWindow' : 'DoorOpen'} size={13}
                              className={selectedOpening.type === 'window' ? 'text-blue-400' : 'text-orange-400'} />
                            <p className="text-xs font-medium">{selectedOpening.type === 'window' ? 'Окно' : 'Дверь'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Ширина (м)</p>
                          <input
                            type="number" step="0.05" min="0.5" max="3"
                            value={selectedOpening.width}
                            onChange={e => setOpenings(prev => prev.map(o =>
                              o.id === selectedOpening.id ? { ...o, width: parseFloat(e.target.value) || o.width } : o
                            ))}
                            className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-sm font-mono outline-none focus:border-primary transition-colors text-foreground"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Позиция на стене</p>
                          <p className="text-xs font-mono text-muted-foreground">{Math.round(selectedOpening.t * 100)}%</p>
                        </div>
                        <button onClick={deleteSelected}
                          className="w-full mt-2 py-1.5 rounded text-xs text-destructive border border-destructive/20 hover:bg-destructive/10 transition-colors">
                          Удалить проём
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-1.5 border-t border-border bg-card text-xs text-muted-foreground shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-0.5 bg-[hsl(210,20%,72%)] rounded" />
                Стена
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-0.5 bg-blue-400 rounded" />
                Окно
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-0.5 bg-orange-400 rounded" />
                Дверь
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-primary/20 border border-primary/40" />
                Выбранный
              </span>
              <div className="flex-1" />
              <span className="font-mono text-xs opacity-40">{walls.length} ст. / {openings.filter(o => o.type === 'window').length} окн. / {openings.filter(o => o.type === 'door').length} дв.</span>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <div className="h-full overflow-y-auto p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">История измерений</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{DEMO_HISTORY.length} записей</p>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-secondary text-foreground hover:bg-secondary/70 transition-colors border border-border">
                <Icon name="Filter" size={12} />
                Фильтр
              </button>
            </div>
            <div className="space-y-1">
              {DEMO_HISTORY.map((m, i) => (
                <div key={m.id}
                  className="flex items-center gap-4 px-4 py-3 rounded bg-card border border-border hover:border-primary/20 transition-all animate-slide-up"
                  style={{ animationDelay: `${i * 40}ms` }}>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.source === 'bluetooth' ? 'bg-primary' : 'bg-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.timestamp}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-foreground shrink-0">{m.value} <span className="text-xs text-muted-foreground font-normal">{m.unit}</span></span>
                  <div className={`px-2 py-0.5 rounded text-xs shrink-0 ${m.source === 'bluetooth' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {m.source === 'bluetooth' ? 'BT' : 'Ручной'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── EXPORT ── */}
        {tab === 'export' && (
          <div className="h-full overflow-y-auto p-6 animate-fade-in">
            <div className="mb-6">
              <h2 className="text-lg font-semibold">Экспорт</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Выберите формат и параметры</p>
            </div>
            <div className="grid gap-3 mb-6">
              {[
                { icon: 'FileText', label: 'PDF отчёт', desc: 'Полный отчёт с планами и замерами', accent: true },
                { icon: 'Table', label: 'Excel таблица', desc: 'Список всех измерений по проектам', accent: false },
                { icon: 'Image', label: 'PNG изображение', desc: 'Картинка плана для согласования', accent: false },
                { icon: 'Code', label: 'DXF чертёж', desc: 'Для AutoCAD и других САПР', accent: false },
              ].map((fmt, i) => (
                <div key={fmt.label}
                  className="flex items-center gap-4 px-4 py-4 rounded bg-card border border-border hover:border-primary/40 cursor-pointer transition-all group animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms` }}>
                  <div className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${fmt.accent ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:text-foreground transition-colors'}`}>
                    <Icon name={fmt.icon} size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{fmt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmt.desc}</p>
                  </div>
                  <Icon name="ChevronRight" size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              ))}
            </div>
            <div className="bg-card border border-border rounded p-4">
              <p className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Настройки</p>
              <div className="space-y-3">
                {([
                  { key: 'history', label: 'Включить историю замеров' },
                  { key: 'logo', label: 'Добавить логотип компании' },
                  { key: 'grid', label: 'Показать сетку координат' },
                ] as { key: keyof typeof exportOptions; label: string }[]).map(opt => (
                  <label key={opt.key} className="flex items-center gap-3 cursor-pointer group">
                    <div onClick={() => setExportOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${exportOptions[opt.key] ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/40'}`}>
                      {exportOptions[opt.key] && <Icon name="Check" size={10} className="text-primary-foreground" />}
                    </div>
                    <span className="text-xs text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: Edit project ── */}
        {editingProject && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20 animate-fade-in">
            <div className="bg-card border border-border rounded-lg p-6 w-80 shadow-2xl animate-slide-up">
              <h3 className="text-sm font-semibold mb-4">Редактировать проект</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Название</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Адрес</label>
                  <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setEditingProject(null)}
                  className="flex-1 bg-secondary text-foreground py-2 rounded text-xs font-medium hover:bg-secondary/70 transition-colors">
                  Отмена
                </button>
                <button onClick={saveEditProject}
                  className="flex-1 bg-primary text-primary-foreground py-2 rounded text-xs font-semibold hover:bg-primary/90 transition-colors">
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: New project ── */}
        {showNewProject && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20 animate-fade-in">
            <div className="bg-card border border-border rounded-lg p-6 w-96 shadow-2xl animate-slide-up">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center shrink-0">
                  <Icon name="Plus" size={12} className="text-primary-foreground" />
                </div>
                <h3 className="text-sm font-semibold">Новый проект</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Название *</label>
                  <input type="text" value={newProjName} onChange={e => setNewProjName(e.target.value)}
                    placeholder="Кв. Советская 5, кв. 12"
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Адрес</label>
                  <input type="text" value={newProjAddress} onChange={e => setNewProjAddress(e.target.value)}
                    placeholder="ул. Советская, 5, кв. 12"
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground" />
                </div>

                {/* Floors & Rooms counters */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1 block">
                      <Icon name="Layers" size={11} />
                      Этажей
                    </label>
                    <div className="flex items-center gap-0 border border-border rounded overflow-hidden">
                      <button
                        onClick={() => setNewProjFloors(f => Math.max(1, f - 1))}
                        className="w-9 h-9 flex items-center justify-center bg-secondary hover:bg-secondary/60 text-foreground transition-colors text-sm font-bold shrink-0">
                        −
                      </button>
                      <span className="flex-1 text-center font-mono text-sm font-semibold text-foreground bg-secondary/40 py-1.5">
                        {newProjFloors}
                      </span>
                      <button
                        onClick={() => setNewProjFloors(f => Math.min(20, f + 1))}
                        className="w-9 h-9 flex items-center justify-center bg-secondary hover:bg-secondary/60 text-foreground transition-colors text-sm font-bold shrink-0">
                        +
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-1 text-center">макс. 20</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1 block">
                      <Icon name="LayoutPanelLeft" size={11} />
                      Помещений на этаже
                    </label>
                    <div className="flex items-center gap-0 border border-border rounded overflow-hidden">
                      <button
                        onClick={() => setNewProjRooms(r => Math.max(1, r - 1))}
                        className="w-9 h-9 flex items-center justify-center bg-secondary hover:bg-secondary/60 text-foreground transition-colors text-sm font-bold shrink-0">
                        −
                      </button>
                      <span className="flex-1 text-center font-mono text-sm font-semibold text-foreground bg-secondary/40 py-1.5">
                        {newProjRooms}
                      </span>
                      <button
                        onClick={() => setNewProjRooms(r => Math.min(10, r + 1))}
                        className="w-9 h-9 flex items-center justify-center bg-secondary hover:bg-secondary/60 text-foreground transition-colors text-sm font-bold shrink-0">
                        +
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-1 text-center">макс. 10</p>
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-secondary/40 rounded p-3 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Будет создано:</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <span className="w-5 h-5 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <Icon name="Layers" size={10} className="text-primary" />
                      </span>
                      {newProjFloors} {newProjFloors === 1 ? 'этаж' : newProjFloors < 5 ? 'этажа' : 'этажей'}
                    </span>
                    <Icon name="ChevronRight" size={10} className="text-muted-foreground" />
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <span className="w-5 h-5 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <Icon name="LayoutPanelLeft" size={10} className="text-primary" />
                      </span>
                      {newProjFloors * newProjRooms} помещений
                    </span>
                  </div>
                  {newProjFloors > 1 && (
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      Названия: {ROOM_NAMES.slice(0, newProjRooms).join(', ')}{newProjRooms > ROOM_NAMES.length ? '...' : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => { setShowNewProject(false); setNewProjFloors(1); setNewProjRooms(3); }}
                  className="flex-1 bg-secondary text-foreground py-2 rounded text-xs font-medium hover:bg-secondary/70 transition-colors">
                  Отмена
                </button>
                <button onClick={createProject} disabled={!newProjName.trim()}
                  className="flex-1 bg-primary text-primary-foreground py-2 rounded text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Создать проект
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: Add measurement ── */}
        {showAddMeas && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20 animate-fade-in">
            <div className="bg-card border border-border rounded-lg p-6 w-80 shadow-2xl animate-slide-up">
              <h3 className="text-sm font-semibold mb-4">Добавить замер</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
                  <input type="text" value={newMeasLabel} onChange={e => setNewMeasLabel(e.target.value)}
                    placeholder="Стена A — Гостиная"
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Значение (м)</label>
                  <input type="number" step="0.01" value={newMeasVal} onChange={e => setNewMeasVal(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm font-mono outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowAddMeas(false)}
                  className="flex-1 bg-secondary text-foreground py-2 rounded text-xs font-medium hover:bg-secondary/70 transition-colors">
                  Отмена
                </button>
                <button onClick={() => { setShowAddMeas(false); setNewMeasVal(''); setNewMeasLabel(''); }}
                  className="flex-1 bg-primary text-primary-foreground py-2 rounded text-xs font-semibold hover:bg-primary/90 transition-colors">
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-4 py-2 border-t border-border bg-card text-xs text-muted-foreground shrink-0">
        <span className="font-mono">
          {tab === 'editor' && `${walls.length} стен · ${openings.length} проёмов`}
          {tab === 'projects' && `${projects.length} проектов`}
          {tab === 'history' && `${DEMO_HISTORY.length} записей`}
          {tab === 'export' && 'Готово к экспорту'}
        </span>
        <div className="flex items-center gap-3">
          {btConnected && (
            <span className="flex items-center gap-1 text-primary">
              <Icon name="Bluetooth" size={10} />
              Лазерный дальномер
            </span>
          )}
          <span className="font-mono opacity-40">v1.1</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;