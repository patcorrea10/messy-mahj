/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MahjongTile, GameState } from './types';
import { dealGame, sortTiles } from './mahjongLogic';
import { RefreshCw, Layers, ArrowRight, Trash2, SortAsc, PlusCircle, Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const GameAudio = {
  ctx: null as AudioContext | null,
  enabled: true,
  
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  },

  tink() {
    if (!this.enabled) return;
    const ctx = this.init();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400 + Math.random() * 100, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  },

  swish() {
    if (!this.enabled) return;
    const ctx = this.init();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  },

  sparkle() {
    if (!this.enabled) return;
    const ctx = this.init();
    const now = ctx.currentTime;
    for (let i = 0; i < 16; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const time = now + i * 0.05;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800 + i * 120 + Math.random() * 50, time);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.04, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.6);
    }
  }
};

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.5',
      },
    },
  }),
};

const getTileBaseStyle = (tile: MahjongTile, isFaceDown?: boolean, highContrast?: boolean) => {
  if (highContrast) {
    if (isFaceDown) {
      return 'bg-slate-900 border-slate-950 border-b-4 border-r shadow-md rounded-lg';
    }
    return 'bg-white border-slate-300 border-b-4 border-r shadow-md rounded-lg';
  }
  
  // Oh My Mahjong 3D Style
  return 'rounded-lg transition-all select-none relative overflow-visible';
};

const getTile3DStyle = (isFaceDown?: boolean, highContrast?: boolean) => {
  if (highContrast) return {};
  
  if (isFaceDown) {
    return {
      background: 'radial-gradient(circle at 30% 30%, #f472b6 0%, #db2777 100%)',
      boxShadow: `
        inset 0 2px 4px rgba(255,255,255,0.4),
        0 2px 0 #ffffff,
        0 5px 0 #f472b6,
        0 8px 0 #fbbf24,
        6px 10px 20px rgba(0,0,0,0.25)
      `,
    };
  }
  
  return {
    background: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #f8fafc 100%)',
    boxShadow: `
      inset 0 2px 4px rgba(255,255,255,0.8),
      0 2px 0 #ffffff,
      0 5px 0 #f472b6,
      0 8px 0 #fbbf24,
      6px 10px 20px rgba(0,0,0,0.2)
    `,
  };
};

const getTileTextColor = (tile: MahjongTile, highContrast?: boolean) => {
  if (highContrast) {
    switch (tile.type) {
      case 'suit':
        if (tile.suit === 'Crak') return 'text-slate-900';
        if (tile.suit === 'Bam') return 'text-emerald-800';
        if (tile.suit === 'Dot') return 'text-blue-800';
        return 'text-stone-900';
      case 'dragon':
        if (tile.value === 'Red') return 'text-slate-900';
        if (tile.value === 'Green') return 'text-emerald-800';
        if (tile.value === 'White') return 'text-blue-800';
        return 'text-stone-900';
      case 'flower':
        return 'text-rose-800';
      case 'joker':
        return 'text-amber-800';
      case 'wind':
        return 'text-amber-800';
      default:
        return 'text-stone-900';
    }
  }
  switch (tile.type) {
    case 'suit':
      if (tile.suit === 'Crak') return 'text-[#FD3F92]'; // French Fuchsia
      if (tile.suit === 'Bam') return 'text-[#13B3AC]'; // Aquamarine Blue
      if (tile.suit === 'Dot') return 'text-[#665fd1]'; // Dark Periwinkle
      return 'text-slate-800';
    case 'dragon':
      if (tile.value === 'Red') return 'text-[#FD3F92]';
      if (tile.value === 'Green') return 'text-[#13B3AC]';
      if (tile.value === 'White') return 'text-[#665fd1]';
      return 'text-slate-800';
    case 'flower':
      return 'text-[#FD3F92]';
    case 'joker':
      return 'text-[#EBA937]'; // Honey
    case 'wind':
      return 'text-[#8F9779]'; // Artichoke
    default:
      return 'text-slate-800';
  }
};

const getTileAriaLabel = (tile: MahjongTile, isFaceDown?: boolean) => {
  if (isFaceDown) return 'Face down tile';
  let label = '';
  if (tile.type === 'suit') label = `${tile.value} of ${tile.suit}s`;
  else if (tile.type === 'dragon') label = `${tile.value === 'White' ? 'Soap' : tile.value} Dragon`;
  else if (tile.type === 'wind') label = `${tile.value} Wind`;
  else if (tile.type === 'flower') label = `Flower`;
  else if (tile.type === 'joker') label = `Joker`;
  return `${label} Mahjong tile`;
};

const getDisplayValue = (tile: MahjongTile) => {
  if (tile.type === 'suit') return tile.value;
  if (tile.type === 'dragon') {
    if (tile.value === 'White') return 'Soap';
    return tile.value;
  }
  if (tile.type === 'wind') return (tile.value as string).charAt(0);
  return tile.value;
};

const TileFace = ({ tile, isFaceDown, highContrast }: { tile: MahjongTile; isFaceDown?: boolean; highContrast?: boolean }) => {
  if (isFaceDown) return null;
  const displayValue = String(getDisplayValue(tile)).toUpperCase();
  const isSingleChar = displayValue.length === 1;
  const textColor = getTileTextColor(tile, highContrast);

  let label = '';
  if (tile.type === 'suit' && tile.suit) {
    label = tile.suit.toUpperCase(); // BAM, CRAK, DOT
  } else if (tile.type === 'dragon') {
    label = 'DRAGON';
  } else if (tile.type === 'wind') {
    label = 'WIND';
  } else if (tile.type === 'flower') {
    label = 'FLOWER';
  } else if (tile.type === 'joker') {
    label = 'JOKER';
  }

  if (tile.type === 'joker') {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-1 md:p-2">
        <span className={`text-[6px] md:text-[9px] font-serif ${textColor} font-black tracking-wider leading-none mb-1 whitespace-nowrap px-1 uppercase`}>
          JOKER
        </span>
        <div className="flex-1 flex items-center justify-center w-full min-h-0">
          <span className={`text-lg md:text-2xl ${textColor}`}>⭐</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start h-full w-full font-sans font-bold pt-1.5 md:pt-2 px-1.5 md:px-3">
      <span className={`text-[5px] md:text-[8px] uppercase tracking-wider ${textColor} leading-none mb-1 md:mb-1.5 whitespace-nowrap px-1`}>
        {label}
      </span>
      <div className="flex-1 flex items-center justify-center w-full pb-1">
        {tile.type === 'flower' ? (
          <span className={`text-xs md:text-sm ${textColor}`}>
            🌸
          </span>
        ) : (
          <span className={`${isSingleChar ? 'text-base md:text-2xl' : 'text-[8px] md:text-[11px]'} leading-none text-center px-0.5 ${textColor}`}>
            {displayValue}
          </span>
        )}
      </div>
    </div>
  );
};

const SortableTile: React.FC<{ 
  tile: MahjongTile; 
  onDoubleClick?: (id: string) => void;
  disabled?: boolean;
  isFaceDown?: boolean;
  highContrast?: boolean;
}> = ({ tile, onDoubleClick, disabled, isFaceDown, highContrast }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.id, disabled: disabled || isFaceDown });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 100 : 1,
    ...getTile3DStyle(isFaceDown, highContrast),
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      {...attributes}
      {...listeners}
      onDoubleClick={(e) => {
        if (isFaceDown) return;
        e.stopPropagation();
        if (onDoubleClick) onDoubleClick(tile.id);
      }}
      tabIndex={0}
      role="button"
      aria-label={getTileAriaLabel(tile, isFaceDown)}
      onKeyDown={(e) => {
        if (isFaceDown) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onDoubleClick) onDoubleClick(tile.id);
        }
      }}
      className={`
        w-[30px] h-[42px] md:w-10 md:h-14 flex flex-col items-center justify-center 
        m-px md:m-0.5 cursor-grab active:cursor-grabbing
        transition-all select-none
        ${getTileBaseStyle(tile, isFaceDown, highContrast)}
        ${!isFaceDown ? 'hover:-translate-y-1 hover:shadow-lg' : ''}
        ${disabled ? 'opacity-80 grayscale-[0.2] cursor-not-allowed' : ''}
        ${isFaceDown ? 'cursor-not-allowed' : ''}
        focus:ring-2 focus:ring-blue-400 focus:outline-none
      `}
    >
      <TileFace tile={tile} isFaceDown={isFaceDown} highContrast={highContrast} />
    </motion.div>
  );
};

const Rack: React.FC<{ 
  id: string;
  title: string; 
  tiles: MahjongTile[]; 
  onDiscard: (id: string) => void;
  disabled?: boolean;
  isFaceDown?: boolean;
  highContrast?: boolean;
}> = ({ id, title, tiles, onDiscard, disabled, isFaceDown, highContrast }) => {
  const { isOver, setNodeRef } = useDroppable({ id, disabled: disabled || isFaceDown });
  
  return (
    <div 
      id={id} 
      ref={setNodeRef}
      className={`bg-white/45 backdrop-blur-md p-2 md:p-3 rounded-xl border transition-all duration-200 
        ${isOver ? (highContrast ? 'border-slate-600 ring-2 ring-slate-400 shadow-lg' : 'border-pink-400 ring-2 ring-pink-200 shadow-lg scale-[1.01]') : 'border-white/60 shadow-sm'} 
        ${disabled ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between mb-1 md:mb-2 px-1">
        <h3 className={`${highContrast ? 'text-slate-700' : 'text-pink-400/60'} font-sans font-bold uppercase tracking-[0.2em] text-[7px] md:text-[8px] flex items-center gap-1.5`}>
          <Layers size={10} />
          {title}
        </h3>
        <span className={`text-[7px] md:text-[8px] font-bold ${highContrast ? 'text-slate-600' : 'text-pink-300/60'} uppercase tracking-widest`}>{tiles.length} Tiles</span>
      </div>
      <SortableContext items={tiles.map(t => t.id)} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-row flex-nowrap gap-0.5 md:gap-1 min-h-[50px] md:min-h-[70px] bg-white/10 p-1 md:p-2 rounded-lg shadow-inner border border-white/20 relative overflow-x-auto scrollbar-hide">
          <AnimatePresence>
            {tiles.map((tile) => (
              <SortableTile 
                key={tile.id} 
                tile={tile} 
                onDoubleClick={onDiscard}
                disabled={disabled}
                isFaceDown={isFaceDown}
                highContrast={highContrast}
              />
            ))}
          </AnimatePresence>
          {tiles.length === 0 && (
            <div className={`absolute inset-0 flex items-center justify-center ${highContrast ? 'text-slate-400' : 'text-pink-200'} italic text-sm pointer-events-none`}>
              Empty Rack
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

const DiscardPool: React.FC<{ 
  tiles: MahjongTile[];
  canDiscard?: boolean;
  canCall?: boolean;
  highContrast?: boolean;
  onCall?: (id: string) => void;
}> = ({ tiles, canDiscard, canCall, highContrast, onCall }) => {
  const { isOver, setNodeRef } = useDroppable({ 
    id: 'discard-pool',
    disabled: !canDiscard
  });

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-3 md:mb-6">
        <h3 className={`${highContrast ? 'text-slate-800' : 'text-pink-400'} font-sans font-bold uppercase tracking-[0.3em] text-[8px] md:text-[11px] flex items-center gap-2`}>
          <Trash2 size={16} />
          Discard Pool
        </h3>
        <span className={`${highContrast ? 'bg-slate-800 text-white' : 'bg-pink-100 text-pink-500'} px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest`}>
          {tiles.length} Tiles
        </span>
      </div>
      <SortableContext items={tiles.length > 0 ? [tiles[0].id] : []} strategy={horizontalListSortingStrategy}>
        <div 
          ref={setNodeRef}
          className={`flex flex-wrap gap-1 md:gap-2 min-h-[100px] md:min-h-[140px] p-2 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border transition-all duration-200 shadow-inner overflow-y-auto max-h-[200px] md:max-h-[300px]
            ${highContrast ? (isOver ? 'bg-slate-800 border-yellow-400' : 'bg-slate-950 border-slate-700') : (isOver ? 'bg-[#f0b954] border-orange-300 scale-[1.02]' : 'bg-[#EBA937] border-orange-200/50')}
          `}
        >
          <AnimatePresence>
            {tiles.map((tile, i) => (
              <motion.div 
                key={`${tile.id}-${i}`}
                initial={{ scale: 0.5, opacity: 0, y: 20 }}
                animate={{ scale: 0.85, opacity: 0.9, y: 0 }}
                className="hover:opacity-100 hover:scale-100 transition-all cursor-default"
              >
                {i === 0 && canCall ? (
                  <SortableTile 
                    tile={tile} 
                    onDoubleClick={onCall}
                    disabled={false}
                    highContrast={highContrast}
                  />
                ) : (
                  <TileDisplay tile={tile} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {tiles.length === 0 && (
            <div className={`w-full flex flex-col items-center justify-center ${highContrast ? 'text-yellow-400' : 'text-white'} italic text-sm font-sans py-10`}>
              <div className={`w-12 h-12 rounded-full border-2 border-dashed ${highContrast ? 'border-yellow-400/50' : 'border-white/50'} mb-3 flex items-center justify-center opacity-50`}>
                <Trash2 size={20} />
              </div>
              Drop tiles here to discard
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [player1Name, setPlayer1Name] = useState('Player 1');
  const [player2Name, setPlayer2Name] = useState('Pacer Bot');
  const [cardYear, setCardYear] = useState('2026');
  const [timer, setTimer] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState && !gameState.winner) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState?.winner, !!gameState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    GameAudio.enabled = soundEnabled;
  }, [soundEnabled]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDeal = () => {
    setGameState(dealGame());
    setTimer(0);
  };

  useEffect(() => {
    handleDeal();
  }, []);

  // Pacer Bot Turn Logic
  useEffect(() => {
    if (gameState && gameState.activePlayer === 2 && !gameState.winner) {
      if (!gameState.hasDrawn) {
        // Step 1: Draw a tile
        const timer = setTimeout(() => {
          handleDraw();
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        // Step 2: Discard a random tile
        const timer = setTimeout(() => {
          const allTiles = [...gameState.player2Racks.rackA, ...gameState.player2Racks.rackB];
          if (allTiles.length > 0) {
            const randomTile = allTiles[Math.floor(Math.random() * allTiles.length)];
            handleDiscard(randomTile.id);
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState?.activePlayer, gameState?.hasDrawn, gameState?.winner]);

  const findContainer = (id: string) => {
    if (!gameState) return null;
    if (gameState.player1Racks.rackA.find(t => t.id === id)) return 'p1-rackA';
    if (gameState.player1Racks.rackB.find(t => t.id === id)) return 'p1-rackB';
    if (gameState.player2Racks.rackA.find(t => t.id === id)) return 'p2-rackA';
    if (gameState.player2Racks.rackB.find(t => t.id === id)) return 'p2-rackB';
    if (gameState.discardPool.length > 0 && gameState.discardPool[0].id === id) return 'discard-pool';
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (gameState?.winner) return;
    GameAudio.tink();
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (gameState?.winner) return;
    const { active, over } = event;
    if (!over || !gameState) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = overId.includes('rack') ? overId : findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    // Turn-based restriction: Only allow moving your own tiles on your turn
    const isActivePlayer1 = gameState.activePlayer === 1;
    const isActivePlayer2 = gameState.activePlayer === 2;
    const isMovingP1Tile = activeContainer.startsWith('p1');
    const isMovingP2Tile = activeContainer.startsWith('p2');

    if ((isActivePlayer1 && !isMovingP1Tile) || (isActivePlayer2 && !isMovingP2Tile)) return;
    if (overContainer.startsWith('p1') && !isActivePlayer1) return;
    if (overContainer.startsWith('p2') && !isActivePlayer2) return;

    setGameState(prev => {
      if (!prev) return null;
      const newRacks = { ...prev };
      
      let activeItems: MahjongTile[] = [];
      let overItems: MahjongTile[] = [];
      let activeKey: 'rackA' | 'rackB' = 'rackA';
      let overKey: 'rackA' | 'rackB' = 'rackA';
      let activePlayer: 'player1Racks' | 'player2Racks' = 'player1Racks';
      let overPlayer: 'player1Racks' | 'player2Racks' = 'player1Racks';

      if (activeContainer === 'discard-pool') {
        // Special case: Calling from discard pool
        if (prev.hasDrawn) return prev;
        
        const newDiscardPool = [...prev.discardPool];
        const [movedItem] = newDiscardPool.splice(0, 1);

        if (overContainer === 'p1-rackA') { overPlayer = 'player1Racks'; overKey = 'rackA'; }
        else if (overContainer === 'p1-rackB') { overPlayer = 'player1Racks'; overKey = 'rackB'; }
        else if (overContainer === 'p2-rackA') { overPlayer = 'player2Racks'; overKey = 'rackA'; }
        else if (overContainer === 'p2-rackB') { overPlayer = 'player2Racks'; overKey = 'rackB'; }

        overItems = [...newRacks[overPlayer][overKey]];
        const overIndex = overItems.findIndex(t => t.id === overId);
        if (overIndex === -1) {
          overItems.push(movedItem);
        } else {
          overItems.splice(overIndex, 0, movedItem);
        }

        return {
          ...prev,
          discardPool: newDiscardPool,
          [overPlayer]: { ...prev[overPlayer], [overKey]: overItems },
          hasDrawn: true
        };
      }

      if (activeContainer === 'p1-rackA') { activePlayer = 'player1Racks'; activeKey = 'rackA'; }
      else if (activeContainer === 'p1-rackB') { activePlayer = 'player1Racks'; activeKey = 'rackB'; }
      else if (activeContainer === 'p2-rackA') { activePlayer = 'player2Racks'; activeKey = 'rackA'; }
      else if (activeContainer === 'p2-rackB') { activePlayer = 'player2Racks'; activeKey = 'rackB'; }

      if (overContainer === 'p1-rackA') { overPlayer = 'player1Racks'; overKey = 'rackA'; }
      else if (overContainer === 'p1-rackB') { overPlayer = 'player1Racks'; overKey = 'rackB'; }
      else if (overContainer === 'p2-rackA') { overPlayer = 'player2Racks'; overKey = 'rackA'; }
      else if (overContainer === 'p2-rackB') { overPlayer = 'player2Racks'; overKey = 'rackB'; }

      activeItems = [...newRacks[activePlayer][activeKey]];
      overItems = [...newRacks[overPlayer][overKey]];

      const activeIndex = activeItems.findIndex(t => t.id === activeId);
      if (activeIndex === -1) return prev;
      const [movedItem] = activeItems.splice(activeIndex, 1);

      const overIndex = overItems.findIndex(t => t.id === overId);
      if (overIndex === -1) {
        overItems.push(movedItem);
      } else {
        overItems.splice(overIndex, 0, movedItem);
      }

      const updatedActivePlayer = {
        ...prev[activePlayer],
        [activeKey]: activeItems
      };
      
      const updatedOverPlayer = activePlayer === overPlayer 
        ? { ...updatedActivePlayer, [overKey]: overItems }
        : { ...prev[overPlayer], [overKey]: overItems };

      return {
        ...prev,
        [activePlayer]: updatedActivePlayer,
        [overPlayer]: updatedOverPlayer
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (gameState?.winner) return;
    GameAudio.tink();
    const { active, over } = event;
    setActiveId(null);

    if (!over || !gameState) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);

    // Check if dropped on discard pool
    if (overId === 'discard-pool') {
      if (!gameState.hasDrawn) return; // Must draw before discard
      
      // Check if dragging own tile
      const isActivePlayer1 = gameState.activePlayer === 1;
      const isMovingP1Tile = activeContainer?.startsWith('p1');
      const isMovingP2Tile = activeContainer?.startsWith('p2');
      
      if ((isActivePlayer1 && isMovingP1Tile) || (!isActivePlayer1 && isMovingP2Tile)) {
        handleDiscard(activeId);
        return;
      }
    }

    const overContainer = overId.includes('rack') ? overId : findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer !== overContainer) return;

    // Turn-based restriction: Only allow reordering your own tiles on your turn
    const isActivePlayer1 = gameState.activePlayer === 1;
    const isActivePlayer2 = gameState.activePlayer === 2;
    const isMovingP1Tile = activeContainer.startsWith('p1');
    const isMovingP2Tile = activeContainer.startsWith('p2');

    if ((isActivePlayer1 && !isMovingP1Tile) || (isActivePlayer2 && !isMovingP2Tile)) return;

    setGameState(prev => {
      if (!prev) return null;
      const newRacks = { ...prev };
      
      let items: MahjongTile[] = [];
      let key: 'rackA' | 'rackB' = 'rackA';
      let player: 'player1Racks' | 'player2Racks' = 'player1Racks';

      if (activeContainer === 'p1-rackA') { player = 'player1Racks'; key = 'rackA'; }
      else if (activeContainer === 'p1-rackB') { player = 'player1Racks'; key = 'rackB'; }
      else if (activeContainer === 'p2-rackA') { player = 'player2Racks'; key = 'rackA'; }
      else if (activeContainer === 'p2-rackB') { player = 'player2Racks'; key = 'rackB'; }

      items = [...newRacks[player][key]];
      const oldIndex = items.findIndex(t => t.id === activeId);
      const newIndex = items.findIndex(t => t.id === overId);

      if (oldIndex === -1 || newIndex === -1) return prev;

      return {
        ...prev,
        [player]: { ...prev[player], [key]: arrayMove(items, oldIndex, newIndex) }
      };
    });
  };

  const getActiveTile = () => {
    if (!activeId || !gameState) return null;
    const allTiles = [
      ...gameState.player1Racks.rackA,
      ...gameState.player1Racks.rackB,
      ...gameState.player2Racks.rackA,
      ...gameState.player2Racks.rackB,
    ];
    return allTiles.find(t => t.id === activeId);
  };

  const handleAutoSort = (player: 1 | 2) => {
    setGameState(prev => {
      if (!prev || prev.winner) return null;
      const playerKey = player === 1 ? 'player1Racks' : 'player2Racks';
      const allTiles = [...prev[playerKey].rackA, ...prev[playerKey].rackB];
      const sorted = sortTiles(allTiles);
      
      const mid = Math.ceil(sorted.length / 2);
      
      return {
        ...prev,
        [playerKey]: {
          rackA: sorted.slice(0, mid),
          rackB: sorted.slice(mid),
        }
      };
    });
  };

  const handleDraw = () => {
    setGameState(prev => {
      if (!prev || prev.wall.length === 0 || prev.hasDrawn || prev.winner) return prev;
      GameAudio.swish();
      const newWall = [...prev.wall];
      const drawnTile = newWall.shift()!;
      
      const playerKey = prev.activePlayer === 1 ? 'player1Racks' : 'player2Racks';
      const newRacks = { ...prev[playerKey] };
      
      // Add to rack A if it has space, else rack B
      if (newRacks.rackA.length < 14) {
        newRacks.rackA = [...newRacks.rackA, drawnTile];
      } else {
        newRacks.rackB = [...newRacks.rackB, drawnTile];
      }

      return {
        ...prev,
        wall: newWall,
        [playerKey]: newRacks,
        hasDrawn: true
      };
    });
  };

  const handleCall = () => {
    setGameState(prev => {
      if (!prev || prev.discardPool.length === 0 || prev.hasDrawn || prev.winner) return prev;
      GameAudio.swish();
      const newDiscardPool = [...prev.discardPool];
      const calledTile = newDiscardPool.shift()!;
      
      const playerKey = prev.activePlayer === 1 ? 'player1Racks' : 'player2Racks';
      const newRacks = { ...prev[playerKey] };
      
      // Add to rack A if it has space, else rack B
      if (newRacks.rackA.length < 14) {
        newRacks.rackA = [...newRacks.rackA, calledTile];
      } else {
        newRacks.rackB = [...newRacks.rackB, calledTile];
      }

      return {
        ...prev,
        discardPool: newDiscardPool,
        [playerKey]: newRacks,
        hasDrawn: true
      };
    });
  };

  const handleDiscard = (id: string) => {
    setGameState(prev => {
      if (!prev || prev.winner) return prev;
      GameAudio.swish();
      
      const tileId = id;
      if (!tileId) return prev;
      
      let discardedTile: MahjongTile | null = null;
      const playerKey = prev.activePlayer === 1 ? 'player1Racks' : 'player2Racks';
      
      const newRackA = prev[playerKey].rackA.filter(t => {
        if (t.id === tileId) { discardedTile = t; return false; }
        return true;
      });
      const newRackB = prev[playerKey].rackB.filter(t => {
        if (t.id === tileId) { discardedTile = t; return false; }
        return true;
      });

      if (!discardedTile) return prev;

      return {
        ...prev,
        [playerKey]: { rackA: newRackA, rackB: newRackB },
        discardPool: [discardedTile, ...prev.discardPool],
        activePlayer: prev.activePlayer === 1 ? 2 : 1, // Switch turn
        hasDrawn: false
      };
    });
  };

  const handleCallMahjong = () => {
    GameAudio.sparkle();
    setGameState(prev => {
      if (!prev || prev.winner) return prev;
      return { ...prev, winner: prev.activePlayer };
    });
  };

  if (!gameState) return <div className="p-8 text-center text-gray-500">Loading game...</div>;

  return (
    <div className={`min-h-screen p-4 md:p-8 font-sans overflow-x-hidden relative transition-colors duration-300 ${highContrast ? 'bg-slate-950 text-white' : 'bg-[#0f4c75] text-slate-800'}`}>
      {/* Subtle texture overlay for the neoprene mat feel */}
      {!highContrast && <div className="absolute inset-0 opacity-15 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>}
      
      <div className="max-w-6xl mx-auto relative z-10">
        <AnimatePresence>
          {gameState.winner && (
            <motion.div 
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className={`fixed top-10 left-1/2 -translate-x-1/2 z-[100] px-12 py-6 rounded-[2rem] shadow-2xl border flex items-center gap-6 ${highContrast ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-pink-100 text-pink-500'}`}
            >
              <span className="text-4xl">✨</span>
              <h2 className="text-3xl font-serif italic whitespace-nowrap">
                {gameState.winner === 1 ? player1Name : player2Name} Declares Messy Mahj!
              </h2>
              <span className="text-4xl">✨</span>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div>
            <h1 className={`text-5xl font-sans font-light tracking-[0.15em] uppercase drop-shadow-md ${highContrast ? 'text-white' : 'text-white'}`}>
              Messy Mahj
            </h1>
            <p className={`${highContrast ? 'text-yellow-400' : 'text-sky-300'} font-sans font-medium tracking-wide text-[10px] md:text-xs max-w-md`}>
              A fun way to practice identifying hand lines, focusing on speed and pattern recognition. Enjoy! xo, Pat
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setHighContrast(!highContrast)}
              className={`w-12 h-12 rounded-full border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center focus:ring-2 focus:ring-blue-400 focus:outline-none ${highContrast ? 'bg-white text-slate-900 border-slate-700' : 'bg-white text-pink-500 border-pink-200'}`}
              title={highContrast ? "Disable High Contrast" : "Enable High Contrast"}
              aria-label={highContrast ? "Disable High Contrast" : "Enable High Contrast"}
            >
              {highContrast ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-12 h-12 rounded-full border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center focus:ring-2 focus:ring-blue-400 focus:outline-none ${highContrast ? 'bg-white text-slate-900 border-slate-700' : 'bg-white text-pink-500 border-pink-200'}`}
              title={soundEnabled ? "Mute Sound" : "Unmute Sound"}
              aria-label={soundEnabled ? "Mute Sound" : "Unmute Sound"}
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button 
              onClick={handleDeal}
              className={`${highContrast ? 'bg-yellow-400 text-slate-950 hover:bg-yellow-300' : 'bg-pink-500 text-white hover:bg-pink-400'} font-sans font-bold py-3 px-8 rounded-full flex items-center gap-2 transition-all active:scale-95 shadow-xl shadow-sky-900/50 focus:ring-2 focus:ring-blue-400 focus:outline-none`}
              aria-label="Start New Game"
            >
              <RefreshCw size={18} />
              New Game
            </button>
          </div>
        </header>

        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_380px] gap-6 lg:gap-10">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-6 md:space-y-10">
              {/* Player 1 Section */}
              <section className={`p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] transition-all ${gameState.activePlayer === 1 ? (highContrast ? 'bg-slate-900 shadow-2xl ring-2 ring-yellow-400' : 'bg-white/90 backdrop-blur-md shadow-2xl shadow-sky-900/40 ring-1 ring-white') : 'opacity-60'}`}>
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center font-sans font-bold text-xl md:text-2xl shadow-md ${gameState.activePlayer === 1 ? (highContrast ? 'bg-yellow-400 text-slate-950' : 'bg-pink-500 text-white') : (highContrast ? 'bg-slate-800 text-slate-500' : 'bg-pink-100 text-pink-300')}`}>E</div>
                    <div className="flex items-center">
                      <input
                        value={player1Name}
                        onChange={(e) => setPlayer1Name(e.target.value)}
                        className={`bg-transparent border-none outline-none font-sans font-light text-xl md:text-3xl tracking-tight w-[120px] md:w-[200px] hover:bg-white/50 focus:bg-white/80 focus:border-b rounded transition-all px-2 -ml-2 ${highContrast ? 'text-white focus:text-slate-900 focus:border-yellow-400' : 'text-slate-800 focus:border-pink-300'}`}
                        placeholder="Player 1"
                        aria-label="Player 1 Name"
                      />
                      {gameState.activePlayer === 1 && <span className={`text-[8px] md:text-[10px] px-2 md:px-3 py-0.5 md:py-1 rounded-full ml-2 md:ml-3 uppercase tracking-widest font-sans font-bold ${highContrast ? 'bg-yellow-400 text-slate-950' : 'bg-amber-400 text-white'}`}>Your Turn</span>}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAutoSort(1)}
                    disabled={!!gameState.winner || gameState.activePlayer !== 1}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all font-bold text-xs uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none focus:ring-2 focus:ring-blue-400 focus:outline-none ${highContrast ? 'bg-slate-800 text-yellow-400 border-slate-700' : 'bg-white text-pink-500 border-pink-200'}`}
                    aria-label="Auto-Sort Player 1 Rack"
                  >
                    <SortAsc size={14} />
                    Auto-Sort
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  <Rack 
                    id="p1-rackA" 
                    title="Rack A" 
                    tiles={gameState.player1Racks.rackA} 
                    onDiscard={handleDiscard}
                    disabled={!!gameState.winner || gameState.activePlayer !== 1}
                    isFaceDown={!gameState.winner && gameState.activePlayer === 2}
                    highContrast={highContrast}
                  />
                  <Rack 
                    id="p1-rackB" 
                    title="Rack B" 
                    tiles={gameState.player1Racks.rackB} 
                    onDiscard={handleDiscard}
                    disabled={!!gameState.winner || gameState.activePlayer !== 1}
                    isFaceDown={!gameState.winner && gameState.activePlayer === 2}
                    highContrast={highContrast}
                  />
                </div>
              </section>

              {/* Central Controls & Discard Pool */}
              <section className={`p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] shadow-2xl border transition-colors duration-300 ${highContrast ? 'bg-slate-900 border-slate-700 shadow-sky-900/10' : 'bg-white border-white shadow-sky-900/30'}`}>
                <div className="flex flex-col md:flex-row gap-6 md:gap-12">
                  <DiscardPool 
                    tiles={gameState.discardPool} 
                    canDiscard={!gameState.winner && gameState.hasDrawn && gameState.activePlayer === 1}
                    canCall={!gameState.winner && !gameState.hasDrawn && gameState.activePlayer === 1 && gameState.discardPool.length > 0}
                    highContrast={highContrast}
                    onCall={handleCall}
                  />

                  <div className="flex flex-col justify-center gap-3 md:gap-5 min-w-full md:min-w-[220px]">
                    {!gameState.winner && (
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={handleDraw}
                          disabled={gameState.wall.length === 0 || gameState.hasDrawn || gameState.activePlayer === 2}
                          className={`w-full text-white font-sans font-bold py-3 md:py-5 px-4 md:px-8 rounded-full flex items-center justify-center gap-3 md:gap-4 transition-all hover:-translate-y-1 hover:brightness-110 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group focus:ring-2 focus:ring-blue-400 focus:outline-none ${highContrast ? 'bg-slate-800 border-2 border-yellow-400' : 'bg-gradient-to-r from-pink-500 to-rose-500'}`}
                          aria-label="Draw tile"
                        >
                          <PlusCircle size={20} className={`md:w-6 md:h-6 group-hover:rotate-90 transition-transform ${highContrast ? 'text-yellow-400' : 'text-white'}`} />
                          <div className="text-left">
                            <div className="text-lg md:text-xl leading-none">Draw</div>
                          </div>
                        </button>

                        <button 
                          onClick={handleCall}
                          disabled={gameState.discardPool.length === 0 || gameState.hasDrawn || gameState.activePlayer === 2}
                          className={`w-full text-white font-sans font-bold py-3 md:py-5 px-4 md:px-8 rounded-full flex items-center justify-center gap-3 md:gap-4 transition-all hover:-translate-y-1 hover:brightness-110 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group focus:ring-2 focus:ring-blue-400 focus:outline-none ${highContrast ? 'bg-slate-800 border-2 border-yellow-400' : 'bg-[#665fd1]'}`}
                          aria-label="Call last discarded tile"
                        >
                          <ArrowRight size={20} className={`md:w-6 md:h-6 group-hover:translate-x-1 transition-transform ${highContrast ? 'text-yellow-400' : 'text-white'}`} />
                          <div className="text-left">
                            <div className="text-lg md:text-xl leading-none">Call</div>
                          </div>
                        </button>
                      </div>
                    )}

                    <button 
                      onClick={handleCallMahjong}
                      disabled={!!gameState.winner || !gameState.hasDrawn || gameState.activePlayer === 2}
                      className={`w-full text-white drop-shadow-sm font-sans font-bold py-3 md:py-5 px-4 md:px-8 rounded-xl md:rounded-2xl flex items-center justify-center gap-3 md:gap-4 transition-all hover:-translate-y-1 hover:brightness-110 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group focus:ring-2 focus:ring-blue-400 focus:outline-none ${highContrast ? 'bg-emerald-900 border-2 border-emerald-400' : 'bg-gradient-to-r from-emerald-400 to-teal-400'}`}
                      aria-label="Call Mahjong"
                    >
                      <div className="text-left">
                        <div className={`text-[8px] md:text-[10px] uppercase tracking-widest opacity-80 leading-none mb-1 ${highContrast ? 'text-emerald-400' : 'text-white'}`}>Victory</div>
                        <div className="text-lg md:text-xl leading-none">Call Mahjong!</div>
                      </div>
                    </button>
                  </div>
                </div>
              </section>

              {/* Player 2 Section */}
              <section className={`p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] transition-all ${gameState.activePlayer === 2 ? (highContrast ? 'bg-slate-900 shadow-2xl ring-2 ring-yellow-400' : 'bg-white/90 backdrop-blur-md shadow-2xl shadow-sky-900/40 ring-1 ring-white') : 'opacity-60'}`}>
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center font-sans font-bold text-xl md:text-2xl shadow-md ${gameState.activePlayer === 2 ? (highContrast ? 'bg-yellow-400 text-slate-950' : 'bg-blue-400 text-white') : (highContrast ? 'bg-slate-800 text-slate-500' : 'bg-blue-50 text-blue-200')}`}>W</div>
                    <div className="flex items-center">
                      <input
                        value={player2Name}
                        onChange={(e) => setPlayer2Name(e.target.value)}
                        className={`bg-transparent border-none outline-none font-sans font-light text-xl md:text-3xl tracking-tight w-[120px] md:w-[200px] hover:bg-white/50 focus:bg-white/80 focus:border-b rounded transition-all px-2 -ml-2 ${highContrast ? 'text-white focus:text-slate-900 focus:border-yellow-400' : 'text-slate-800 focus:border-blue-300'}`}
                        placeholder="Player 2"
                        aria-label="Player 2 Name"
                      />
                      {gameState.activePlayer === 2 && <span className={`text-[8px] md:text-[10px] px-2 md:px-3 py-0.5 md:py-1 rounded-full ml-2 md:ml-3 uppercase tracking-widest font-sans font-bold ${highContrast ? 'bg-yellow-400 text-slate-950' : 'bg-amber-400 text-white'}`}>Your Turn</span>}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAutoSort(2)}
                    disabled={!!gameState.winner || gameState.activePlayer !== 2}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all font-bold text-xs uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none focus:ring-2 focus:ring-blue-400 focus:outline-none ${highContrast ? 'bg-slate-800 text-yellow-400 border-slate-700' : 'bg-white text-blue-500 border-blue-200'}`}
                    aria-label="Auto-Sort Player 2 Rack"
                  >
                    <SortAsc size={14} />
                    Auto-Sort
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  <Rack 
                    id="p2-rackA" 
                    title="Rack A" 
                    tiles={gameState.player2Racks.rackA} 
                    onDiscard={handleDiscard}
                    disabled={!!gameState.winner || gameState.activePlayer !== 2}
                    isFaceDown={!gameState.winner}
                    highContrast={highContrast}
                  />
                  <Rack 
                    id="p2-rackB" 
                    title="Rack B" 
                    tiles={gameState.player2Racks.rackB} 
                    onDiscard={handleDiscard}
                    disabled={!!gameState.winner || gameState.activePlayer !== 2}
                    isFaceDown={!gameState.winner}
                    highContrast={highContrast}
                  />
                </div>
              </section>
            </div>
            <DragOverlay dropAnimation={dropAnimation}>
              {activeId && getActiveTile() ? (
                <motion.div 
                  initial={{ scale: 1 }}
                  animate={{ scale: 1.15 }}
                  className="shadow-2xl cursor-grabbing"
                >
                  <TileDisplay tile={getActiveTile()!} highContrast={highContrast} />
                </motion.div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Sidebar Info */}
          <aside className="space-y-6 md:space-y-8">
            <div className={`p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-xl border transition-colors duration-300 ${highContrast ? 'bg-slate-900 border-slate-700 shadow-sky-900/10' : 'bg-white border-white shadow-sky-900/20'}`}>
              <h4 className={`${highContrast ? 'text-yellow-400' : 'text-pink-400'} font-sans font-bold uppercase tracking-[0.2em] text-[8px] md:text-[10px] mb-4 md:mb-6`}>Game Status</h4>
              <div className="space-y-4 md:space-y-6">
                <div className="flex justify-between items-center">
                  <span className={`${highContrast ? 'text-slate-300' : 'text-slate-500'} text-xs md:text-sm font-sans font-medium`}>Active Player</span>
                  <span className={`font-sans font-bold px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[8px] md:text-[10px] uppercase tracking-widest text-white ${gameState.activePlayer === 1 ? (highContrast ? 'bg-yellow-400 text-slate-950' : 'bg-pink-500') : 'bg-blue-400'}`}>
                    {gameState.activePlayer === 1 ? player1Name : player2Name}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`${highContrast ? 'text-slate-300' : 'text-slate-500'} text-xs md:text-sm font-sans font-medium`}>Wall Remaining</span>
                  <span className={`font-sans font-light text-lg md:text-xl ${highContrast ? 'text-yellow-400' : 'text-pink-500'}`}>{gameState.wall.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`${highContrast ? 'text-slate-300' : 'text-slate-500'} text-xs md:text-sm font-sans font-medium`}>Discard Count</span>
                  <span className={`font-sans font-light text-lg md:text-xl ${highContrast ? 'text-yellow-400' : 'text-pink-500'}`}>{gameState.discardPool.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`${highContrast ? 'text-slate-300' : 'text-slate-500'} text-xs md:text-sm font-sans font-medium`}>Time</span>
                  <span className={`font-sans font-light text-lg md:text-xl ${highContrast ? 'text-yellow-400' : 'text-pink-500'}`}>{formatTime(timer)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`${highContrast ? 'text-slate-300' : 'text-slate-500'} text-xs md:text-sm font-sans font-medium`}>Active Card</span>
                  <select 
                    value={cardYear}
                    onChange={(e) => setCardYear(e.target.value)}
                    className={`font-bold text-sm border rounded-full px-3 py-1 outline-none cursor-pointer shadow-sm hover:shadow-md transition-all focus:ring-2 focus:ring-blue-400 ${highContrast ? 'bg-slate-800 text-white border-slate-600' : 'bg-white text-pink-500 border-pink-200'}`}
                    aria-label="Select NMJL Card Year"
                  >
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={`p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-lg border text-[10px] md:text-xs leading-relaxed font-sans font-medium transition-colors duration-300 ${highContrast ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-white text-slate-700'}`}>
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h4 className={`${highContrast ? 'text-yellow-400' : 'text-pink-500'} font-bold uppercase tracking-widest`}>Quick Ref</h4>
                <button 
                  onClick={() => setHighContrast(!highContrast)}
                  className={`text-[8px] uppercase tracking-widest font-bold px-2 py-1 rounded-md border transition-all ${highContrast ? 'bg-yellow-400 text-slate-950 border-yellow-500' : 'bg-pink-50 text-pink-500 border-pink-100'}`}
                  aria-label={highContrast ? "Disable High Contrast" : "Enable High Contrast"}
                >
                  {highContrast ? "Contrast: High" : "Contrast: Normal"}
                </button>
              </div>
              <ul className={`list-disc list-inside space-y-2 md:space-y-3 ${highContrast ? 'marker:text-yellow-400' : 'marker:text-pink-400'}`}>
                <li className="whitespace-nowrap"><span className={`font-bold ${highContrast ? 'text-yellow-400' : 'text-pink-600'}`}>Goal:</span> Complete both racks to win.</li>
                <li className="whitespace-nowrap"><span className={`font-bold ${highContrast ? 'text-yellow-400' : 'text-pink-600'}`}>Jokers:</span> Cannot be used in Singles or Pairs.</li>
                <li className="whitespace-nowrap"><span className={`font-bold ${highContrast ? 'text-yellow-400' : 'text-pink-600'}`}>Dragons:</span> Red = Crak | Green = Bam | Soap = Dot.</li>
                <li className="whitespace-nowrap"><span className={`font-bold ${highContrast ? 'text-yellow-400' : 'text-pink-600'}`}>Turn Flow:</span> Always Draw before you Discard.</li>
                <li className="whitespace-nowrap"><span className={`font-bold ${highContrast ? 'text-yellow-400' : 'text-pink-600'}`}>Wall:</span> The game ends when the wall reaches 0.</li>
              </ul>
            </div>
          </aside>
        </div>

        <footer className="mt-20 pt-10 border-t border-sky-700/50 text-center text-sky-300 text-[10px] font-sans font-bold uppercase tracking-widest">
          <p>Standard 152-tile American Mahjong Set • Siamese Rules • Copyright Patricia Correa 2026</p>
        </footer>
      </div>
    </div>
  );
}

const TileDisplay = ({ tile, highContrast }: { tile: MahjongTile; highContrast?: boolean }) => {
  return (
    <div 
      aria-label={getTileAriaLabel(tile)}
      style={getTile3DStyle(false, highContrast)}
      className={`
        w-[30px] h-[42px] md:w-10 md:h-14 flex flex-col items-center justify-center 
        m-px md:m-0.5 cursor-default
        transition-all select-none
        ${getTileBaseStyle(tile, false, highContrast)}
      `}
    >
      <TileFace tile={tile} highContrast={highContrast} />
    </div>
  );
};
