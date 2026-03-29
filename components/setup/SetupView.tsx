import React from 'react';
import { GameMode, Platform } from '../../types';
import { gameModeDetails, themes } from '../../constants/gameConfig';

interface SetupViewProps {
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  playerSizeMultiplier: number;
  setPlayerSizeMultiplier: (size: number) => void;
  isNarrationEnabled: boolean;
  setIsNarrationEnabled: (enabled: boolean) => void;
  bgmVolume: number;
  setBgmVolume: (vol: number) => void;
  sfxVolume: number;
  setSfxVolume: (vol: number) => void;
  narrationVolume: number;
  setNarrationVolume: (vol: number) => void;
  profileName: string;
  setProfileName: (name: string) => void;
  platform: Platform;
  setPlatform: (p: Platform) => void;
  jsonInput: string;
  setJsonInput: (val: string) => void;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoiceURI: string;
  setSelectedVoiceURI: (uri: string) => void;
  targetDuration: number;
  setTargetDuration: (dur: number) => void;
  isSpectatorMode: boolean;
  startSpectatorMode: () => void;
  processJsonData: (content: string, platform: Platform) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleChooseFileClick: () => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  loadInstagramData: () => void;
  isAutoLoading: boolean;
  scrapeFromBot: (username: string) => void;
  botStatus: 'idle' | 'running' | 'success' | 'error';
  botError: string | null;
  botLogs: string[];
  // License System Props
  licenseKey: string;
  setLicenseKey: (key: string) => void;
  isAuthorized: boolean;
  isAdmin: boolean;
  isValidatingKey: boolean;
  isDraggingOver?: boolean;
}

const SetupView: React.FC<SetupViewProps> = (props) => {
  const { 
    gameMode, setGameMode, playerSizeMultiplier, setPlayerSizeMultiplier,
    isNarrationEnabled, setIsNarrationEnabled, bgmVolume, setBgmVolume,
    sfxVolume, setSfxVolume, narrationVolume, setNarrationVolume,
    profileName, setProfileName, platform, setPlatform, jsonInput, setJsonInput,
    isSpectatorMode, startSpectatorMode, processJsonData, handleFileUpload,
    handleChooseFileClick, handleDragOver, handleDragLeave, handleDrop,
    fileInputRef, availableVoices, selectedVoiceURI, setSelectedVoiceURI,
    targetDuration, setTargetDuration, loadInstagramData, isAutoLoading,
    scrapeFromBot, botStatus, botError, botLogs,
    licenseKey, setLicenseKey, isAuthorized, isAdmin, isValidatingKey,
    isDraggingOver
  } = props;

  const [instagramSearch, setInstagramSearch] = React.useState('');
  const [generatedKey, setGeneratedKey] = React.useState<string | null>(null);

  const generateNewKey = async () => {
    try {
        const res = await fetch(`/api/keys/generate?adminKey=${licenseKey}`);
        const data = await res.json();
        if (data.key) setGeneratedKey(data.key);
    } catch (e) {
        alert("Erro ao gerar chave");
    }
  };

  const activeTheme = themes[gameMode].classes;

  return (
    <>
      <header className="absolute top-0 left-0 right-0 p-4 z-20 pointer-events-none text-center">
        <h1 className={`text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br ${activeTheme.titleGradientFrom} ${activeTheme.titleGradientTo} font-orbitron animate-title-glow`} style={{ '--glow-color': activeTheme.neonColor } as any}>
          Batalha Royale de Seguidores
        </h1>
        <p className="mt-2 text-gray-300 max-w-2xl mx-auto text-sm sm:text-base">
          Crie sua própria batalha simulada com seus seguidores e veja quem sobrevive!
        </p>
        {isSpectatorMode && <p className="text-yellow-400 font-bold font-orbitron animate-pulse mt-1">MODO ESPECTADOR</p>}
      </header>
      
      <div className="absolute inset-0 z-10 overflow-y-auto p-4 flex flex-col items-center pt-24 sm:pt-28">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-start my-auto">
          {/* --- Column Left: Customization --- */}
          <div className="animate-fade-in-left space-y-8 p-6 sm:p-8 bg-gray-950/40 backdrop-blur-2xl rounded-2xl border border-white/10 relative overflow-hidden">
             <div className="absolute -inset-px rounded-2xl" style={{
                background: `radial-gradient(400px at 50% 0%, ${activeTheme.neonColor}15, transparent 80%)`
             }} />
            <div className="relative z-10">
                <h2 className={`text-2xl font-bold font-orbitron mb-4 border-b border-white/10 pb-3 ${activeTheme.text}`} style={{textShadow: `0 0 8px ${activeTheme.neonColor}60`}}>1. Customize a Arena</h2>
                <div className="flex flex-col sm:flex-row gap-4">
                    {(Object.values(GameMode) as GameMode[]).filter(mode => mode === GameMode.Classic).map(mode => {
                        const isSelected = gameMode === mode;
                        const currentTheme = themes[mode].classes;
                        return (
                            <button 
                              key={mode} 
                              onClick={() => setGameMode(mode)}
                              className={`relative p-4 rounded-xl backdrop-blur-sm border-2 transition-all duration-300 transform hover:scale-105 group text-left ${isSelected ? `${currentTheme.borderSelected} scale-105 bg-black/40` : 'border-white/10 bg-black/20 hover:border-white/30'}`}>
                                <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${currentTheme.titleGradientFrom} ${currentTheme.titleGradientTo} opacity-0 group-hover:opacity-20 transition-opacity duration-300 ${isSelected ? 'opacity-25' : ''}`}/>
                                <div className="relative z-10">
                                  <div className="text-3xl mb-2">{gameModeDetails[mode].icon}</div>
                                  <h3 className={`text-base font-bold font-orbitron ${isSelected ? 'text-white' : 'text-gray-300'}`}>{gameModeDetails[mode].title}</h3>
                                  <p className="text-xs text-gray-300 mt-1">{gameModeDetails[mode].description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="relative z-10">
                 <h3 className="text-xl font-bold font-orbitron mb-4 border-b border-white/10 pb-3 text-gray-200">Configurações da Batalha</h3>
                 <div className="grid sm:grid-cols-2 gap-6 items-start">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-base font-orbitron mb-2 text-gray-300">Tamanho dos Lutadores</label>
                            <div className="flex justify-center gap-1 bg-black/30 p-1.5 rounded-full border border-white/10 w-full font-inter">
                                {[
                                    { label: 'P', value: 0.75 }, { label: 'M', value: 1.0 },
                                    { label: 'G', value: 1.25 }, { label: 'XG', value: 1.5 },
                                ].map(({ label, value }) => (
                                    <button onClick={() => setPlayerSizeMultiplier(value)} key={label}
                                        className={`w-full py-1.5 rounded-full text-sm font-bold transition-all duration-300 border-2 ${playerSizeMultiplier === value ? `${activeTheme.radioBg} border-transparent` : 'bg-transparent border-transparent text-gray-300'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-base font-orbitron mb-2 text-gray-300">Narração da Batalha</label>
                            <button 
                                onClick={() => setIsNarrationEnabled(!isNarrationEnabled)}
                                className={`w-full py-3 rounded-xl border-2 font-bold font-orbitron transition-all ${isNarrationEnabled ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-gray-800/80 border-gray-600 text-gray-500 grayscale'}`}
                            >
                                {isNarrationEnabled ? '🎙️ ATIVADA' : '🔇 DESATIVADA'}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {/* Audio Controls */}
                        <div className="bg-black/20 p-2.5 rounded-lg border border-white/5">
                            <label className="flex justify-between text-[10px] font-orbitron mb-1 text-gray-400">
                                <span>Música</span>
                                <span>{Math.round(bgmVolume * 100)}%</span>
                            </label>
                            <input type="range" min="0" max="1" step="0.01" value={bgmVolume} onChange={(e) => setBgmVolume(parseFloat(e.target.value))} className="w-full" />
                        </div>
                        <div className="bg-black/20 p-2.5 rounded-lg border border-white/5">
                            <label className="flex justify-between text-[10px] font-orbitron mb-1 text-gray-400">
                                <span>Tempo da Partida</span>
                                <span className="text-yellow-400">{targetDuration} Segundos</span>
                            </label>
                            <input type="range" min="20" max="300" step="1" value={targetDuration} onChange={(e) => setTargetDuration(parseInt(e.target.value))} className="w-full accent-yellow-500" />
                        </div>
                    </div>
                 </div>
            </div>
          </div>

          {/* --- Column Right: Main Action --- */}
          <div 
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            className={`animate-fade-in-right space-y-4 p-6 sm:p-8 bg-gray-950/60 backdrop-blur-2xl rounded-2xl border relative overflow-hidden transition-all duration-300 ${isDraggingOver ? `border-dashed border-2 ${activeTheme.borderSelected}` : `border-white/10`}`}
          >
             <div className="absolute -inset-px rounded-2xl opacity-50" style={{ background: `radial-gradient(600px at 50% 100%, ${activeTheme.neonColor}1A, transparent 80%)` }} />
             <div className="relative z-10">
                <h2 className={`text-2xl font-bold font-orbitron border-b border-white/10 pb-3 mb-4 ${activeTheme.text}`}>2. Convoque seus Lutadores</h2>
                
                {/* LICENSE KEY SECTION */}
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <label className="block text-[10px] font-bold text-blue-400 uppercase mb-2">Chave de Permissão</label>
                    <div className="relative">
                        <input 
                            type="password"
                            value={licenseKey}
                            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                            placeholder="DIGITE SUA CHAVE AQUI"
                            className={`w-full bg-black/60 border ${isAuthorized ? 'border-green-500' : 'border-white/20'} rounded-lg p-3 text-white font-mono focus:outline-none transition-all`}
                        />
                        {isValidatingKey && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
                        {isAuthorized && !isValidatingKey && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 font-bold">✓</div>}
                    </div>
                </div>

                {/* ADMIN PANEL */}
                {isAdmin && (
                    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-black text-yellow-500 uppercase">Gerador de Chaves (Admin)</h3>
                            <button onClick={generateNewKey} className="text-[10px] bg-yellow-500 text-black px-3 py-1 rounded-full font-bold">GERAR CHAVE</button>
                        </div>
                        {generatedKey && (
                            <div className="bg-black/60 p-3 rounded text-center border border-yellow-500/20">
                                <p className="text-lg font-mono font-black text-white">{generatedKey}</p>
                                <p className="text-[8px] text-gray-400 mt-1 uppercase text-yellow-500">Passe essa chave para o cliente</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-4 flex flex-col items-center gap-4 bg-black/40 p-6 rounded-xl border border-white/10">
                    <div className="w-full flex flex-col sm:flex-row gap-2">
                        <input 
                            type="text" 
                            value={instagramSearch}
                            onChange={(e) => setInstagramSearch(e.target.value)}
                            placeholder="@seu_instagram"
                            className="flex-grow bg-black/40 border border-white/20 rounded-lg p-3 text-white font-mono focus:outline-none focus:border-pink-500"
                        />
                        <button 
                             onClick={() => scrapeFromBot(instagramSearch)} 
                             disabled={botStatus === 'running' || !instagramSearch || !isAuthorized}
                             className={`bg-gradient-to-r from-pink-600 to-purple-600 hover:scale-105 text-white font-black py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:grayscale`}>
                            {botStatus === 'running' ? 'RODANDO...' : (isAuthorized ? 'INICIAR ROBÔ' : 'BLOQUEADO')}
                        </button>
                    </div>
                    {!isAuthorized && <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Insira uma chave para liberar a extração automático</p>}
                    
                    {botStatus !== 'idle' && (
                        <div className="w-full mt-4 bg-black/80 rounded-lg p-3 h-32 overflow-y-auto font-mono text-[10px] border border-white/10">
                            {botLogs.map((log, idx) => <div key={idx} className="text-gray-400 mb-1">{log}</div>)}
                        </div>
                    )}
                </div>

                <div className="mt-8 space-y-4">
                  <input ref={fileInputRef} type="file" accept=".json,.csv" onChange={handleFileUpload} className="hidden" />
                  <button onClick={handleChooseFileClick} className={`w-full ${activeTheme.bg} text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transform hover:scale-105`}>
                     CARREGAR DO ARQUIVO...
                  </button>
                  <p className="text-center text-xs text-gray-500">OU</p>
                  <textarea 
                      value={jsonInput} 
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder="Cole os dados aqui..." 
                      className="w-full h-24 bg-black/40 border border-white/20 rounded-lg p-3 text-gray-400 font-mono text-xs"
                  />
                  <button onClick={() => processJsonData(jsonInput, platform)} disabled={!jsonInput.trim()} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg">
                    CARREGAR DADOS COLADOS
                  </button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SetupView;
