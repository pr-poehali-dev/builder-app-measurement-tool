import { useState, useRef } from 'react';
import Icon from '@/components/ui/icon';

type Tab = 'projects' | 'editor' | 'history' | 'export';

interface Point { x: number; y: number; }
interface Wall { id: string; start: Point; end: Point; length: number; }
interface Room { id: string; name: string; walls: Wall[]; }
interface Project {
  id: string;
  name: string;
  address: string;
  updatedAt: string;
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

const DEMO_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Кв. Ленина 14, кв. 23',
    address: 'ул. Ленина, 14, кв. 23',
    updatedAt: '14.05.2026 09:41',
    rooms: [
      {
        id: 'r1',
        name: 'Гостиная',
        walls: [
          { id: 'w1', start: { x: 60, y: 60 }, end: { x: 360, y: 60 }, length: 5.8 },
          { id: 'w2', start: { x: 360, y: 60 }, end: { x: 360, y: 260 }, length: 3.9 },
          { id: 'w3', start: { x: 360, y: 260 }, end: { x: 60, y: 260 }, length: 5.8 },
          { id: 'w4', start: { x: 60, y: 260 }, end: { x: 60, y: 60 }, length: 3.9 },
        ],
      },
    ],
    measurements: [
      { id: 'm1', value: 5.8, unit: 'м', label: 'Стена A (Гостиная)', timestamp: '14.05.2026 09:15', source: 'bluetooth' },
      { id: 'm2', value: 3.9, unit: 'м', label: 'Стена B (Гостиная)', timestamp: '14.05.2026 09:18', source: 'bluetooth' },
      { id: 'm3', value: 2.7, unit: 'м', label: 'Высота потолка', timestamp: '14.05.2026 09:22', source: 'manual' },
    ],
  },
  {
    id: '2',
    name: 'Кв. Мира 8, кв. 5',
    address: 'пр. Мира, 8, кв. 5',
    updatedAt: '13.05.2026 16:30',
    rooms: [],
    measurements: [],
  },
  {
    id: '3',
    name: 'Офис Садовая 22',
    address: 'ул. Садовая, 22, офис 4',
    updatedAt: '10.05.2026 11:05',
    rooms: [],
    measurements: [],
  },
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

type DrawTool = 'select' | 'wall' | 'measure' | 'text';

const Index = () => {
  const [tab, setTab] = useState<Tab>('projects');
  const [projects] = useState<Project[]>(DEMO_PROJECTS);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [btConnected, setBtConnected] = useState(false);
  const [btConnecting, setBtConnecting] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawTool>('select');
  const [walls, setWalls] = useState<Wall[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [selectedWall, setSelectedWall] = useState<string | null>(null);
  const [newMeasurement, setNewMeasurement] = useState('');
  const [newMeasLabel, setNewMeasLabel] = useState('');
  const [showAddMeas, setShowAddMeas] = useState(false);
  const [exportOptions, setExportOptions] = useState({ history: true, logo: false, grid: true });
  const canvasRef = useRef<HTMLDivElement>(null);
  const SCALE = 50;

  const openProject = (p: Project) => {
    setActiveProject(p);
    if (p.rooms[0]?.walls) setWalls(p.rooms[0].walls);
    else setWalls([]);
    setTab('editor');
  };

  const handleBluetooth = () => {
    if (btConnected) { setBtConnected(false); return; }
    setBtConnecting(true);
    setTimeout(() => { setBtConnecting(false); setBtConnected(true); }, 2000);
  };

  const snapToGrid = (v: number) => Math.round(v / 10) * 10;

  const getCanvasPoint = (e: React.MouseEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: snapToGrid(e.clientX - rect.left), y: snapToGrid(e.clientY - rect.top) };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool !== 'wall') return;
    setDrawStart(getCanvasPoint(e));
    setDrawing(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    setMousePos(getCanvasPoint(e));
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (!drawing || !drawStart || activeTool !== 'wall') return;
    const pt = getCanvasPoint(e);
    const dx = (pt.x - drawStart.x) / SCALE;
    const dy = (pt.y - drawStart.y) / SCALE;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.1) {
      setWalls(prev => [...prev, {
        id: Date.now().toString(),
        start: drawStart,
        end: pt,
        length: Math.round(len * 100) / 100,
      }]);
    }
    setDrawing(false);
    setDrawStart(null);
  };

  const deleteWall = () => {
    if (selectedWall) {
      setWalls(prev => prev.filter(w => w.id !== selectedWall));
      setSelectedWall(null);
    }
  };

  const addMeasurement = () => {
    setShowAddMeas(false);
    setNewMeasurement('');
    setNewMeasLabel('');
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'projects', label: 'Проекты', icon: 'FolderOpen' },
    { id: 'editor', label: 'Редактор', icon: 'PenTool' },
    { id: 'history', label: 'История', icon: 'Clock' },
    { id: 'export', label: 'Экспорт', icon: 'Download' },
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
              <span className="text-xs text-muted-foreground truncate max-w-[160px]">{activeProject.name}</span>
            </>
          )}
        </div>
        <button
          onClick={handleBluetooth}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all border ${
            btConnected
              ? 'bg-primary/10 border-primary/40 text-primary'
              : btConnecting
              ? 'bg-secondary border-border text-muted-foreground'
              : 'bg-secondary border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
          }`}
        >
          <Icon
            name="Bluetooth"
            size={13}
            className={btConnected || btConnecting ? 'bluetooth-pulse' : ''}
          />
          {btConnected ? 'Подключено' : btConnecting ? 'Подключение...' : 'Bluetooth'}
        </button>
      </header>

      {/* Nav */}
      <nav className="flex border-b border-border bg-card shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-medium transition-all border-b-2 ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-hidden relative">

        {/* PROJECTS */}
        {tab === 'projects' && (
          <div className="h-full overflow-y-auto p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">Проекты</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{projects.length} объекта</p>
              </div>
              <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded text-xs font-semibold hover:bg-primary/90 transition-colors">
                <Icon name="Plus" size={13} />
                Новый проект
              </button>
            </div>
            <div className="grid gap-3">
              {projects.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => openProject(p)}
                  className="bg-card border border-border rounded p-4 cursor-pointer hover:border-primary/40 transition-all group animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground ml-4">{p.address}</p>
                      <div className="flex items-center gap-4 mt-3 ml-4">
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
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-xs text-muted-foreground">{p.updatedAt}</p>
                      <Icon name="ChevronRight" size={14} className="text-muted-foreground group-hover:text-primary mt-2 ml-auto transition-colors" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EDITOR */}
        {tab === 'editor' && (
          <div className="h-full flex flex-col animate-fade-in">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card shrink-0 flex-wrap">
              <span className="text-xs text-muted-foreground mr-2 font-medium">Инструмент:</span>
              {([
                { id: 'select', icon: 'MousePointer2', label: 'Выбор' },
                { id: 'wall', icon: 'Minus', label: 'Стена' },
                { id: 'measure', icon: 'Ruler', label: 'Размер' },
                { id: 'text', icon: 'Type', label: 'Заметка' },
              ] as { id: DrawTool; icon: string; label: string }[]).map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  title={tool.label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all ${
                    activeTool === tool.id
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <Icon name={tool.icon} size={13} />
                  <span className="hidden sm:inline">{tool.label}</span>
                </button>
              ))}
              <div className="flex-1" />
              {selectedWall && (
                <button onClick={deleteWall} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-destructive hover:bg-destructive/10 transition-all">
                  <Icon name="Trash2" size={13} />
                  Удалить
                </button>
              )}
              <button
                onClick={() => setShowAddMeas(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-secondary text-foreground hover:bg-secondary/80 transition-all"
              >
                <Icon name="Plus" size={13} />
                Замер
              </button>
              {walls.length > 0 && (
                <button
                  onClick={() => { setWalls([]); setSelectedWall(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-muted-foreground hover:text-destructive transition-all"
                >
                  <Icon name="RotateCcw" size={13} />
                  Очистить
                </button>
              )}
            </div>

            {/* Canvas */}
            <div className="flex-1 relative overflow-hidden">
              <div
                ref={canvasRef}
                className="w-full h-full canvas-grid-major select-none"
                style={{ cursor: activeTool === 'wall' ? 'crosshair' : 'default' }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
              >
                <svg className="absolute inset-0 w-full h-full">
                  {walls.map(wall => (
                    <g key={wall.id}>
                      <line
                        x1={wall.start.x} y1={wall.start.y}
                        x2={wall.end.x} y2={wall.end.y}
                        stroke={selectedWall === wall.id ? 'hsl(43,96%,56%)' : 'hsl(210,20%,72%)'}
                        strokeWidth={selectedWall === wall.id ? 4 : 2.5}
                        strokeLinecap="round"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); setSelectedWall(wall.id === selectedWall ? null : wall.id); }}
                      />
                      <text
                        x={(wall.start.x + wall.end.x) / 2}
                        y={(wall.start.y + wall.end.y) / 2 - 8}
                        fill="hsl(43,96%,56%)"
                        fontSize="11"
                        fontFamily="IBM Plex Mono, monospace"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {wall.length}м
                      </text>
                    </g>
                  ))}
                  {drawing && drawStart && activeTool === 'wall' && (
                    <line
                      x1={drawStart.x} y1={drawStart.y}
                      x2={mousePos.x} y2={mousePos.y}
                      stroke="hsl(43,96%,56%)"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      opacity={0.7}
                      strokeLinecap="round"
                    />
                  )}
                </svg>

                {walls.length === 0 && !drawing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-center opacity-25">
                      <Icon name="PenTool" size={36} className="mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Выберите инструмент «Стена»</p>
                      <p className="text-xs text-muted-foreground mt-1">и нарисуйте план помещения</p>
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

            {/* Add measurement modal */}
            {showAddMeas && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 animate-fade-in">
                <div className="bg-card border border-border rounded-lg p-6 w-80 shadow-2xl animate-slide-up">
                  <h3 className="text-sm font-semibold mb-4">Добавить замер</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
                      <input
                        type="text"
                        value={newMeasLabel}
                        onChange={e => setNewMeasLabel(e.target.value)}
                        placeholder="Стена A — Гостиная"
                        className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Значение (м)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newMeasurement}
                        onChange={e => setNewMeasurement(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm font-mono outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-5">
                    <button
                      onClick={() => setShowAddMeas(false)}
                      className="flex-1 bg-secondary text-foreground py-2 rounded text-xs font-medium hover:bg-secondary/70 transition-colors"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={addMeasurement}
                      className="flex-1 bg-primary text-primary-foreground py-2 rounded text-xs font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
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
                <div
                  key={m.id}
                  className="flex items-center gap-4 px-4 py-3 rounded bg-card border border-border hover:border-primary/20 transition-all animate-slide-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.source === 'bluetooth' ? 'bg-primary' : 'bg-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.timestamp}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-foreground shrink-0">{m.value} <span className="text-xs text-muted-foreground font-normal">{m.unit}</span></span>
                  <div className={`px-2 py-0.5 rounded text-xs shrink-0 ${
                    m.source === 'bluetooth'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary text-muted-foreground'
                  }`}>
                    {m.source === 'bluetooth' ? 'BT' : 'Ручной'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXPORT */}
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
                <div
                  key={fmt.label}
                  className="flex items-center gap-4 px-4 py-4 rounded bg-card border border-border hover:border-primary/40 cursor-pointer transition-all group animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
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
                    <div
                      onClick={() => setExportOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${exportOptions[opt.key] ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/40'}`}
                    >
                      {exportOptions[opt.key] && <Icon name="Check" size={10} className="text-primary-foreground" />}
                    </div>
                    <span className="text-xs text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-4 py-2 border-t border-border bg-card text-xs text-muted-foreground shrink-0">
        <span className="font-mono">
          {tab === 'editor' && `${walls.length} стен на плане`}
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
          <span className="font-mono opacity-40">v1.0</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
