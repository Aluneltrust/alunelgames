export interface GameConfig {
  id: string;
  name: string;
  url: string;
  description: string;
  color: string;
  gradient: string;
  bg?: string;
}

export const GAMES: GameConfig[] = [
  {
    id: 'tanks',
    name: 'BSV Tanks',
    url: 'https://royalsonchain.com',
    description: 'Turn-based tank battle with BSV wagers',
    color: '#ef4444',
    gradient: 'from-red-500/20 to-orange-500/10',
    bg: '/bg-tanks.png',
  },
  {
    id: 'flock-wars',
    name: 'Flock Wars',
    url: 'https://sheeponchain.com',
    description: 'Hex-grid battleship with sheep',
    color: '#22c55e',
    gradient: 'from-green-500/20 to-emerald-500/10',
    bg: '/bg-flock-wars.png',
  },
  {
    id: 'chess',
    name: 'BSV Chess',
    url: 'http://localhost:5173',
    description: 'Classic chess with micropayments',
    color: '#6366f1',
    gradient: 'from-indigo-500/20 to-blue-500/10',
    bg: '/bg-chess.png',
  },
  {
    id: 'tiktakto',
    name: 'TikTakTo',
    url: 'http://localhost:5174',
    description: 'Tic-tac-toe with BSV wagers',
    color: '#f59e0b',
    gradient: 'from-amber-500/20 to-yellow-500/10',
    bg: '/bg-tiktakto.png',
  },
];
