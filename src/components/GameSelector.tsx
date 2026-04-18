import { GAMES } from '../games';
import type { GameConfig } from '../games';

interface GameSelectorProps {
  onSelect: (game: GameConfig) => void;
  games?: GameConfig[];
}

export function GameSelector({ onSelect, games = GAMES }: GameSelectorProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
      {games.map(game => {
        const disabled = !game.url;
        return (
          <button
            key={game.id}
            onClick={() => !disabled && onSelect(game)}
            disabled={disabled}
            className={`game-card surface-rim group relative overflow-hidden rounded-xl aspect-[4/5] w-[calc(50%-0.375rem)] sm:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)] max-w-[240px] flex flex-col justify-end text-left ${
              disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {game.bg ? (
              <img
                src={game.bg}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${game.color}33 0%, ${game.color}11 50%, #09090b 100%)`,
                }}
              />
            )}

            {/* Bottom dark gradient for title legibility */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

            {/* Hover overlay with Play button */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
              {!disabled && (
                <span className="btn-bezel btn-bezel-sm uppercase opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  Play
                </span>
              )}
            </div>

            {/* Title at bottom */}
            <div className="relative z-10 p-3">
              <h3 className="text-sm font-bold text-white leading-tight mb-0.5 drop-shadow-md line-clamp-1">{game.name}</h3>
              <p className="text-[10px] text-white/70 line-clamp-1">{game.description}</p>
              {disabled && (
                <span className="inline-block mt-1 text-[9px] shimmer-text uppercase tracking-widest font-medium">Coming Soon</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
