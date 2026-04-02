import React from 'react';
import { Player } from '../../types';
import WinnerConfetti from '../WinnerConfetti';
import { getSafeImageUrl } from '../../utils/gameUtils';

interface FinishScreenProps {
  activeTheme: any;
  top3: Player[];
  playAgain: () => void;
  resetGame: () => void;
  isReelMode: boolean;
}

const FinishScreen: React.FC<FinishScreenProps> = ({
  activeTheme, top3, playAgain, resetGame, isReelMode
}) => {
  const getInstagramUrl = (name: string) => {
    const username = name.replace(/^@/, '').trim();
    return `https://www.instagram.com/${username}/`;
  };

  const WinnerLink: React.FC<{ player: Player; children: React.ReactNode; className?: string }> = ({ player, children, className }) => (
    <a
      href={player.instagramUrl || getInstagramUrl(player.name)}
      target="_blank"
      rel="noopener noreferrer"
      className={`block transition-all hover:scale-105 active:scale-95 ${className || ''}`}
    >
      {children}
    </a>
  );

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0c0a15] overflow-hidden animate-fade-in">
      {/* Cinematic Background Image - Boosted visibility */}
      <img
        src="/premium_podium_background_1775137122547.png"
        className="absolute inset-0 w-full h-full object-cover opacity-85 scale-110 animate-[slow-zoom_20s_infinite_alternate]"
        alt="Battle Arena background"
      />
      {/* Refined Overlay for better asset visibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c0a15]/70 via-transparent to-[#0c0a15]/90 backdrop-blur-[1px]" />

      <WinnerConfetti />

      <div className={`relative z-10 text-center p-3 sm:p-8 rounded-[2rem] glass-premium border-white/10 max-h-[98vh] overflow-y-auto custom-scrollbar ${isReelMode ? 'h-full max-h-full aspect-[9/16] flex flex-col justify-center' : 'max-w-4xl w-full mx-auto'}`}>

        {top3.length > 0 && (
          <div className="flex flex-col h-full">
            <h2 className="text-2xl sm:text-5xl font-black text-white font-orbitron mb-4 sm:mb-10 tracking-tighter animate-title-glow" style={{ '--glow-color': 'rgba(255,255,255,0.3)' } as React.CSSProperties}>
              CONFRONTO FINAL
            </h2>

            <div className={`grid grid-cols-3 items-end gap-2 sm:gap-6 px-2 relative ${isReelMode ? 'min-h-[250px] mb-4' : 'min-h-[400px] mb-8'}`}>

              {/* 🥈 2nd PLACE */}
              <div className="flex flex-col items-center order-1 group h-full justify-end">
                {top3[1] && (
                  <div className="flex flex-col items-center w-full">
                    <div className="relative mb-3 sm:mb-6 animate-winner-float [animation-delay:0.2s]">
                      <WinnerLink player={top3[1]}>
                        <div className="relative p-1 rounded-full bg-gradient-to-tr from-slate-400 via-white to-slate-300 shadow-[0_0_30px_rgba(148,163,184,0.4)] border border-white/20">
                          <img src={getSafeImageUrl(top3[1].imageUrl, top3[1].name, true)} alt={top3[1].name} className="w-12 h-12 sm:w-26 sm:h-26 rounded-full border-2 border-black/40 object-cover bg-gray-900 shadow-inner" />
                        </div>
                        <div className="absolute -top-1 -left-1 bg-slate-500 text-white rounded-full w-5 h-5 sm:w-8 sm:h-8 flex items-center justify-center border border-white/40 shadow-lg text-[10px] sm:text-xs font-black">
                          🥈
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-slate-200 to-slate-500 text-slate-950 font-black rounded-full w-6 h-6 sm:w-10 sm:h-10 flex items-center justify-center border-2 border-white/50 shadow-xl text-xs sm:text-lg">
                          2
                        </div>
                      </WinnerLink>
                    </div>

                    <div className="animate-podium-rise [animation-delay:0.5s] w-full origin-bottom relative">
                      <div className="bg-gradient-to-b from-slate-400/40 via-slate-400/10 to-transparent border-t-2 border-x border-white/30 h-28 sm:h-36 rounded-t-3xl flex flex-col items-center justify-start pt-2 sm:pt-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-md">
                        <span className="font-black text-slate-200 text-lg sm:text-4xl opacity-20">SILVER</span>
                      </div>
                      {/* Name inside/over the bar for robustness */}
                      <div className="absolute inset-x-0 -bottom-2 flex justify-center">
                        <WinnerLink player={top3[1]} className="font-bold text-slate-100 bg-slate-900/90 backdrop-blur-lg px-3 py-1 rounded-full text-[8px] sm:text-xs tracking-tighter hover:bg-slate-500/80 transition-colors border border-white/20 max-w-[95%] truncate shadow-lg">
                          @{top3[1].name.replace('@', '')}
                        </WinnerLink>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 🥇 1st PLACE */}
              <div className="flex flex-col items-center order-2 z-10 scale-110 sm:scale-125 origin-bottom relative -top-2 sm:-top-8 h-full justify-end">
                {top3[0] && (
                  <div className="flex flex-col items-center w-full">
                    <div className="relative mb-4 sm:mb-10 animate-winner-float">
                      <div className="absolute -top-10 sm:-top-14 left-1/2 -translate-x-1/2 -ml-4 text-3xl sm:text-5xl animate-bounce pointer-events-none drop-shadow-[0_0_15px_rgba(234,179,8,0.8)] z-50">👑</div>
                      <WinnerLink player={top3[0]}>
                        <div className="relative p-1.5 rounded-full bg-gradient-to-tr from-yellow-600 via-yellow-100 to-yellow-500 animate-aura-pulse p-[3px] shadow-[0_0_50px_rgba(234,179,8,0.5)] border border-yellow-200/50">
                          <div className="bg-black rounded-full p-0.5">
                            <img src={getSafeImageUrl(top3[0].imageUrl, top3[0].name, true)} alt={top3[0].name} className="w-16 h-16 sm:w-32 sm:h-32 rounded-full border-2 border-yellow-500/30 object-cover bg-gray-900 shadow-2xl" />
                          </div>
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-yellow-100 via-yellow-400 to-yellow-600 text-yellow-950 font-black rounded-full w-8 h-8 sm:w-14 sm:h-14 flex items-center justify-center border-2 sm:border-4 border-yellow-800/40 shadow-[0_4px_15px_rgba(0,0,0,0.5)] text-sm sm:text-3xl">
                          1
                        </div>
                      </WinnerLink>
                    </div>

                    <div className="animate-podium-rise [animation-delay:0.2s] w-full origin-bottom relative">
                      <div className="bg-gradient-to-b from-yellow-500/60 via-yellow-500/10 to-transparent border-t-4 border-x border-yellow-400/50 h-36 sm:h-56 rounded-t-[2.5rem] flex flex-col items-center justify-start pt-3 sm:pt-6 shadow-[inset_0_2px_4px_rgba(255,255,255,0.5)] backdrop-blur-xl">
                        <span className="font-black text-yellow-100 text-2xl sm:text-6xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">🏆</span>
                        <span className="hidden sm:block font-black text-yellow-100/60 text-xs mt-2 tracking-[0.3em] uppercase italic drop-shadow-sm">CHAMPION</span>
                      </div>
                      {/* Name inside/over the bar for robustness */}
                      <div className="absolute inset-x-0 -bottom-4 flex justify-center z-20">
                        <WinnerLink player={top3[0]} className="font-black text-yellow-950 bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 px-5 py-1.5 rounded-full text-[12px] sm:text-lg tracking-tight shadow-[0_5px_15px_rgba(234,179,8,0.4)] border-2 border-yellow-100/50 max-w-[100%] truncate animate-pulse">
                          @{top3[0].name.replace('@', '')}
                        </WinnerLink>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 🥉 3rd PLACE */}
              <div className="flex flex-col items-center order-3 h-full justify-end">
                {top3[2] && (
                  <div className="flex flex-col items-center w-full">
                    <div className="relative mb-3 sm:mb-6 animate-winner-float [animation-delay:0.4s]">
                      <WinnerLink player={top3[2]}>
                        <div className="relative p-1 rounded-full bg-gradient-to-tr from-amber-700 via-amber-200 to-amber-600 shadow-[0_0_25px_rgba(180,83,9,0.4)] border border-white/10">
                          <img src={getSafeImageUrl(top3[2].imageUrl, top3[2].name, true)} alt={top3[2].name} className="w-11 h-11 sm:w-22 sm:h-22 rounded-full border-2 border-black/30 object-cover bg-gray-900" />
                        </div>
                        <div className="absolute -top-1 -right-1 bg-amber-700 text-white rounded-full w-4 h-4 sm:w-7 sm:h-7 flex items-center justify-center border border-white/30 shadow-lg text-[8px] sm:text-[10px] font-black">
                          🥉
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-amber-500 to-amber-900 text-amber-50 font-black rounded-full w-5 h-5 sm:w-9 sm:h-9 flex items-center justify-center border-2 border-white/40 shadow-xl text-[10px] sm:text-base">
                          3
                        </div>
                      </WinnerLink>
                    </div>

                    <div className="animate-podium-rise [animation-delay:0.8s] w-full origin-bottom relative">
                      <div className="bg-gradient-to-b from-amber-700/40 via-amber-700/5 to-transparent border-t border-x border-white/20 h-22 sm:h-32 rounded-t-2xl flex flex-col items-center justify-start pt-2 sm:pt-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-sm">
                        <span className="font-bold text-amber-200/30 text-base sm:text-3xl">BRONZE</span>
                      </div>
                      {/* Name inside/over the bar for robustness */}
                      <div className="absolute inset-x-0 -bottom-2 flex justify-center">
                        <WinnerLink player={top3[2]} className="font-bold text-amber-100 bg-amber-950/90 backdrop-blur-lg px-2 py-0.5 rounded-full text-[8px] sm:text-xs tracking-tighter hover:bg-amber-700 transition-colors border border-white/10 max-w-[90%] truncate shadow-lg">
                          @{top3[2].name.replace('@', '')}
                        </WinnerLink>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {top3[0] && (
              <div className={`p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-yellow-500/10 via-white/5 to-yellow-500/10 border border-white/10 animate-fade-in [animation-delay:2.5s] relative overflow-hidden group ${isReelMode ? 'mt-4' : 'mt-12'}`}>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <p className="text-[10px] sm:text-base text-gray-500 font-bold tracking-widest uppercase">GRANDE CAMPEÃO SOBREVIVEU COM:</p>
                <div className="flex flex-col items-center gap-1 mt-2">
                  <p className="text-xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-yellow-500 font-orbitron tracking-tighter uppercase">
                    {top3[0].power}
                  </p>
                  <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-yellow-500 to-transparent rounded-full opacity-30 mt-1" />
                </div>
              </div>
            )}

            <div className={`mt-auto pt-6 flex flex-col sm:flex-row gap-3 sm:gap-6 max-w-2xl mx-auto w-full`}>
              <button
                onClick={playAgain}
                className={`w-full py-3 sm:py-4 px-4 sm:px-8 rounded-2xl font-black text-sm sm:text-lg tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl ${activeTheme.bg} hover:brightness-125 border-b-4 border-black/20 text-white`}
              >
                JOGAR NOVAMENTE
              </button>
              <button
                onClick={resetGame}
                className="w-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white py-3 sm:py-4 px-4 sm:px-8 rounded-2xl font-bold transition-all border border-white/5 text-xs sm:text-base"
              >
                OUTROS LUTADORES
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default FinishScreen;
