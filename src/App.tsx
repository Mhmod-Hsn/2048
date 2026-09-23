import React, { useState, useEffect, useCallback, useRef } from 'react';

const GRID_SIZE = 4;
const WIN_TILE = 2048;

const TILE_COLORS = {
  0: 'bg-[#cdc1b4]',
  2: 'bg-[#eee4da] text-[#776e65]',
  4: 'bg-[#ede0c8] text-[#776e65]',
  8: 'bg-[#f2b179] text-white',
  16: 'bg-[#f59563] text-white',
  32: 'bg-[#f67c5f] text-white',
  64: 'bg-[#f65e3b] text-white',
  128: 'bg-[#edcf72] text-white',
  256: 'bg-[#edcc61] text-white text-3xl sm:text-4xl',
  512: 'bg-[#edc850] text-white text-3xl sm:text-4xl',
  1024: 'bg-[#edc53f] text-white text-3xl sm:text-4xl',
  2048: 'bg-[#edc22e] text-white text-3xl sm:text-4xl shadow-[0_0_30px_10px_rgba(243,215,116,0.5)]',
};

const getTileColor = (val) => {
  if (val >= 2048) return TILE_COLORS[2048];
  return TILE_COLORS[val] || TILE_COLORS[0];
};

// Global ID counter for tiles to track them across renders for CSS transitions
let nextId = 1;

const addRandomTile = (currentTiles) => {
  const grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
  currentTiles.forEach(t => {
    if (!t.isDestroying) grid[t.r][t.c] = t;
  });

  const emptyCells = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!grid[r][c]) emptyCells.push({ r, c });
    }
  }

  if (emptyCells.length === 0) return currentTiles;

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const newTile = {
    id: nextId++,
    r: randomCell.r,
    c: randomCell.c,
    value: Math.random() < 0.9 ? 2 : 4,
    isNew: true,
    isMerged: false,
    isDestroying: false
  };

  return [...currentTiles, newTile];
};

const checkGameOver = (tiles) => {
  if (tiles.filter(t => !t.isDestroying).length < GRID_SIZE * GRID_SIZE) return false;

  const grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
  tiles.forEach(t => {
    if (!t.isDestroying) grid[t.r][t.c] = t;
  });

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const val = grid[r][c].value;
      if (r < GRID_SIZE - 1 && grid[r+1][c].value === val) return false;
      if (c < GRID_SIZE - 1 && grid[r][c+1].value === val) return false;
    }
  }
  return true;
};

// Helpers for calculating grid movement vectors
const getVector = (dir) => {
  switch (dir) {
    case 'UP': return { r: -1, c: 0 };
    case 'DOWN': return { r: 1, c: 0 };
    case 'LEFT': return { r: 0, c: -1 };
    case 'RIGHT': return { r: 0, c: 1 };
    default: return { r: 0, c: 0 };
  }
};

const getTraversals = (direction) => {
  const traversals = { x: [0, 1, 2, 3], y: [0, 1, 2, 3] };
  if (direction === 'RIGHT') traversals.x.reverse();
  if (direction === 'DOWN') traversals.y.reverse();
  return traversals;
};

const findFurthestPosition = (grid, r, c, dir) => {
  const vector = getVector(dir);
  let prevR = r, prevC = c;
  let currentR = r + vector.r, currentC = c + vector.c;

  while (
    currentR >= 0 && currentR < GRID_SIZE &&
    currentC >= 0 && currentC < GRID_SIZE &&
    grid[currentR][currentC] === null
  ) {
    prevR = currentR;
    prevC = currentC;
    currentR += vector.r;
    currentC += vector.c;
  }

  let nextTile = null;
  if (currentR >= 0 && currentR < GRID_SIZE && currentC >= 0 && currentC < GRID_SIZE) {
      nextTile = grid[currentR][currentC];
  }

  return { targetR: prevR, targetC: prevC, nextTile };
};

export default function App() {
  const [tiles, setTiles] = useState(() => addRandomTile(addRandomTile([])));
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [hasWon, setHasWon] = useState(false);

  useEffect(() => {
    const savedBest = localStorage.getItem('2048-best-score');
    if (savedBest) setBestScore(parseInt(savedBest, 10));
  }, []);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem('2048-best-score', score.toString());
    }
  }, [score, bestScore]);

  // Clean up animation flags after transitions end
  useEffect(() => {
    if (tiles.some(t => t.isDestroying || t.isNew || t.isMerged)) {
      const timer = setTimeout(() => {
        setTiles(prev => prev.filter(t => !t.isDestroying).map(t => ({
          ...t,
          isNew: false,
          isMerged: false
        })));
      }, 200); // 100ms slide + 100ms pop
      return () => clearTimeout(timer);
    }
  }, [tiles]);

  const move = useCallback((direction) => {
    if (gameOver || (gameWon && !hasWon)) return;

    setTiles((prevTiles) => {
      let moved = false;
      let scoreIncrease = 0;
      const newTiles = [];
      const destroyingTiles = [];

      const grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
      prevTiles.forEach(t => {
        if (!t.isDestroying) {
          grid[t.r][t.c] = { ...t, isNew: false, isMerged: false };
        }
      });

      const traversals = getTraversals(direction);

      traversals.y.forEach(r => {
        traversals.x.forEach(c => {
          const tile = grid[r][c];
          if (tile) {
            const { targetR, targetC, nextTile } = findFurthestPosition(grid, r, c, direction);

            // Merge if values match and target tile hasn't already merged this turn
            if (nextTile && nextTile.value === tile.value && !nextTile.isMerged) {
              moved = true;
              scoreIncrease += tile.value * 2;

              nextTile.value *= 2;
              nextTile.isMerged = true;

              tile.r = nextTile.r;
              tile.c = nextTile.c;
              tile.isDestroying = true;
              destroyingTiles.push(tile);

              grid[r][c] = null;
            } else {
              if (targetR !== r || targetC !== c) {
                moved = true;
                grid[r][c] = null;
                grid[targetR][targetC] = tile;
                tile.r = targetR;
                tile.c = targetC;
              }
            }
          }
        });
      });

      if (!moved) return prevTiles;

      grid.forEach(row => row.forEach(tile => {
        if (tile) newTiles.push(tile);
      }));

      const mergedTiles = [...newTiles, ...destroyingTiles];
      const finalTiles = addRandomTile(mergedTiles);

      setScore(s => s + scoreIncrease);

      if (!hasWon && finalTiles.some(t => t.value === WIN_TILE)) {
        setGameWon(true);
      }
      if (checkGameOver(finalTiles)) {
        setGameOver(true);
      }

      return finalTiles;
    });
  }, [gameOver, gameWon, hasWon]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': move('UP'); break;
        case 'ArrowDown': case 's': case 'S': move('DOWN'); break;
        case 'ArrowLeft': case 'a': case 'A': move('LEFT'); break;
        case 'ArrowRight': case 'd': case 'D': move('RIGHT'); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  const touchStart = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e) => {
    if (!touchStart.current.x) return;
    const deltaX = e.changedTouches[0].clientX - touchStart.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (Math.max(absX, absY) > 30) { // minimum swipe distance
      if (absX > absY) move(deltaX > 0 ? 'RIGHT' : 'LEFT');
      else move(deltaY > 0 ? 'DOWN' : 'UP');
    }
    touchStart.current = { x: 0, y: 0 };
  };

  const restartGame = () => {
    setTiles(addRandomTile(addRandomTile([])));
    setScore(0);
    setGameOver(false);
    setGameWon(false);
    setHasWon(false);
  };

  return (
    <div
      className="min-h-screen bg-[#faf8ef] flex flex-col items-center justify-center p-4 font-sans select-none text-[#776e65] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Hardware-accelerated CSS Keyframes for smooth animations */}
      <style>{`
        @keyframes appear {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        .animate-appear {
          animation: appear 150ms ease-in-out 100ms backwards;
        }
        .animate-pop {
          animation: pop 150ms ease-in-out 100ms backwards;
        }
      `}</style>

      {/* Header Section */}
      <div className="w-full max-w-lg mb-8 flex justify-between items-center">
        <h1 className="text-6xl sm:text-7xl font-bold">2048</h1>
        <div className="flex gap-2 text-white">
          <div className="bg-[#bbada0] rounded-lg p-3 text-center min-w-[80px]">
            <div className="text-sm font-bold uppercase text-[#eee4da]">Score</div>
            <div className="text-2xl font-bold">{score}</div>
          </div>
          <div className="bg-[#bbada0] rounded-lg p-3 text-center min-w-[80px]">
            <div className="text-sm font-bold uppercase text-[#eee4da]">Best</div>
            <div className="text-2xl font-bold">{bestScore}</div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-lg mb-6 flex justify-between items-center">
        <p className="text-lg hidden sm:block font-medium">Join the numbers to get to <strong className="text-xl">2048!</strong></p>
        <button
          onClick={restartGame}
          className="bg-[#8f7a66] hover:bg-[#9f8b77] text-white font-bold py-3 px-6 rounded-lg text-xl transition-colors focus:ring-4 focus:ring-amber-900 outline-none"
        >
          New Game
        </button>
      </div>

      {/* Game Board Container */}
      <div
        className="relative bg-[#bbada0] p-3 sm:p-4 rounded-xl w-full max-w-lg aspect-square shadow-2xl"
        style={{ '--gap': '0.75rem' }} // Configurable gap variable controlling board scaling
      >
        {/* Static Background Empty Grid */}
        <div className="grid grid-cols-4 grid-rows-4 w-full h-full" style={{ gap: 'var(--gap)' }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-[#cdc1b4] rounded-lg w-full h-full" />
          ))}
        </div>

        {/* Absolute Moving Tiles Overlay */}
        <div className="absolute top-3 left-3 right-3 bottom-3 sm:top-4 sm:left-4 sm:right-4 sm:bottom-4 pointer-events-none">
          {tiles.map(t => (
            <div
              key={t.id}
              className={`absolute top-0 left-0 transition-transform duration-100 ease-in-out`}
              style={{
                width: 'calc((100% - var(--gap) * 3) / 4)',
                height: 'calc((100% - var(--gap) * 3) / 4)',
                // Translate shifts element by its *own size* plus the gap
                transform: `translate(calc(${t.c} * (100% + var(--gap))), calc(${t.r} * (100% + var(--gap))))`,
                zIndex: t.isDestroying ? 10 : 20,
              }}
            >
              {/* Inner wrapper applies the scale animations independently of the translation */}
              <div
                className={`w-full h-full flex items-center justify-center rounded-lg font-bold text-4xl sm:text-5xl lg:text-6xl ${getTileColor(t.value)} ${t.isNew ? 'animate-appear' : ''} ${t.isMerged ? 'animate-pop' : ''}`}
              >
                {t.value}
              </div>
            </div>
          ))}
        </div>

        {/* Overlay for Game Over / Win */}
        {(gameOver || gameWon) && (
          <div className="absolute inset-0 bg-[#eee4da] bg-opacity-75 z-50 flex flex-col items-center justify-center rounded-xl animate-fade-in backdrop-blur-sm">
            <h2 className="text-5xl sm:text-6xl font-bold text-[#776e65] mb-6 drop-shadow-md">
              {gameWon ? "You Win!" : "Game Over!"}
            </h2>
            <div className="flex gap-4">
              {gameWon && (
                <button
                  onClick={() => { setGameWon(false); setHasWon(true); }}
                  className="bg-[#8f7a66] text-white font-bold py-4 px-8 rounded-lg text-2xl hover:bg-[#9f8b77] transition-colors shadow-lg focus:ring-4 focus:ring-amber-900 outline-none pointer-events-auto"
                >
                  Keep Going
                </button>
              )}
              <button
                onClick={restartGame}
                className="bg-[#8f7a66] text-white font-bold py-4 px-8 rounded-lg text-2xl hover:bg-[#9f8b77] transition-colors shadow-lg focus:ring-4 focus:ring-amber-900 outline-none pointer-events-auto"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 text-center text-xl text-[#776e65] font-medium max-w-lg opacity-70">
        <p>Use <strong className="text-gray-800">Arrow Keys</strong>, D-Pad, or <strong className="text-gray-800">Swipe</strong> to move tiles.</p>
      </div>
    </div>
  );
}
