import { GAMES } from '../games';
import type { GameConfig } from '../games';

interface GameSelectorProps {
  onSelect: (game: GameConfig) => void;
}

export function GameSelector({ onSelect }: GameSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {GAMES.map(game => {
        const disabled = !game.url;
        return (
          <button
            key={game.id}
            onClick={() => !disabled && onSelect(game)}
            disabled={disabled}
            className={`game-card group relative overflow-hidden rounded-2xl h-52 flex flex-col justify-end text-left ${
              disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {/* Background — image or gradient fallback */}
            {game.bg ? (
              <img
                src={game.bg}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${game.color}18 0%, ${game.color}08 40%, #09090b 100%)`,
                }}
              />
            )}

            {/* Dark overlays — top for title, bottom for button */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

            {/* Title — top center */}
            <div className="absolute top-0 left-0 right-0 z-10 p-5 text-center">
              <h3 className="text-base font-bold text-white drop-shadow-lg">{game.name}</h3>
              <p className="text-[11px] text-white leading-relaxed">{game.description}</p>
            </div>

            {/* Button — bottom center */}
            <div className="relative z-10 p-5 text-center">
              {disabled ? (
                <span className="inline-block text-[10px] shimmer-text uppercase tracking-widest font-medium">Coming Soon</span>
              ) : (
                <span
                  className="inline-block px-5 py-2 text-[11px] uppercase tracking-wider font-semibold text-white rounded-lg transition-all duration-300"
                  style={{
                    background: `${game.color}cc`,
                    boxShadow: `0 0 16px ${game.color}40, 0 0 32px ${game.color}20`,
                  }}
                >
                  Play Now
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
