import React from 'react';

interface AudioSettingsProps {
  isMuted: boolean;
  setIsMuted: (m: boolean) => void;
  bgmVolume: number;
  setBgmVolume: (v: number) => void;
  sfxVolume: number;
  setSfxVolume: (v: number) => void;
  narrationVolume: number;
  setNarrationVolume: (v: number) => void;
  isNarrationEnabled: boolean;
  setIsNarrationEnabled: (e: boolean) => void;
  isOpen: boolean;
  onClose: () => void;
}

const AudioSettings: React.FC<AudioSettingsProps> = (props) => {
  const {
    isMuted, setIsMuted,
    bgmVolume, setBgmVolume,
    sfxVolume, setSfxVolume,
    narrationVolume, setNarrationVolume,
    isNarrationEnabled, setIsNarrationEnabled,
    isOpen, onClose
  } = props;

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 z-[100] w-64 bg-gray-900/90 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-2xl animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-orbitron font-bold text-sm tracking-tight">Configurações de Áudio</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Master Mute */}
        <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5">
          <span className="text-xs font-bold text-gray-300 uppercase">Silenciar Tudo</span>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`w-10 h-5 rounded-full transition-all relative ${isMuted ? 'bg-red-500' : 'bg-green-500'}`}
          >
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isMuted ? 'left-6' : 'left-1'}`}></div>
          </button>
        </div>

        {/* Music Volume */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <span>Música</span>
            <span>{Math.round(bgmVolume * 100)}%</span>
          </div>
          <input 
            type="range" min="0" max="1" step="0.01" 
            value={bgmVolume} 
            onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* SFX Volume */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <span>Efeitos</span>
            <span>{Math.round(sfxVolume * 100)}%</span>
          </div>
          <input 
            type="range" min="0" max="1" step="0.01" 
            value={sfxVolume} 
            onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
        </div>

        {/* Narration Toggle & Volume */}
        <div className="pt-2 border-t border-white/10 space-y-3">
          <button 
            onClick={() => setIsNarrationEnabled(!isNarrationEnabled)}
            className={`w-full py-2 rounded-xl border text-[10px] font-bold font-orbitron transition-all flex items-center justify-center gap-2 ${
              isNarrationEnabled ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-gray-800 border-gray-600 text-gray-500'
            }`}
          >
            {isNarrationEnabled ? '🎙️ NARRAÇÃO ATIVA' : '🔇 NARRAÇÃO DESLIGADA'}
          </button>
          
          <div className={`space-y-1 transition-opacity ${!isNarrationEnabled ? 'opacity-30' : ''}`}>
            <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <span>Voz do Narrador</span>
              <span>{Math.round(narrationVolume * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.01" 
              value={narrationVolume} 
              onChange={(e) => setNarrationVolume(parseFloat(e.target.value))}
              disabled={!isNarrationEnabled}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioSettings;
