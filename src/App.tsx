import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { BGM_PLAYLIST, themes, AOE_RADIUS, METEOR_RADIUS } from './constants/gameConfig';
import { getPlayerSize, getColorFromId, getSafeImageUrl } from './utils/gameUtils';
import { useBattleAudio } from './hooks/useBattleAudio';
import { usePlayerManager } from './hooks/usePlayerManager';
import { useBattleEngine } from './hooks/useBattleEngine';
import { generateDemoPlayers } from './services/demoPlayerService';
import { HitEffect, Player, GameState } from './types';

// Components
import SetupView from './components/setup/SetupView';
import BattleArena from './components/battle/BattleArena';
import ControlPanel from './components/battle/ControlPanel';
import FinishScreen from './components/battle/FinishScreen';
import CountdownOverlay from './components/battle/CountdownOverlay';
import DynamicBackground from './components/backgrounds/DynamicBackground';
import Subtitles from './components/battle/Subtitles';
import AudioSettings from './components/battle/AudioSettings';
import { DEFAULT_AVATAR } from './constants/assets';

const App: React.FC = () => {
  // 1. Hooks initialization
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});
  const [targetDuration, setTargetDuration] = useState(60);

  // Audio Hook - provides playBeep, narrateText, etc.
  const audio = useBattleAudio(); 
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
  
  // Data Manager Hook
  const playerManager = usePlayerManager(useCallback((text, type) => {
    // Proxy to engine log if needed, but engine is the primary log source
  }, []));

  // Engine Hook
  const engine = useBattleEngine(
    playerManager.players, 
    playerManager.setPlayers, 
    playerManager.playersRef, 
    playerManager.totalPlayersRef,
    playerManager.allPlayersRef,
    audio,
    imageCache,
    targetDuration
  );

  // Sync engine state with audio hook manually to avoid circular dependencies
  useEffect(() => {
    if (audio.setGameState) {
      audio.setGameState(engine.gameState);
    }
  }, [engine.gameState, audio]);

  // Combined BGM logic is now handled inside useBattleAudio to reduce App.tsx clutter


  // 2. Extra App-level logic
  const activeTheme = themes[engine.gameMode].classes;
  const totalAliveCount = engine.totalAliveCount;

  // Ensure narration stops on game end
  useEffect(() => {
    if (engine.gameState === GameState.Finished || engine.gameState === GameState.AwaitingPlayers) {
        audio.stopNarration();
    }
  }, [engine.gameState, audio]);

  const handleUnfollow = () => engine.setFollowedPlayerId(null);
  const followedPlayer = useMemo(() => playerManager.players.find(p => p.id === engine.followedPlayerId), [playerManager.players, engine.followedPlayerId]);

  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [hoveredPlayerName, setHoveredPlayerName] = useState<string | null>(null);
  const hoveredPlayerRef = useRef<Player | null>(null);


  // 3. Helper functions that depend on state/refs
  const getArenaTransform = () => {
      const transition = 'transform 1.5s ease-in-out';
      const playerToFollow = followedPlayer || engine.winner;

      if (playerToFollow && engine.arenaRef.current) {
          let zoom = engine.winner ? 2.5 : 1.7;
          const arena = engine.arenaRef.current;
          const targetX = arena.clientWidth / 2;
          const targetY = arena.clientHeight / 2;
          const translateX = targetX - playerToFollow.x * zoom;
          const translateY = targetY - playerToFollow.y * zoom;

          return { transform: `scale(${zoom}) translate(${translateX}px, ${translateY}px)`, transition };
      }
      return { transform: 'scale(1) translate(0px, 0px)', transition };
  };

  const getEffectClass = (type: HitEffect['type']) => {
    switch(type) {
      case 'aoe': return 'aoe-effect';
      case 'aoe-caster': return 'aoe-caster-effect';
      case 'meteor': return 'meteor-effect';
      default: return 'hit-effect';
    }
  };

  const getEffectStyle = (effect: HitEffect): React.CSSProperties => {
    const style: React.CSSProperties = {
        left: effect.x, top: effect.y, color: effect.color, transform: `translate(-50%, -50%)`, position: 'absolute'
    };
    if (effect.type === 'aoe') { style.width = `${AOE_RADIUS * 2}px`; style.height = `${AOE_RADIUS * 2}px`; }
    else if (effect.type === 'meteor') { style.width = `${METEOR_RADIUS * 2}px`; style.height = `${METEOR_RADIUS * 2}px`; }
    else if (effect.type === 'aoe-caster' && effect.size) { style.width = `${effect.size}px`; style.height = `${effect.size}px`; }
    else { style.width = '40px'; style.height = '40px'; }
    return style;
  };

  const getTransformedMouseCoords = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = engine.canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const transform = new DOMMatrix(getComputedStyle(canvas.parentElement!).transform);
    return {
        x: (event.clientX - rect.left - transform.e) / transform.a,
        y: (event.clientY - rect.top - transform.f) / transform.d
    };
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isControlPanelOpen) { setIsControlPanelOpen(false); return; }
    
    // Optimization: Disable deep click detection for massive battles
    if (engine.totalAliveCount > 1000) return;

    const coords = getTransformedMouseCoords(event);
    if (!coords) return;
    
    const arenaWidth = engine.canvasRef.current?.clientWidth || 1920;
    const totalToScaleAgainst = Math.max(engine.totalAliveCount, playerManager.totalPlayersRef.current);
    const pSize = getPlayerSize(totalToScaleAgainst, arenaWidth) * engine.playerSizeMultiplier;
    let clicked = null;
    const alive = playerManager.players.filter(p => p.isAlive);
    for (let i = alive.length - 1; i >= 0; i--) {
        const p = alive[i];
        const dx = coords.x - p.x; const dy = coords.y - p.y;
        if (dx * dx + dy * dy <= (pSize/2) * (pSize/2)) { clicked = p; break; }
    }
    if (clicked) engine.setFollowedPlayerId(clicked.id);
    else handleUnfollow();
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setTooltipPosition({ x: event.clientX, y: event.clientY });
    
    // Optimization: Disable hover tooltips for massive battles (> 1000 players) to prevent UI freezing
    if (engine.totalAliveCount > 1000) {
        if (hoveredPlayerName) setHoveredPlayerName(null);
        return;
    }

    const coords = getTransformedMouseCoords(event);
    if (!coords) { setHoveredPlayerName(null); return; }

    const arenaWidth = engine.canvasRef.current?.clientWidth || 1920;
    const totalToScaleAgainst = Math.max(engine.totalAliveCount, playerManager.totalPlayersRef.current);
    const pSize = getPlayerSize(totalToScaleAgainst, arenaWidth) * engine.playerSizeMultiplier;
    if (pSize <= 12) { setHoveredPlayerName(null); return; }
    
    let found: Player | null = null;
    const alive = playerManager.players.filter(p => p.isAlive);
    for (let i = alive.length - 1; i >= 0; i--) {
        if (Math.pow(coords.x - alive[i].x, 2) + Math.pow(coords.y - alive[i].y, 2) <= Math.pow(pSize/2, 2)) {
            found = alive[i]; break;
        }
    }
    hoveredPlayerRef.current = found;
    setHoveredPlayerName(found ? found.name : null);
  };


  const startSpectatorMode = () => {
    const demo = generateDemoPlayers(50000);
    playerManager.initializePlayers(demo);
    engine.setIsSpectatorMode(true);
  };

  // Image preloading logic - Limited to a small batch to avoid congestion
  useEffect(() => {
    if (playerManager.totalPlayersRef.current === 0) return;
    
    // Only preload the first 100 players to give a smooth start
    // The rest will be loaded on-demand by the battle engine with throttling
    const playersToPreload = playerManager.allPlayersRef.current.slice(0, 100);
    
    playersToPreload.forEach(player => {
        const safeUrl = getSafeImageUrl(player.imageUrl);
        if (!imageCache.current[safeUrl]) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = safeUrl;
            img.onload = () => { imageCache.current[safeUrl] = img; };
            img.onerror = () => {
                const defImg = new Image();
                defImg.src = DEFAULT_AVATAR;
                imageCache.current[safeUrl] = defImg;
            };
        }
    });
  }, [playerManager.totalPlayersRef.current]);

  // Main Drawing Loop sync (Hook doesn't draw to DOM, it just calculates)
  // Actually, the Draw loop was inside useBattleEngine in my previous implementation.
  // I need to ensure it's drawing correctly.

  return (
    <main className="h-[100dvh] w-screen bg-[#0f071e] font-inter overflow-hidden relative">
      <DynamicBackground />
      <audio 
        ref={audio.audioRef} 
        src={BGM_PLAYLIST[audio.currentTrackIndex]} 
        onEnded={() => audio.setCurrentTrackIndex(prev => (prev + 1) % BGM_PLAYLIST.length)}
      />
      
      <button 
        onClick={() => setIsAudioSettingsOpen(!isAudioSettingsOpen)}
        className={`absolute top-4 right-4 z-50 hover:bg-black/70 p-2.5 rounded-full backdrop-blur-md border transition-all shadow-xl group ${
            isAudioSettingsOpen ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-black/50 border-white/20 text-white'
        }`}
        title="Configurações de Áudio"
      >
        <span className="text-xl group-hover:scale-110 transition-transform block">
            {audio.isMuted ? '🔇' : (isAudioSettingsOpen ? '🎧' : '🔊')}
        </span>
      </button>

      <AudioSettings 
        {...audio}
        isOpen={isAudioSettingsOpen}
        onClose={() => setIsAudioSettingsOpen(false)}
      />

      {engine.gameState === GameState.AwaitingPlayers && playerManager.totalPlayersRef.current === 0 && (
        <SetupView 
          {...playerManager}
          {...audio}
          gameMode={engine.gameMode}
          setGameMode={engine.setGameMode}
          playerSizeMultiplier={engine.playerSizeMultiplier}
          setPlayerSizeMultiplier={engine.setPlayerSizeMultiplier}
          targetDuration={targetDuration}
          setTargetDuration={setTargetDuration}
          isSpectatorMode={engine.isSpectatorMode}
          startSpectatorMode={startSpectatorMode}
          fileInputRef={fileInputRef}
          handleFileUpload={playerManager.handleFileUpload as any}
          handleChooseFileClick={() => fileInputRef.current?.click()}
          handleDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
          handleDragLeave={() => setIsDraggingOver(false)}
          handleDrop={(e) => { e.preventDefault(); setIsDraggingOver(false); playerManager.processFile(e.dataTransfer.files[0]); }}
          isDraggingOver={isDraggingOver}
          availableVoices={audio.availableVoices}
          selectedVoiceURI={audio.selectedVoiceURI}
          setSelectedVoiceURI={audio.setSelectedVoiceURI}
          processData={playerManager.processData}
          isAutoLoading={playerManager.isAutoLoading}
          scrapeFromBot={playerManager.scrapeFromBot}
          botStatus={playerManager.botStatus}
          botError={playerManager.botError}
          botLogs={playerManager.botLogs}
          licenseKey={playerManager.licenseKey}
          setLicenseKey={playerManager.setLicenseKey}
          githubToken={playerManager.githubToken}
          isAuthorized={playerManager.isAuthorized}
          isAdmin={playerManager.isAdmin}
          isValidatingKey={playerManager.isValidatingKey}
          triggerGithubAction={playerManager.triggerGithubAction}
        />
      )}
      
      {(engine.gameState !== GameState.AwaitingPlayers || playerManager.totalPlayersRef.current > 0) && (
        <div className={`w-full h-full relative transition-opacity duration-500`}>
          <div className="w-full h-full lg:pr-[320px] xl:pr-[400px] relative overflow-hidden">
            {engine.gameState === GameState.Running && playerManager.totalPlayersRef.current > 0 && (
                 <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[90%] sm:w-1/2 max-w-md">
                    <div className="text-center mb-2 text-sm sm:text-base font-black font-orbitron text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wider">
                        VIVOS: <span className="text-green-400 text-lg sm:text-2xl">{totalAliveCount}</span> <span className="text-gray-400 text-xs sm:text-sm">/ {playerManager.totalPlayersRef.current}</span>
                    </div>
                    <div className="w-full bg-black/60 backdrop-blur-md rounded-full h-3 border border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                        <div className="bg-gradient-to-r from-green-500 via-emerald-400 to-cyan-500 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(52,211,153,0.5)]" 
                             style={{ width: `${(totalAliveCount / playerManager.totalPlayersRef.current) * 100}%` }}></div>
                    </div>
                </div>
            )}
            
            <BattleArena 
                arenaRef={engine.arenaRef} 
                canvasRef={engine.canvasRef} 
                isReelMode={engine.isReelMode}
                getArenaTransform={getArenaTransform}
                handleCanvasClick={handleCanvasClick}
                handleCanvasMouseMove={handleCanvasMouseMove}
                handleCanvasMouseLeave={() => setHoveredPlayerName(null)}
            />

            <Subtitles text={audio.currentNarration} />

             {engine.gameState === GameState.AwaitingPlayers && playerManager.totalPlayersRef.current > 0 && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md p-6 text-center">
                <div className="animate-fade-in-up">
                  <h2 className={`text-3xl sm:text-5xl font-black font-orbitron text-white mb-4 ${activeTheme.textGlow}`}>Arena Pronta!</h2>
                  <p className="text-lg sm:text-2xl text-gray-200 mb-10 font-orbitron">{playerManager.totalPlayersRef.current} lutadores aguardam.</p>
                  <button onClick={engine.startBattle} className={`animate-pulse-strong text-white font-black py-5 px-10 sm:py-8 sm:px-16 rounded-3xl text-2xl sm:text-4xl font-orbitron transition-all ${activeTheme.bg} ${activeTheme.hoverBg} border-2 ${activeTheme.borderSelected} shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95`}>
                      INICIAR BATALHA
                  </button>
                  <button onClick={engine.resetGame} className="block mt-8 mx-auto text-gray-400 hover:text-white underline font-bold tracking-tight">Carregar outros lutadores</button>
                </div>
              </div>
            )}
          </div>
          
          <ControlPanel 
            activeTheme={activeTheme}
            totalAliveCount={totalAliveCount}
            totalPlayers={playerManager.totalPlayersRef.current}
            followedPlayer={followedPlayer || null}
            gameState={engine.gameState}
            handleUnfollow={handleUnfollow}
            battleLog={engine.battleLog}
            isControlPanelOpen={isControlPanelOpen}
            setIsControlPanelOpen={setIsControlPanelOpen}
            resetGame={engine.resetGame}
            isReelMode={engine.isReelMode}
            setIsReelMode={engine.setIsReelMode}
            isNarrationEnabled={audio.isNarrationEnabled}
            setIsNarrationEnabled={audio.setIsNarrationEnabled}
            bgmVolume={audio.bgmVolume}
            setBgmVolume={audio.setBgmVolume}
            sfxVolume={audio.sfxVolume}
            setSfxVolume={audio.setSfxVolume}
            narrationVolume={audio.narrationVolume}
            setNarrationVolume={audio.setNarrationVolume}
          />
        </div>
      )}
      
      {engine.gameState === GameState.Finished && (
        <FinishScreen 
            activeTheme={activeTheme}
            top3={engine.top3}
            playAgain={engine.playAgain}
            resetGame={engine.resetGame}
            isReelMode={engine.isReelMode}
        />
      )}
      
      {engine.gameState === GameState.Countdown && (
        <CountdownOverlay countdown={engine.countdown} activeTheme={activeTheme} />
      )}

      {hoveredPlayerName && (
        <div 
          className="absolute z-50 p-3 bg-gray-900/80 backdrop-blur-sm text-white rounded-lg pointer-events-none text-sm border border-white/20 shadow-lg"
          style={{ left: tooltipPosition.x + 15, top: tooltipPosition.y + 15 }}
        >
            <p className="font-bold">{hoveredPlayerName}</p>
        </div>
      )}

      {/* Styles preserved from original App.tsx */}
      <style>{`
        body { overscroll-behavior: none; }
        .animate-title-glow { animation: title-glow 4s ease-in-out infinite; }
        @keyframes title-glow { 0%, 100% { filter: drop-shadow(0 0 4px var(--glow-color)); } 50% { filter: drop-shadow(0 0 12px var(--glow-color)); } }
        .hit-effect { position: absolute; border-radius: 50%; border: 3px solid currentColor; animation: hit-anim 0.4s ease-out forwards; }
        @keyframes hit-anim { from { transform: translate(-50%, -50%) scale(0); opacity: 1; } to { transform: translate(-50%, -50%) scale(1.5); opacity: 0; } }
        .floating-text { position: absolute; font-weight: bold; font-family: 'Orbitron', sans-serif; pointer-events: none; animation: float-up 1.5s ease-out forwards; transform: translateX(-50%); }
        @keyframes float-up { from { transform: translate(-50%, 0); opacity: 1; } to { transform: translate(-50%, -80px); opacity: 0; } }
      `}</style>
    </main>
  );
};

export default App;