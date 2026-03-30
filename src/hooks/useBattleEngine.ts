import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Player, BattleEvent, GameState, GameMode, HitEffect, FloatingText, AttackLine, Meteor } from '../types';
import { 
  DEATH_ANIMATION_FRAMES, 
  VORTEX_INITIAL_RADIUS, 
  VORTEX_GROWTH_RATE,
  VORTEX_STRENGTH,
  VORTEX_SPIRAL_FORCE,
  GRAVITY_ABYSS_ROTATION_SPEED,
  GRAVITY_ABYSS_RADIUS_FACTOR,
  SPHERE_GRAVITY,
  NORMAL_BATTLE_INTERVAL_MS,
  MAX_SPEED_BATTLE_INTERVAL_MS,
  PHYSICS_OPTIMIZATION_THRESHOLD,
  DAMPING,
  KNOCKBACK_FORCE,
  REPULSION_FORCE,
  AOE_CHANCE,
  AOE_RADIUS,
  AOE_DAMAGE_BASE,
  AOE_DAMAGE_RANDOM,
  ATTACK_TRACER_THRESHOLD,
  ATTACK_TRACER_LIFESPAN,
  METEOR_SHOWER_THRESHOLD,
  METEOR_SPAWN_INTERVAL,
  METEOR_RADIUS,
  METEOR_DAMAGE_BASE,
  METEOR_DAMAGE_RANDOM,
  METEOR_KNOCKBACK,
  METEOR_IMPACT_TIMER,
  UI_UPDATE_INTERVAL,
  INITIAL_HP,
  GRAVITY_ABYSS_HOLE_SIZE_DEGREES,
  SPAWN_BATCH_INITIAL,
  SPAWN_BATCH_MAX,
  SPAWN_ACCELERATION,
  SPAWN_INTERVAL_MS,
  PIXEL_MODE_THRESHOLD
} from '../constants/gameConfig';
import { getPlayerSize, getColorFromId, getSafeImageUrl } from '../utils/gameUtils';
import { generatePowersForPlayers } from '../services/powerService';
import { getLocalCommentary, getLocalSummary } from '../services/commentaryService';

export const useBattleEngine = (
    players: Player[], 
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
    playersRef: React.MutableRefObject<Player[]>,
    totalPlayersRef: React.MutableRefObject<number>,
    allPlayersRef: React.MutableRefObject<Player[]>,
    audio: any,
    imageCache: React.MutableRefObject<Record<string, HTMLImageElement>>,
    targetDuration: number
) => {
  const [gameState, setGameState] = useState<GameState>(GameState.AwaitingPlayers);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.Classic);
  const [battleLog, setBattleLog] = useState<BattleEvent[]>([]);
  const [winner, setWinner] = useState<Player | null>(null);
  const [top3, setTop3] = useState<Player[]>([]);
  const eliminationOrderRef = useRef<Player[]>([]);
  
  const hitEffectsRef = useRef<HitEffect[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const [isShaking, setIsShaking] = useState(false);
  
  // Performance Ref: Maintain the list of currently alive players to avoid filtering 50k items every frame
  const alivePlayersRef = useRef<Player[]>([]);
  const lastAliveFilterTick = useRef(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [followedPlayerId, setFollowedPlayerId] = useState<number | null>(null);
  const [playerSizeMultiplier, setPlayerSizeMultiplier] = useState<number>(1.0);
  const [isReelMode, setIsReelMode] = useState(false);
  const [isSpectatorMode, setIsSpectatorMode] = useState(false);
  const [totalAliveCount, setTotalAliveCount] = useState(0);

  const arenaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastBattleTickRef = useRef<number>(0);
  const lastStateUpdateRef = useRef<number>(0);
  const eventCounterRef = useRef<number>(0);
  const hitEffectCounterRef = useRef<number>(0);
  const floatingTextCounterRef = useRef<number>(0);
  
  const vortexRadiusRef = useRef<number>(VORTEX_INITIAL_RADIUS);
  const abyssRotationRef = useRef(0);
  const preBattleRotationRef = useRef(0);
  const lastEliminatedPlayerRef = useRef<Player | null>(null);
  const gameSessionId = useRef(0);

  const attackLinesRef = useRef<AttackLine[]>([]);
  const attackLineCounterRef = useRef<number>(0);
  const meteorsRef = useRef<Meteor[]>([]);
  const meteorCounterRef = useRef<number>(0);
  const lastMeteorSpawnRef = useRef<number>(0);
  const pendingPlayersRef = useRef<Player[]>([]);
  const spawnBatchSizeRef = useRef<number>(SPAWN_BATCH_INITIAL);
  const lastSpawnTickRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const loadingCountRef = useRef<number>(0);
  const defaultImageRef = useRef<HTMLImageElement | null>(null);
  const MAX_CONCURRENT_LOADS = 10; // Limit simultaneous network requests
  const TOP_MARGIN = 140; // Safety bar at the top for HUD visibility
  const BOTTOM_MARGIN = 80; // Safety bar at the bottom for Control Panel
  const DEFAULT_PROFILE_IMAGE = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

  useEffect(() => {
    const img = new Image();
    img.src = DEFAULT_PROFILE_IMAGE;
    img.onload = () => { defaultImageRef.current = img; };
  }, []);

  // Recording states

  const addLogEventsBatch = useCallback((events: {text: string, type: BattleEvent['type']}[]) => {
    if (events.length === 0) return;
    const newEvents = events.map(e => ({ id: eventCounterRef.current++, text: e.text, type: e.type }));
    setBattleLog(prev => [...prev, ...newEvents].slice(-100));
  }, []);

  const addLogEvent = useCallback((text: string, type: BattleEvent['type']) => {
    addLogEventsBatch([{ text, type }]);
  }, [addLogEventsBatch]);

  const addHitEffect = useCallback((x: number, y: number, color: string, type: HitEffect['type'] = 'hit', size?: number) => {
    if (totalAliveCount > 500) return; // Hide visual clutter and save performance for massive totals
    if (type === 'hit' && (gameMode === GameMode.Vortex || gameMode === GameMode.GravityAbyss)) return;
    
    // Size specifies starting size or radius, lifespan could be 30 frames (0.5s)
    hitEffectsRef.current.push({ id: hitEffectCounterRef.current++, x, y, color, type, size, life: 30, maxLife: 30 } as any);
  }, [totalAliveCount, gameMode]);

  const addFloatingText = useCallback((x: number, y: number, text: string, type: FloatingText['type']) => {
    if (totalAliveCount > 500) return;
    floatingTextsRef.current.push({ id: floatingTextCounterRef.current++, x, y, text, type, life: 60, maxLife: 60 } as any);
  }, [totalAliveCount]);

  const triggerScreenShake = useCallback(() => {
    // PERFORMANCE & STABILITY: Disable shake during massive counts to avoid React Depth Error
    if (totalAliveCount > 500 || isShaking) return;
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 300);
  }, [totalAliveCount, isShaking]);

  const runBattleRound = useCallback((newLogEvents: {text: string, type: BattleEvent['type']}[], elapsedSeconds: number = 0, targetDuration: number = 60) => {
    let modifiablePlayers = playersRef.current;
    const alivePlayers = modifiablePlayers.filter(p => p.isAlive);
    let currentAliveCount = alivePlayers.length;
    
    if (currentAliveCount <= 1) return;

    // Dinamicamente calcular quantos ataques por Tick para o jogo durar 'targetDuration'
    const estimatedHitsToKill = 3; // Reduzido para acelerar vs 4 anterior
    const ticksPerSecond = 60; // Assumindo FPS do browser
    const remainingSeconds = Math.max(0.2, targetDuration - elapsedSeconds);
    const requiredAttacks = Math.ceil((currentAliveCount * estimatedHitsToKill) / (remainingSeconds * ticksPerSecond));
    
    let attacksPerTick = Math.max(2, requiredAttacks); // Mínimo 2 ataques
    
    // TURBO START: Clear massive counts (50k to 10k) extremely fast
    if (currentAliveCount > 10000) attacksPerTick = Math.max(attacksPerTick, 280); 
    else if (currentAliveCount > 1000) attacksPerTick = Math.max(attacksPerTick, 60);
    else if (currentAliveCount > 500) attacksPerTick = Math.max(attacksPerTick, 15);

    if (elapsedSeconds > targetDuration && currentAliveCount > 100) attacksPerTick = Math.ceil(currentAliveCount / 10); 
    
    // DRAMATIC SLOWDOWN: For the top contestants
    if (currentAliveCount <= 50) attacksPerTick = 1; 

    for (let i = 0; i < attacksPerTick; i++) {
      if (currentAliveCount <= 1) break;

      const attackerIndex = Math.floor(Math.random() * alivePlayers.length);
      const attacker = alivePlayers[attackerIndex];
      if (!attacker.isAlive) continue;
      
      const isAoeAttack = Math.random() < AOE_CHANCE && currentAliveCount > 30;

      if (isAoeAttack) {
        let targets: Player[] = [];
        if (currentAliveCount > 2000) {
            const sampleSize = 50;
            for (let j = 0; j < sampleSize; j++) {
                const randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
                if (randomTarget.isAlive && randomTarget.id !== attacker.id) {
                    const dx = randomTarget.x - attacker.x;
                    const dy = randomTarget.y - attacker.y;
                    if ((dx * dx + dy * dy) < (AOE_RADIUS * AOE_RADIUS)) targets.push(randomTarget);
                }
            }
        } else {
            targets = alivePlayers.filter(p => {
              if (!p.isAlive || p.id === attacker.id) return false;
              const dx = p.x - attacker.x;
              const dy = p.y - attacker.y;
              return (dx * dx + dy * dy) < (AOE_RADIUS * AOE_RADIUS);
            });
        }

        if (targets.length > 2) {
           if (targets.length > 15) targets = targets.slice(0, 15);
           newLogEvents.push({text: `${attacker.name} usou ${attacker.power || 'um poder'} em área, atingindo ${targets.length} oponentes!`, type: 'aoe'});
           triggerScreenShake();
           if (currentAliveCount <= 500) {
               const pSize = getPlayerSize(currentAliveCount) * playerSizeMultiplier;
               addHitEffect(attacker.x, attacker.y, getColorFromId(attacker.id), 'aoe-caster', pSize * 1.5);
               addHitEffect(attacker.x, attacker.y, getColorFromId(attacker.id), 'aoe');
           }

           targets.forEach(target => {
              if (!target.isAlive) return;
              const damage = Math.floor(Math.random() * AOE_DAMAGE_RANDOM) + AOE_DAMAGE_BASE;
              if (currentAliveCount <= 500) addFloatingText(target.x, target.y, `-${damage}`, 'damage');
              
              const dx = target.x - attacker.x;
              const dy = target.y - attacker.y;
              const distance = Math.sqrt(dx*dx + dy*dy) || 1;
              const kVx = (dx / distance) * KNOCKBACK_FORCE * 0.5;
              const kVy = (dy / distance) * KNOCKBACK_FORCE * 0.5;

              const isNowDead = (target.hp - damage) <= 0;
              if (isNowDead) {
                newLogEvents.push({text: `${target.name} foi eliminado por uma habilidade em área!`, type: 'elimination'});
                lastEliminatedPlayerRef.current = target;
                eliminationOrderRef.current.push(target);
                currentAliveCount--;
                if (target.id === followedPlayerId) setFollowedPlayerId(null);
                // Epic Narrative
                if (currentAliveCount <= 30 && audio.isNarrationEnabled && !audio.isNarratingRef.current) {
                   audio.narrateText(`${target.name} foi pulverizado!`);
                }
              }
              target.hp = Math.max(0, target.hp - damage);
              target.isAlive = !isNowDead;
              target.dying = isNowDead ? DEATH_ANIMATION_FRAMES : target.dying;
              target.vx += kVx; target.vy += kVy;
           });
           continue;
        }
      }
      
      let targetIndex = Math.floor(Math.random() * alivePlayers.length);
      let target = alivePlayers[targetIndex];
      let attempts = 0;
      while ((!target.isAlive || target.id === attacker.id) && attempts < 10) {
        targetIndex = Math.floor(Math.random() * alivePlayers.length);
        target = alivePlayers[targetIndex];
        attempts++;
      }
      if (!target.isAlive || target.id === attacker.id) continue;
      
      let damage = 0;
      let attackLog = '';
      const roll = Math.random();

      if (roll < 0.05) {
        damage = 0;
        attackLog = `${attacker.name} tenta atacar ${target.name}, mas erra!`;
        if (currentAliveCount <= 500) addFloatingText(target.x, target.y, 'Errou!', 'miss');
      } else if (roll < 0.15) {
        damage = Math.floor(Math.random() * 15) + 25;
        attackLog = `${attacker.name} acerta um GOLPE CRÍTICO com ${attacker.power || 'um ataque'} em ${target.name}!`;
        if (currentAliveCount <= 500) addFloatingText(target.x, target.y, `-${damage}`, 'crit');
        triggerScreenShake();
      } else {
        damage = Math.floor(Math.random() * 15) + 5;
        attackLog = `${attacker.name} usa ${attacker.power || 'um ataque'} em ${target.name}!`;
        if (currentAliveCount <= 500) addFloatingText(target.x, target.y, `-${damage}`, 'damage');
      }
      
      if (currentAliveCount < 50 || roll < 0.15) newLogEvents.push({text: attackLog, type: 'attack'});
      if (damage > 0 && currentAliveCount <= 500) addHitEffect(target.x, target.y, getColorFromId(target.id), 'hit');

      if (currentAliveCount <= ATTACK_TRACER_THRESHOLD) {
          attackLinesRef.current.push({
              id: attackLineCounterRef.current++,
              startX: attacker.x, startY: attacker.y,
              endX: target.x, endY: target.y,
              life: ATTACK_TRACER_LIFESPAN,
              color: getColorFromId(attacker.id),
          });
      }
     
      const dx = target.x - attacker.x;
      const dy = target.y - attacker.y;
      const distance = Math.sqrt(dx*dx + dy*dy) || 1;
      const kVx = (dx / distance) * KNOCKBACK_FORCE;
      const kVy = (dy / distance) * KNOCKBACK_FORCE;

      const isNowDead = (target.hp - damage) <= 0;
      if (isNowDead) {
          newLogEvents.push({text: `${target.name} foi eliminado!`, type: 'elimination'});
          lastEliminatedPlayerRef.current = target;
          eliminationOrderRef.current.push(target);
          currentAliveCount--;
          triggerScreenShake();
          if (target.id === followedPlayerId) setFollowedPlayerId(null);
          // Epic Narrative
          if (currentAliveCount <= 30 && audio.isNarrationEnabled && !audio.isNarratingRef.current) {
             audio.narrateText(`${target.name} foi eliminado! restam apenas ${currentAliveCount}!`);
          }
      }
      target.hp = Math.max(0, target.hp - damage);
      target.isAlive = !isNowDead;
      target.dying = isNowDead ? DEATH_ANIMATION_FRAMES : target.dying;
      target.vx += kVx; target.vy += kVy;
    }
  }, [addHitEffect, addFloatingText, followedPlayerId, playerSizeMultiplier, getColorFromId, getPlayerSize]);

  const generatePowersAndRun = useCallback(() => {
    setGameState(GameState.GeneratingPowers);
    addLogEvent("Invocando poderes para os lutadores...", 'info');
    vortexRadiusRef.current = VORTEX_INITIAL_RADIUS;
    abyssRotationRef.current = Math.random() * 2 * Math.PI;
    const targetPlayers = allPlayersRef.current.length > 0 ? allPlayersRef.current : playersRef.current;

    const powers = generatePowersForPlayers(targetPlayers.map(p => p.name));
    let updatedPlayers = targetPlayers.map((p, i) => ({ ...p, power: powers[i] || 'Olhar Feroz' }));
    
    const arena = arenaRef.current;
    if (arena) {
        const lw = arena.clientWidth; const lh = arena.clientHeight;
        const lcx = lw / 2; const lcy = lh / 2;
        
        updatedPlayers = updatedPlayers.map(p => {
            let nx, ny;
            if (gameMode === GameMode.GravityAbyss) {
                const sr = Math.min(lw, lh) * GRAVITY_ABYSS_RADIUS_FACTOR;
                const angle = (Math.random() * Math.PI) - (Math.PI / 2);
                const spawnRadius = Math.random() * sr * 0.9;
                nx = lcx + Math.cos(angle) * spawnRadius;
                ny = lcy + Math.sin(angle) * spawnRadius;
            } else {
                const pSize = getPlayerSize(updatedPlayers.length) * playerSizeMultiplier;
                const r = pSize / 2;
                nx = r + (Math.random() * (lw - pSize));
                ny = TOP_MARGIN + r + (Math.random() * (lh - pSize - TOP_MARGIN - BOTTOM_MARGIN));
            }
            return { ...p, x: nx, y: ny, vx: 0, vy: 0 };
        });
    }

    // Spawn instantly instead of sequential to satisfy the 50,000 at once requirement
    playersRef.current = updatedPlayers;
    allPlayersRef.current = [];
    setPlayers([...updatedPlayers]);
    setTimeout(() => { setGameState(GameState.Running); }, 50);
  }, [gameMode, playerSizeMultiplier, playersRef, setPlayers]);

  const startBattle = useCallback(() => {
    if (totalPlayersRef.current < 2) return;
    setGameState(GameState.Countdown);
    setCountdown(3);
    setBattleLog([]);
    eliminationOrderRef.current = [];
    startTimeRef.current = 0;
    if (playersRef.current.length === 1) setFollowedPlayerId(playersRef.current[0].id);

    let cd = 3;
    const cdI = setInterval(() => {
        cd--;
        if (cd <= 0) {
            clearInterval(cdI);
            setCountdown(null);
            generatePowersAndRun();
        } else {
            setCountdown(cd);
            audio.playBeep(440, 'sine', 0.5);
        }
    }, 1000);
  }, [audio, generatePowersAndRun, playersRef]);

  const resetGame = useCallback(() => {
    gameSessionId.current += 1;
    if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setWinner(null);
    startTimeRef.current = 0;
    setBattleLog([]);
    eliminationOrderRef.current = [];
    setGameState(GameState.AwaitingPlayers);
    setIsSpectatorMode(false);
    setFollowedPlayerId(null);
    setCountdown(null);
    setTotalAliveCount(0); // Also reset alive count state
    eventCounterRef.current = 0;
    lastEliminatedPlayerRef.current = null;
    floatingTextsRef.current = []; 
    hitEffectsRef.current = [];
    attackLinesRef.current = [];
    meteorsRef.current = [];
    totalPlayersRef.current = 0;
    pendingPlayersRef.current = [];
    audio.stopNarration();
  }, [setPlayers, totalPlayersRef, audio]);

  const playAgain = useCallback(() => {
    gameSessionId.current += 1;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    const allPlayers = playersRef.current.map(p => ({
      ...p, hp: INITIAL_HP, maxHp: INITIAL_HP, isAlive: true, x: 0, y: 0, vx: 0, vy: 0, dying: undefined,
    })).sort((a,b) => a.id - b.id);
    setPlayers(allPlayers);
    playersRef.current = allPlayers;
    setBattleLog([ { id: eventCounterRef.current++, text: `A batalha épica começou com ${totalPlayersRef.current} lutadores!`, type: 'info' } ]);
    setWinner(null); setTop3([]);
    eliminationOrderRef.current = [];
    startTimeRef.current = performance.now();
    setGameState(GameState.AwaitingPlayers);
    floatingTextsRef.current = []; 
    hitEffectsRef.current = [];
    attackLinesRef.current = []; meteorsRef.current = [];
    setFollowedPlayerId(null); lastEliminatedPlayerRef.current = null;
    setCountdown(null);
  }, [setPlayers, playersRef, totalPlayersRef]);

  useEffect(() => {
    let isLooping = gameState !== GameState.AwaitingPlayers || playersRef.current.length > 0;
    const gameLoop = (timestamp: number) => {
        if (!isLooping) return;
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        
        const currentPlayers = playersRef.current;
        const arena = arenaRef.current;
        const canvas = canvasRef.current;
        if (!arena || !canvas) return;

        if (timestamp - lastAliveFilterTick.current > 50 || alivePlayersRef.current.length === 0) {
            alivePlayersRef.current = currentPlayers.filter(p => p.isAlive);
            lastAliveFilterTick.current = timestamp;
        }

        const alivePlayers = alivePlayersRef.current;
        const currentAliveCount = alivePlayers.length;
        const lw = arena.clientWidth; const lh = arena.clientHeight;
        const lcx = lw / 2; const lcy = lh / 2;

        const dynamicUIUpdateInterval = currentAliveCount > 10000 ? 500 : 
                                       currentAliveCount > 1000 ? 200 : 
                                       UI_UPDATE_INTERVAL;

        const newLogEvents: {text: string, type: BattleEvent['type']}[] = [];

        if (gameState === GameState.Running) {
          // Dynamic interval calculation: Fast at 50k, Slow at 15
          let battleInterval = MAX_SPEED_BATTLE_INTERVAL_MS; // Default 1ms
          
          if (currentAliveCount <= 15) {
              battleInterval = 1500; // EPIC FINAL: 1.5s per turn for drama
          } else if (currentAliveCount <= 50) {
              battleInterval = 600; // Final 50: Slow (0.6s)
          } else if (currentAliveCount <= 200) {
              battleInterval = 300; // Final 200: Moderate (0.3s)
          } else if (currentAliveCount <= 1000) {
              battleInterval = 50; // Final 1k: Fast (50ms)
          }
          
          if (timestamp - lastBattleTickRef.current > battleInterval) {
            const elapsed = startTimeRef.current === 0 ? 0 : (timestamp - startTimeRef.current) / 1000;
            runBattleRound(newLogEvents, elapsed, targetDuration);
            lastBattleTickRef.current = timestamp;
          }
        }

        if (newLogEvents.length > 0) {
            addLogEventsBatch(newLogEvents);
        }

        if (gameState === GameState.Running && currentAliveCount > METEOR_SHOWER_THRESHOLD && currentAliveCount < 10000) {
            if (timestamp - lastMeteorSpawnRef.current > METEOR_SPAWN_INTERVAL) {
                meteorsRef.current.push({
                    id: meteorCounterRef.current++, x: Math.random() * lw, y: Math.random() * lh,
                    radius: METEOR_RADIUS, impactTimer: METEOR_IMPACT_TIMER, totalTime: METEOR_IMPACT_TIMER,
                } as any);
                lastMeteorSpawnRef.current = timestamp;
            }
        }
        
        meteorsRef.current.forEach((meteor) => {
            meteor.impactTimer--;
            if (meteor.impactTimer <= 0) {
                triggerScreenShake();
                alivePlayers.forEach(p => {
                    const dx = p.x - meteor.x; const dy = p.y - meteor.y;
                    if (dx*dx + dy*dy < meteor.radius * meteor.radius) {
                        p.hp = 0; p.isAlive = false; p.dying = DEATH_ANIMATION_FRAMES;
                        lastEliminatedPlayerRef.current = p; eliminationOrderRef.current.push({...p});
                        setTotalAliveCount(prev => prev - 1);
                    }
                });
            }
        });
        meteorsRef.current = meteorsRef.current.filter(m => m.impactTimer > 0);

        if (gameState === GameState.Running) {
            if (startTimeRef.current === 0) startTimeRef.current = timestamp;

            const pSize = getPlayerSize(alivePlayers.length, lw) * playerSizeMultiplier;
            const r = pSize / 2; 

            if (gameMode === GameMode.Vortex) vortexRadiusRef.current += VORTEX_GROWTH_RATE;
            if (gameMode === GameMode.GravityAbyss) abyssRotationRef.current += GRAVITY_ABYSS_ROTATION_SPEED;

            const nextPlayers: Player[] = [];
            for (let i = 0; i < currentPlayers.length; i++) {
                const p1 = currentPlayers[i];
                if (p1.dying && p1.dying > 0) p1.dying--;
                if (!p1.isAlive && (!p1.dying || p1.dying <= 0)) continue;
                nextPlayers.push(p1);

                let nVx = p1.vx; let nVy = p1.vy;
                if (p1.isAlive) {
                  if (gameMode === GameMode.GravityAbyss) nVy += SPHERE_GRAVITY;
                  if (gameMode === GameMode.Vortex) {
                      const dx = lcx - p1.x; const dy = lcy - p1.y; const d = Math.sqrt(dx*dx + dy*dy) || 1;
                      const pull = VORTEX_STRENGTH / (d * d); const spiral = VORTEX_SPIRAL_FORCE / d;
                      nVx += (dx / d) * pull + (-dy / d) * spiral; nVy += (dy / d) * pull + (dx / d) * spiral;
                  }
                }
                nVx *= DAMPING; nVy *= DAMPING;
                let nx = p1.x + nVx; let ny = p1.y + nVy;

                if (p1.isAlive && gameMode === GameMode.Vortex) {
                    if (Math.sqrt(Math.pow(nx - lcx, 2) + Math.pow(ny - lcy, 2)) < vortexRadiusRef.current) {
                        p1.isAlive = false; p1.dying = DEATH_ANIMATION_FRAMES;
                        lastEliminatedPlayerRef.current = p1; eliminationOrderRef.current.push({...p1});
                        setTotalAliveCount(prev => prev - 1);
                    }
                }

                if (gameMode === GameMode.Classic || gameMode === GameMode.Vortex) {
                  if (nx < r) { nx = r; nVx *= -0.5; } if (nx > lw - r) { nx = lw - r; nVx *= -0.5; }
                  if (ny < r + TOP_MARGIN) { ny = r + TOP_MARGIN; nVy *= -0.5; } 
                  if (ny > lh - r - BOTTOM_MARGIN) { ny = lh - r - BOTTOM_MARGIN; nVy *= -0.5; }
                } else if (gameMode === GameMode.GravityAbyss) {
                    const sr = Math.min(lw, lh) * GRAVITY_ABYSS_RADIUS_FACTOR;
                    const dcx = nx - lcx; const dcy = ny - lcy; const dcf = Math.sqrt(dcx*dcx + dcy*dcy);
                    if (dcf > sr - r) {
                        const hole = (GRAVITY_ABYSS_HOLE_SIZE_DEGREES * Math.PI) / 180;
                        const hStart = (abyssRotationRef.current - hole / 2) % (2*Math.PI);
                        const hEnd = (abyssRotationRef.current + hole / 2) % (2*Math.PI);
                        const pa = (Math.atan2(dcy, dcx) + 2*Math.PI) % (2*Math.PI);
                        const inHole = hStart < hEnd ? (pa >= hStart && pa <= hEnd) : (pa >= hStart || pa <= hEnd);
                        if (inHole) {
                            if (p1.isAlive) {
                                p1.isAlive = false; p1.dying = DEATH_ANIMATION_FRAMES;
                                lastEliminatedPlayerRef.current = p1; eliminationOrderRef.current.push({...p1});
                                setTotalAliveCount(prev => prev - 1);
                            }
                        } else {
                            const ov = dcf - (sr - r);
                            nx -= (dcx / dcf) * ov; ny -= (dcy / dcf) * ov;
                            const dot = nVx * (dcx / dcf) + nVy * (dcy / dcf);
                            nVx -= 2 * dot * (dcx / dcf) * 0.5; nVy -= 2 * dot * (dcy / dcf) * 0.5;
                        }
                    }
                }

                if (currentAliveCount <= 500 && p1.isAlive) {
                   for (let j = 0; j < nextPlayers.length - 1; j++) {
                      const op = nextPlayers[j];
                      if (!op.isAlive || op.id === p1.id) continue;
                      const dx = p1.x - op.x; const dy = p1.y - op.y;
                      const dist = Math.sqrt(dx*dx + dy*dy);
                      if (dist < r * 1.5 && dist > 0.1) {
                         const force = (r * 1.5 - dist) * REPULSION_FORCE * 0.05;
                         nVx += (dx/dist) * force; nVy += (dy/dist) * force;
                      }
                   }
                }

                p1.x = nx; p1.y = ny; p1.vx = nVx; p1.vy = nVy;
            }
            playersRef.current = nextPlayers;

            if (currentAliveCount <= 1) {
                let wc: Player | null = alivePlayers[0] || lastEliminatedPlayerRef.current;
                audio.stopNarration();
                setGameState(GameState.Finished);
                const eo = eliminationOrderRef.current;
                let ft3: Player[] = wc ? [wc] : [];
                for (let i = eo.length - 1; i >= 0 && ft3.length < 3; i--) {
                    if (!ft3.find(t => t.id === eo[i].id)) ft3.push(eo[i]);
                }
                setTimeout(() => {
                    setWinner(wc); setTop3(ft3);
                    if (wc) audio.narrateText(getLocalSummary(wc, "uma jornada intensa", audio.phraseHistoryRef.current));
                }, 2500);
            }
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
            if (canvas.width !== lw || canvas.height !== lh) { canvas.width = lw; canvas.height = lh; }
            ctx.clearRect(0, 0, lw, lh);

            if (gameMode === GameMode.Vortex) {
                ctx.beginPath(); ctx.arc(lcx, lcy, vortexRadiusRef.current, 0, Math.PI * 2);
                ctx.strokeStyle = '#3b0d5c'; ctx.lineWidth = 4; ctx.stroke();
                ctx.fillStyle = 'rgba(59, 13, 92, 0.15)'; ctx.fill();
            } else if (gameMode === GameMode.GravityAbyss) {
                const sr = Math.min(lw, lh) * GRAVITY_ABYSS_RADIUS_FACTOR;
                ctx.beginPath(); ctx.arc(lcx, lcy, sr, 0, Math.PI * 2);
                ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 10; ctx.stroke();
                const hole = (GRAVITY_ABYSS_HOLE_SIZE_DEGREES * Math.PI) / 180;
                ctx.beginPath(); ctx.arc(lcx, lcy, sr, abyssRotationRef.current - hole/2, abyssRotationRef.current + hole/2);
                ctx.strokeStyle = '#ff3366'; ctx.lineWidth = 12; ctx.stroke();
            }

            const pSize = getPlayerSize(currentAliveCount, lw) * playerSizeMultiplier;
            const r = pSize / 2;
            const shouldDrawImage = currentAliveCount <= PIXEL_MODE_THRESHOLD; 

            for (let i = 0; i < currentPlayers.length; i++) {
                const p = currentPlayers[i];
                const opacity = p.isAlive ? 1 : (p.dying || 0) / DEATH_ANIMATION_FRAMES;
                if (opacity <= 0) continue;
                ctx.globalAlpha = opacity;
                
                if (shouldDrawImage && p.isAlive) {
                    const safeUrl = getSafeImageUrl(p.imageUrl);
                    if (!imageCache.current[safeUrl] && safeUrl && safeUrl !== '') {
                        if (loadingCountRef.current < MAX_CONCURRENT_LOADS) {
                            imageCache.current[safeUrl] = true as any; 
                            loadingCountRef.current++;
                            const img = new Image();
                            img.crossOrigin = 'anonymous'; 
                            img.onload = () => { 
                                imageCache.current[safeUrl] = img; 
                                loadingCountRef.current--;
                            };
                            img.onerror = () => { 
                                console.warn("Failed to load image for", p.name, "falling back to default");
                                // Load the default image into the cache for this player
                                const defaultImg = new Image();
                                defaultImg.src = DEFAULT_PROFILE_IMAGE;
                                defaultImg.onload = () => {
                                    imageCache.current[safeUrl] = defaultImg;
                                };
                                loadingCountRef.current--;
                            };
                            img.src = safeUrl;
                        }
                    }
                    if (imageCache.current[safeUrl] instanceof HTMLImageElement) {
                        const img = imageCache.current[safeUrl] as HTMLImageElement;
                        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                        ctx.closePath(); ctx.clip();
                        ctx.drawImage(img, p.x - r, p.y - r, pSize, pSize);
                        ctx.restore();
                    } else if (defaultImageRef.current) {
                        // Use pre-loaded default image as immediate fallback
                        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                        ctx.closePath(); ctx.clip();
                        ctx.drawImage(defaultImageRef.current, p.x - r, p.y - r, pSize, pSize);
                        ctx.restore();
                    } else {
                        // High Performance Fallback if even default isn't loaded
                        if (currentAliveCount > 2500) {
                             ctx.fillStyle = getColorFromId(p.id);
                             ctx.fillRect(p.x - r, p.y - r, pSize, pSize);
                        } else {
                             ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                             ctx.fillStyle = getColorFromId(p.id); ctx.fill();
                        }
                    }
                } else {
                    // PERFORMANCE: Use rects instead of circles for massive player counts
                    if (currentAliveCount > 2500) {
                        ctx.fillStyle = getColorFromId(p.id);
                        ctx.fillRect(p.x - r, p.y - r, pSize, pSize);
                    } else {
                        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                        ctx.fillStyle = getColorFromId(p.id); ctx.fill();
                        // Add a small border for better visibility of squares
                        if (currentAliveCount > PIXEL_MODE_THRESHOLD) {
                             ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
                        }
                    }
                }

                if (p.isAlive && currentAliveCount <= 300) {
                    const hpY = p.y + r + 5;
                    const hpPercentage = p.hp / p.maxHp;
                    ctx.fillStyle = 'rgba(55, 65, 81, 0.5)';
                    ctx.fillRect(p.x - r, hpY, pSize, 4);
                    const hpColor = hpPercentage > 0.5 ? '#4ade80' : hpPercentage > 0.2 ? '#facc15' : '#f87171';
                    ctx.fillStyle = hpColor;
                    ctx.fillRect(p.x - r, hpY, pSize * hpPercentage, 4);
                }

                if (p.isAlive && (currentAliveCount <= 300 || p.id === followedPlayerId)) {
                    // Capped font size (min 10px, max 22px) for a cleaner look in top-tier battles
                    const fS = Math.min(22, Math.max(10, pSize / 4.5));
                    ctx.font = `900 ${fS}px "Inter", "Orbitron", sans-serif`; ctx.textAlign = 'center';
                    // STROKE FIRST for better readability
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; 
                    ctx.strokeText(p.name, p.x, p.y + r + fS + 12);
                    
                    ctx.fillStyle = '#FFFFFF'; // Ensure pure white
                    ctx.shadowBlur = 4; 
                    ctx.shadowColor = 'rgba(0,0,0,1)'; 
                    ctx.fillText(p.name, p.x, p.y + r + fS + 12);
                    ctx.shadowBlur = 0;
                }
                ctx.globalAlpha = 1;
            }

            // Draw Meteors (AOE zones)
            meteorsRef.current.forEach(m => {
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 69, 0, ${0.1 + (m.impactTimer / m.totalTime) * 0.2})`;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 140, 0, 0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();
            });

            // Draw Attack Lines (Lasers)
            if (currentAliveCount <= 500) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                attackLinesRef.current.forEach(line => {
                    if (line.life <= 0) return;
                    const lifePct = line.life / ATTACK_TRACER_LIFESPAN;
                    ctx.beginPath(); ctx.moveTo(line.startX, line.startY); ctx.lineTo(line.endX, line.endY);
                    ctx.strokeStyle = line.color; ctx.globalAlpha = lifePct;
                    ctx.shadowColor = line.color; ctx.shadowBlur = 10;
                    ctx.lineWidth = 3; ctx.stroke();
                    line.life--;
                });
                ctx.restore();
            }

            // Draw Hit Effects
            if (currentAliveCount <= 500) {
                hitEffectsRef.current.forEach(effect => {
                    const eff = effect as any;
                    if (eff.life <= 0) return;
                    const progress = 1 - (eff.life / eff.maxLife);
                    ctx.save();
                    ctx.globalAlpha = 1 - progress;
                    ctx.beginPath();
                    
                    if (effect.type === 'hit') {
                        const radius = 10 + progress * 20;
                        ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
                        ctx.strokeStyle = effect.color; ctx.lineWidth = 3; ctx.stroke();
                    } else if (effect.type === 'aoe' || effect.type === 'aoe-caster') {
                        const radius = (effect.size || AOE_RADIUS) * progress;
                        ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
                        ctx.fillStyle = effect.type === 'aoe-caster' ? effect.color : `rgba(255, 255, 255, 0.5)`;
                        ctx.fill();
                    } else if (effect.type === 'meteor') {
                        const radius = 20 + progress * 50;
                        ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
                        ctx.fillStyle = `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,165,0,0.8) 40%, rgba(255,69,0,0.5) 70%, transparent 100%)`;
                        ctx.fill();
                    }
                    ctx.restore();
                    eff.life--;
                });
            }

            // Draw Floating Texts (Damage numbers)
            if (currentAliveCount <= 500) {
                ctx.textAlign = 'center';
                floatingTextsRef.current.forEach(ft => {
                    const eff = ft as any;
                    if (eff.life <= 0) return;
                    const progress = 1 - (eff.life / eff.maxLife);
                    const drawY = ft.y - (progress * 50); // Float up natively
                    ctx.globalAlpha = 1 - progress;
                    
                    let fontSize = 16;
                    ctx.fillStyle = 'white';
                    if (ft.type === 'crit') { fontSize = 24; ctx.fillStyle = '#f97316'; }
                    else if (ft.type === 'miss') { fontSize = 14; ctx.fillStyle = '#9ca3af'; }
                    
                    ctx.font = `bold ${fontSize}px Orbitron`;
                    ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
                    ctx.fillText(ft.text, ft.x, drawY);
                    ctx.shadowBlur = 0;
                    eff.life--;
                });
            }
            
            // Clean up dead effects
            attackLinesRef.current = attackLinesRef.current.filter(l => l.life > 0);
            hitEffectsRef.current = hitEffectsRef.current.filter((e: any) => e.life > 0);
            floatingTextsRef.current = floatingTextsRef.current.filter((t: any) => (t as any).life > 0);
        }

        if (timestamp - lastStateUpdateRef.current > dynamicUIUpdateInterval) {
            // PERFORMANCE: Only update the full players state if the count is manageable
            // This prevents React from cloning and diffing a 50,000 element array constantly
            if (currentAliveCount <= 1000) {
                setPlayers([...playersRef.current]);
            } else if (timestamp - lastStateUpdateRef.current > 2000) {
                // Occasional update for massive counts just for background sync
                setPlayers(playersRef.current.slice(0, 500)); 
            }
            
            setTotalAliveCount(currentAliveCount);
            lastStateUpdateRef.current = timestamp;
        }
    };
    animationFrameRef.current = requestAnimationFrame(gameLoop);
    return () => { isLooping = false; if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [gameState, gameMode, isSpectatorMode, playerSizeMultiplier, audio.bgmVolume, audio.narrationVolume, audio.isNarrationEnabled, targetDuration, playersRef, arenaRef, canvasRef, setPlayers, setTotalAliveCount, triggerScreenShake, getColorFromId, getPlayerSize, getLocalSummary, audio.phraseHistoryRef]);

  return {
    gameState, setGameState,
    gameMode, setGameMode,
    battleLog, setBattleLog,
    winner, setWinner,
    top3, setTop3,
    isShaking,
    countdown, setCountdown,
    followedPlayerId, setFollowedPlayerId,
    playerSizeMultiplier, setPlayerSizeMultiplier,
    isReelMode, setIsReelMode,
    isSpectatorMode, setIsSpectatorMode,
    totalAliveCount,
    arenaRef, canvasRef,
    vortexRadiusRef, abyssRotationRef,
    attackLinesRef, meteorsRef,
    startBattle, resetGame, playAgain, triggerScreenShake
  };
};
