import React from 'react';
import { Player } from '../../types';
import WinnerConfetti from '../WinnerConfetti';

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
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-lg animate-fade-in p-4">
      <WinnerConfetti />
      <div className={`text-center p-6 sm:p-8 rounded-2xl bg-gray-950/80 border ${activeTheme.border} ${activeTheme.shadowSelected} ${isReelMode ? 'h-full max-h-full aspect-[9/16] flex flex-col justify-center overflow-y-auto custom-scrollbar' : 'max-w-2xl w-full'}`}>
        {top3.length > 0 && (
          <div className="mb-8">
            <h2 className="text-3xl sm:text-4xl font-black text-white font-orbitron mb-6" style={{textShadow: '0 0 10px rgba(255, 255, 255, 0.5)'}}>
              PÓDIO DOS CAMPEÕES
            </h2>
            <div className="grid grid-cols-3 items-end gap-1 sm:gap-4 h-56 sm:h-64 mt-4 px-2">
              {/* 2nd Place */}
              <div className="flex flex-col items-center animate-fade-in [animation-delay:1000ms] order-1">
                {top3[1] && (
                  <>
                    <div className="relative">
                      {top3[1].instagramUrl ? (
                        <a href={top3[1].instagramUrl} target="_blank" rel="noopener noreferrer" className="block hover:scale-105 transition-transform">
                          <img src={top3[1].imageUrl} alt={top3[1].name} className="w-14 h-14 sm:w-20 sm:h-20 rounded-full border-4 border-gray-300 shadow-lg object-cover bg-gray-900" />
                        </a>
                      ) : (
                        <img src={top3[1].imageUrl} alt={top3[1].name} className="w-14 h-14 sm:w-20 sm:h-20 rounded-full border-4 border-gray-300 shadow-lg object-cover bg-gray-900" />
                      )}
                      <div className="absolute -bottom-2 -right-2 bg-gray-300 text-gray-800 font-bold rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center border-2 border-gray-900 shadow-md text-xs sm:text-base">
                        🥈
                      </div>
                    </div>
                    <div className="mt-2 bg-gradient-to-t from-gray-500/50 to-gray-300/30 w-full h-24 sm:h-32 rounded-t-lg flex items-start justify-center pt-2 shadow-inner border-t border-x border-gray-400/30">
                      <span className="font-bold text-gray-300 text-lg sm:text-xl">2º</span>
                    </div>
                    {top3[1].instagramUrl ? (
                      <a href={top3[1].instagramUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-gray-300 mt-2 text-[10px] sm:text-sm truncate w-full text-center hover:text-white hover:underline transition-all">
                        {top3[1].name} 🔗
                      </a>
                    ) : (
                      <p className="font-bold text-gray-300 mt-2 text-[10px] sm:text-sm truncate w-full text-center">{top3[1].name}</p>
                    )}
                  </>
                )}
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center animate-fade-in [animation-delay:500ms] z-10 order-2 scale-110 sm:scale-125 origin-bottom">
                {top3[0] && (
                  <>
                    <div className="relative mb-2">
                      {top3[0].instagramUrl ? (
                        <a href={top3[0].instagramUrl} target="_blank" rel="noopener noreferrer" className="block hover:scale-105 transition-transform">
                          <img src={top3[0].imageUrl} alt={top3[0].name} className="w-20 h-20 sm:w-28 sm:h-28 rounded-full border-4 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] object-cover bg-gray-900" />
                        </a>
                      ) : (
                        <img src={top3[0].imageUrl} alt={top3[0].name} className="w-20 h-20 sm:w-28 sm:h-28 rounded-full border-4 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] object-cover bg-gray-900" />
                      )}
                      <div className="absolute -bottom-3 -right-3 bg-yellow-400 text-yellow-900 font-bold rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border-2 border-yellow-900 shadow-lg text-sm sm:text-xl">
                        🥇
                      </div>
                    </div>
                    <div className="bg-gradient-to-t from-yellow-600/60 to-yellow-400/40 w-full h-32 sm:h-44 rounded-t-lg flex items-start justify-center pt-2 shadow-inner border-t border-x border-yellow-400/50">
                      <span className="font-black text-yellow-200 text-xl sm:text-2xl">1º</span>
                    </div>
                    {top3[0].instagramUrl ? (
                      <a href={top3[0].instagramUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-yellow-400 mt-2 text-xs sm:text-base truncate w-full text-center hover:text-yellow-200 hover:underline transition-all" style={{textShadow: '0 0 5px rgba(250, 204, 21, 0.5)'}}>
                         {top3[0].name} 🔗
                      </a>
                    ) : (
                      <p className="font-bold text-yellow-400 mt-2 text-xs sm:text-base truncate w-full text-center" style={{textShadow: '0 0 5px rgba(250, 204, 21, 0.5)'}}>{top3[0].name}</p>
                    )}
                  </>
                )}
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center animate-fade-in [animation-delay:1500ms] order-3">
                {top3[2] && (
                  <>
                    <div className="relative">
                      {top3[2].instagramUrl ? (
                        <a href={top3[2].instagramUrl} target="_blank" rel="noopener noreferrer" className="block hover:scale-105 transition-transform">
                          <img src={top3[2].imageUrl} alt={top3[2].name} className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-amber-700 shadow-lg object-cover bg-gray-900" />
                        </a>
                      ) : (
                        <img src={top3[2].imageUrl} alt={top3[2].name} className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-amber-700 shadow-lg object-cover bg-gray-900" />
                      )}
                      <div className="absolute -bottom-2 -right-2 bg-amber-700 text-amber-100 font-bold rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center border-2 border-amber-900 shadow-md text-[10px] sm:text-sm">
                        🥉
                      </div>
                    </div>
                    <div className="mt-2 bg-gradient-to-t from-amber-800/50 to-amber-600/30 w-full h-16 sm:h-24 rounded-t-lg flex items-start justify-center pt-2 shadow-inner border-t border-x border-amber-700/30">
                      <span className="font-bold text-amber-200 text-base sm:text-lg">3º</span>
                    </div>
                    {top3[2].instagramUrl ? (
                      <a href={top3[2].instagramUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-amber-700 mt-2 text-[10px] sm:text-xs truncate w-full text-center hover:text-amber-500 hover:underline transition-all">
                        {top3[2].name} 🔗
                      </a>
                    ) : (
                      <p className="font-bold text-amber-700 mt-2 text-[10px] sm:text-xs truncate w-full text-center">{top3[2].name}</p>
                    )}
                  </>
                )}
              </div>
            </div>
            
            {top3[0] && (
              <div className="mt-4 sm:mt-8 bg-white/5 p-3 sm:p-4 rounded-xl border border-yellow-400/20 animate-fade-in [animation-delay:2000ms]">
                <p className="text-sm sm:text-lg text-gray-400">O grande campeão sobreviveu com o poder de</p>
                <div className="flex flex-col items-center gap-1 mt-2">
                    <p className="text-lg sm:text-xl font-black text-yellow-400 uppercase tracking-tighter">{top3[0].name}</p>
                    <p className="text-xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 font-orbitron">{top3[0].power}</p>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="my-6 h-px bg-white/10"></div>
        
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <button onClick={playAgain} className={`w-full ${activeTheme.bg} ${activeTheme.hoverBg} text-white font-bold py-3 px-4 rounded-lg transition-all`}>
            Jogar Novamente
          </button>
          <button onClick={resetGame} className="w-full bg-gray-600/50 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all">
            Carregar Outros Lutadores
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinishScreen;
