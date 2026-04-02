import React from 'react';
import { Player, BattleEvent, GameState } from '../../types';
import BattleLog from '../BattleLog';
import { getSafeImageUrl } from '../../utils/gameUtils';

interface ControlPanelProps {
  activeTheme: any;
  totalAliveCount: number;
  totalPlayers: number;
  followedPlayer: Player | null;
  gameState: GameState;
  handleUnfollow: () => void;
  battleLog: BattleEvent[];
  isControlPanelOpen: boolean;
  setIsControlPanelOpen: (open: boolean) => void;
  resetGame: () => void;
  isReelMode: boolean;
  setIsReelMode: (val: boolean) => void;
  bgmVolume: number;
  setBgmVolume: (vol: number) => void;
  sfxVolume: number;
  setSfxVolume: (vol: number) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = (props) => {
  const {
    activeTheme, totalAliveCount, totalPlayers, followedPlayer,
    gameState, handleUnfollow, battleLog, isControlPanelOpen,
    setIsControlPanelOpen, resetGame, isReelMode, setIsReelMode,
    bgmVolume, setBgmVolume,
    sfxVolume, setSfxVolume
  } = props;

  const panelWrapperClasses = `z-10 transition-transform duration-500 ease-in-out ${
    isReelMode 
      ? `absolute bottom-0 left-0 w-full h-[60%] sm:h-1/2 ${isControlPanelOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)]'}`
      : `absolute bottom-0 left-0 w-full h-[60%] sm:h-1/2 lg:top-0 lg:right-0 lg:bottom-auto lg:left-auto lg:h-full flex-shrink-0 lg:w-[320px] xl:w-[400px] ${isControlPanelOpen ? 'translate-y-0 lg:translate-x-0' : 'translate-y-[calc(100%-3rem)] lg:translate-y-0 lg:translate-x-full'}`
  }`;

  return (
    <div className={panelWrapperClasses}>
      <div className={`h-full w-full flex flex-col gap-4 p-4 bg-gray-950/90 backdrop-blur-xl border-t ${activeTheme.border} lg:border-l lg:border-t-0 rounded-t-3xl lg:rounded-none overflow-hidden relative`}
       style={{ 
          backgroundImage: `radial-gradient(circle at 1px 1px, ${activeTheme.dotColor} 1px, transparent 0)`,
          backgroundSize: '2rem 2rem'
      }}>
         {/* Push/Pull Handle */}
        <button
          onClick={() => setIsControlPanelOpen(!isControlPanelOpen)}
          className="lg:hidden absolute top-0 left-0 right-0 h-12 flex items-center justify-center group"
          aria-label={isControlPanelOpen ? "Recolher" : "Expandir"}
        >
            <div className="w-12 h-1.5 bg-gray-700 group-hover:bg-gray-500 rounded-full transition-colors"></div>
            {!isControlPanelOpen && (
               <div className="absolute -top-10 flex items-center gap-2 bg-black/60 px-4 py-1.5 rounded-full border border-white/20 text-xs font-bold text-white whitespace-nowrap animate-bounce">
                  Vivos: <span className="text-green-400">{totalAliveCount}</span>
               </div>
            )}
        </button>

        <div className="flex-shrink-0 pt-8 lg:pt-0">
            <h2 className={`text-xl lg:text-2xl font-bold font-orbitron text-center ${activeTheme.text}`} style={{textShadow: activeTheme.textGlow} as any}>Painel de Controle</h2>
            <div className="mt-1 text-center text-base lg:text-lg">
              Vivos: <span className="font-bold text-green-400 animate-pulse">{totalAliveCount}</span> / {totalPlayers}
            </div>
        </div>

        {followedPlayer && (
          <div className="flex-shrink-0 bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-yellow-400/30 shadow-lg animate-fade-in">
            <div className="flex items-center gap-3">
              {followedPlayer.instagramUrl ? (
                <a href={followedPlayer.instagramUrl} target="_blank" rel="noopener noreferrer" className="block hover:scale-110 transition-transform flex-shrink-0">
                  <img src={getSafeImageUrl(followedPlayer.imageUrl, followedPlayer.name, true)} alt={followedPlayer.name} className="w-10 h-10 lg:w-12 lg:h-12 rounded-full border-2 border-yellow-400 shadow-inner object-cover" />
                </a>
              ) : (
                <img src={getSafeImageUrl(followedPlayer.imageUrl, followedPlayer.name, true)} alt={followedPlayer.name} className="w-10 h-10 lg:w-12 lg:h-12 rounded-full border-2 border-yellow-400 shadow-inner object-cover" />
              )}
              <div className="flex-grow min-w-0">
                {followedPlayer.instagramUrl ? (
                  <a href={followedPlayer.instagramUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-yellow-300 truncate hover:text-yellow-100 hover:underline transition-all flex items-center gap-1">
                    {followedPlayer.name} <span className="text-[10px]">🔗</span>
                  </a>
                ) : (
                  <p className="font-bold text-yellow-300 truncate">{followedPlayer.name}</p>
                )}
                <p className="text-[10px] lg:text-xs text-gray-300 truncate opacity-80">{followedPlayer.power}</p>
                <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1 border border-white/5">
                  <div className="bg-gradient-to-r from-green-500 to-green-300 h-full rounded-full transition-all duration-300" style={{ width: `${(followedPlayer.hp / followedPlayer.maxHp) * 100}%` }}></div>
                </div>
              </div>
              <button onClick={handleUnfollow} className="bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-full p-2 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
          </div>
        )}

        <div className="flex-grow min-h-0 relative">
            <BattleLog events={battleLog} />
        </div>

        {/* Mid-Battle Audio Controls */}
        <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-4 flex-shrink-0">
            <div className="space-y-3">
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase tracking-widest"><span>Música</span><span>{Math.round(bgmVolume * 100)}%</span></div>
                    <input type="range" min="0" max="1" step="0.01" value={bgmVolume} onChange={(e) => setBgmVolume(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase tracking-widest"><span>Efeitos</span><span>{Math.round(sfxVolume * 100)}%</span></div>
                    <input type="range" min="0" max="1" step="0.01" value={sfxVolume} onChange={(e) => setSfxVolume(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500" />
                </div>
            </div>
        </div>


        <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setIsReelMode(false)} 
              className={`py-2.5 rounded-xl font-bold text-xs transition-all border ${!isReelMode ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-gray-800/80 border-gray-600 text-gray-500'}`}
            >
              Horizontal
            </button>
            <button 
              onClick={() => setIsReelMode(true)} 
              className={`py-2.5 rounded-xl font-bold text-xs transition-all border ${isReelMode ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-gray-800/80 border-gray-600 text-gray-500'}`}
            >
              Vertical
            </button>
          </div>
          <button onClick={resetGame} className="w-full bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-red-100 font-bold py-2.5 px-4 rounded-xl transition-all text-sm">
            Parar Batalha
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
