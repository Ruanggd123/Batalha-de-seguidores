import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { BGM_PLAYLIST, themes, AOE_RADIUS, METEOR_RADIUS } from './constants/gameConfig';
import { getPlayerSize, getColorFromId, getSafeImageUrl, getFallbackImageUrl, getDiceBearUrl, getUnavatarUrl, isImageUsable } from './utils/gameUtils';
import { useBattleAudio } from './hooks/useBattleAudio';
import { usePlayerManager } from './hooks/usePlayerManager';
import { useBattleEngine } from './hooks/useBattleEngine';
import { generateDemoPlayers } from './services/demoPlayerService';
import { HitEffect, Player, GameState, GameMode } from './types';

// Components
import SetupView from './components/setup/SetupView';
import BattleArena from './components/battle/BattleArena';
import ControlPanel from './components/battle/ControlPanel';
import FinishScreen from './components/battle/FinishScreen';
import CountdownOverlay from './components/battle/CountdownOverlay';
import DynamicBackground from './components/backgrounds/DynamicBackground';
import AudioSettings from './components/battle/AudioSettings';
import { DEFAULT_AVATAR } from './constants/assets';

const App: React.FC = () => {
  // 1. Hooks initialization
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});
  const [targetDuration, setTargetDuration] = useState(60);
  const [preloadingProgress, setPreloadingProgress] = useState(0);

  // Audio Hook - provides playBeep, narrateText, etc.
  const audio = useBattleAudio(); 
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
  const [creatorName, setCreatorName] = useState('batalha_seguidores');
  
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

  // Ensure audio stops correctly on game end
  useEffect(() => {
    if (engine.gameState === GameState.Finished || engine.gameState === GameState.AwaitingPlayers) {
        // No-op for now as narration is removed, but keeping for future hook sync if needed
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
      const transition = 'transform 0.5s ease-out';
      const followedPlayer = useMemo(() => playerManager.players.find(p => p.id === engine.followedPlayerId), [playerManager.players, engine.followedPlayerId]);
      
      const zoomData = followedPlayer ? { x: followedPlayer.x, y: followedPlayer.y, scale: 1.7 } : null;

      if (zoomData && engine.arenaRef.current) {
          const arena = engine.arenaRef.current;
          const targetX = arena.clientWidth / 2;
          const targetY = arena.clientHeight / 2;
          const translateX = targetX - zoomData.x * zoomData.scale;
          const translateY = targetY - zoomData.y * zoomData.scale;

          return { 
            transform: `translate(${translateX}px, ${translateY}px) scale(${zoomData.scale})`, 
            transition,
            transformOrigin: '0 0'
          };
      }
      return { transform: 'scale(1) translate(0px, 0px)', transition, transformOrigin: 'center' };
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

  // Image preloading logic — VIP INITIAL LOAD (First 200)
  useEffect(() => {
    // 🛡️ SMART LOADING: We now load the first 1000 followers initially!
    // This solves the issue of avatars not appearing for large follower counts.
    const playersToPreload = playerManager.allPlayersRef.current.slice(0, 1000);
    if (playersToPreload.length === 0) {
        setPreloadingProgress(100);
        return;
    }

    let loadedCount = 0;
    const priorityCount = playersToPreload.length;
    
    // 🚀 HIGHER CONCURRENCY: Modern browsers can handle 30+ concurrent requests on CDNs
    const MAX_CONCURRENT = 30; 
    let activeCount = 0;
    let queueIdx = 0;
    let isTerminated = false;

    const markLoaded = (cacheKey: string, img: HTMLImageElement, index: number) => {
        if (isTerminated) return;
        imageCache.current[cacheKey] = img;
        
        // 🚀 LINK DIRECTLY: Set the image property on the player object for instant render
        if (playersToPreload[index]) {
            playersToPreload[index].image = img;
        }

        if (index < priorityCount) {
            loadedCount++;
            setPreloadingProgress(Math.round((loadedCount / priorityCount) * 100));
        }
        activeCount--;
        processQueue();
    };

    const loadOne = (index: number) => {
        if (isTerminated) return;
        const player = playersToPreload[index];
        // 🚀 SPEED FIX: Use isPriority=false for BOTH mass loaders. 
        // unavatar.io is too slow for 1000+ followers at once.
        const safeUrl = getSafeImageUrl(player.imageUrl, player.name, false); 

        // Already cached?
        if (imageCache.current[safeUrl]) {
            if (index < priorityCount) {
                loadedCount++;
                setPreloadingProgress(Math.round((loadedCount / priorityCount) * 100));
            }
            activeCount--;
            processQueue();
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => markLoaded(safeUrl, img, index);
        img.onerror = () => {
            // Last resort: default avatar
            const defImg = new Image();
            defImg.src = DEFAULT_AVATAR;
            defImg.onload = () => markLoaded(safeUrl, defImg, index);
        };
        img.src = safeUrl;
    };

    const processQueue = () => {
        if (isTerminated) return;
        while (activeCount < MAX_CONCURRENT && queueIdx < playersToPreload.length) {
            activeCount++;
            loadOne(queueIdx++);
        }
    };

    processQueue();
    return () => { isTerminated = true; };
  }, [playerManager.totalPlayersRef.current]);

  // 🛡️ SMART JIT LOADING: Load real images for survivors when count drops below 1000
  // or for the player being followed.
  const survivorLoadTriggered = useRef(false);
  useEffect(() => {
    if (engine.gameState !== GameState.Running) return;

    // Trigger when survivors drop to 2500 — they are now large enough to see!
    if (totalAliveCount <= 2500 && !survivorLoadTriggered.current) {
        survivorLoadTriggered.current = true;
        const survivors = playerManager.players.filter(p => p.isAlive);
        
        // Load in batches of 40 to be more efficient for mass loading
        let idx = 0;
        const loadNextBatch = () => {
            const end = Math.min(idx + 40, survivors.length);
            for (; idx < end; idx++) {
                const p = survivors[idx];
                // 🚀 SPEED OPTIMIZATION: Use isPriority=false for mass loading to bypass unavatar.io slowness
                const url = getSafeImageUrl(p.imageUrl, p.name, false); 
                if (!imageCache.current[url]) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => { 
                        if (img.naturalWidth > 0) {
                            imageCache.current[url] = img;
                            p.image = img; // 🚀 Link directly for instant arena render
                        }
                    };
                    img.src = url;
                } else if (imageCache.current[url]) {
                    p.image = imageCache.current[url];
                }
            }
            if (idx < survivors.length) setTimeout(loadNextBatch, 150);
        };
        loadNextBatch();
    }
  }, [totalAliveCount, engine.gameState]);

  // Priority Loading for the Followed Player
  useEffect(() => {
    if (engine.gameState === GameState.Running && followedPlayer) {
        const vipUrl = getUnavatarUrl(followedPlayer.name);
        if (!imageCache.current[vipUrl]) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                if (img.naturalWidth > 0) imageCache.current[vipUrl] = img;
            };
            img.src = vipUrl;
        }
    }
  }, [followedPlayer?.id, engine.gameState]);

  // Main Drawing Loop sync (Hook doesn't draw to DOM, it just calculates)
  // Actually, the Draw loop was inside useBattleEngine in my previous implementation.
  // I need to ensure it's drawing correctly.

  return (
    <main className="h-[100dvh] w-screen bg-[#0f071e] font-inter overflow-hidden relative">
      <DynamicBackground />
      <audio 
        ref={audio.audioRef} 
        onEnded={audio.nextTrack}
      />
      
      {/* Music Controls Panel (Compact) - Only visible when settings are open */}
      {isAudioSettingsOpen && (
        <div className="absolute top-4 right-16 z-50 flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-2 py-1.5 hover:bg-black/60 transition-all animate-in fade-in slide-in-from-right-4 duration-300 shadow-2xl">
          <button 
            onClick={audio.prevTrack} 
            className="text-white hover:text-cyan-400 p-0.5 transition-colors hover:scale-110 active:scale-95"
            title="Anterior"
          >
            <span className="text-[10px]">⏮️</span>
          </button>
          <div className="flex flex-col items-center min-w-[80px] max-w-[140px] px-1">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse" />
              <span className="text-[8px] text-cyan-400 uppercase tracking-tighter font-black opacity-80">Radio</span>
            </div>
            <span className="text-[10px] text-white truncate w-full text-center font-bold">
              {audio.currentTrackTitle}
            </span>
          </div>
          <button 
            onClick={audio.nextTrack} 
            className="text-white hover:text-cyan-400 p-0.5 transition-colors hover:scale-110 active:scale-95"
            title="Próxima"
          >
            <span className="text-[10px]">⏭️</span>
          </button>
        </div>
      )}

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
          isReelMode={engine.isReelMode}
          setIsReelMode={engine.setIsReelMode}
          listMetadata={playerManager.listMetadata}
          creatorName={creatorName}
          setCreatorName={setCreatorName}
        />
      )}
      
      {(engine.gameState !== GameState.AwaitingPlayers || playerManager.totalPlayersRef.current > 0) && (
        <div className={`w-full h-full relative transition-opacity duration-500 ${engine.gameMode === GameMode.ElasticClash && engine.gameState === GameState.Running ? 'bg-[#3b0d5c]' : ''}`}>
          {/* Central Branding Overlay - Dynamic with creator name */}
          {engine.gameState === GameState.Running && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none animate-fade-in group">
                  <div className="bg-black/60 backdrop-blur-xl px-6 py-2 rounded-2xl border border-white/10 flex flex-col items-center shadow-2xl">
                      <span className="text-white/40 font-bold text-[8px] uppercase tracking-[0.4em] mb-1">Simulador de Batalha</span>
                      <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(192,132,252,0.3)]">
                             <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                          </div>
                          <span className="text-white font-black text-xs sm:text-2xl tracking-tighter uppercase drop-shadow-md">@{creatorName.toUpperCase().replace('@', '')}</span>
                      </div>
                  </div>
              </div>
          )}

          {/* New "Siga @creator" Permanent Overlay during battle */}
          {engine.gameState === GameState.Running && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none">
                  <div className="px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-3 shadow-2xl animate-bounce">
                      <div className="bg-gradient-to-tr from-pink-600 to-purple-600 p-1 rounded-full text-[8px] text-white font-black uppercase">IG</div>
                      <span className="text-white font-black text-xs sm:text-base tracking-widest drop-shadow-md">SIGA @<span className={activeTheme.text}>{creatorName.toUpperCase().replace('@', '')}</span></span>
                  </div>
              </div>
          )}
          <div className="w-full h-full lg:pr-[320px] xl:pr-[400px] relative overflow-hidden">
             {engine.gameState === GameState.Running && playerManager.totalPlayersRef.current > 0 && (
                  <div className={`absolute top-4 left-4 sm:top-6 sm:left-6 z-30 transition-all duration-300 ${engine.gameMode === GameMode.ElasticClash ? 'scale-[0.7] sm:scale-100 origin-top-left' : ''}`}>
                    <div className="font-black font-orbitron text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wider flex items-baseline gap-1 sm:gap-2">
                        <span className="text-[10px] sm:text-sm text-gray-300 opacity-80 uppercase">Vivos:</span> 
                        <span className="text-white text-lg sm:text-5xl">{totalAliveCount}</span>
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
            bgmVolume={audio.bgmVolume}
            setBgmVolume={audio.setBgmVolume}
            sfxVolume={audio.sfxVolume}
            setSfxVolume={audio.setSfxVolume}
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