import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Player, BattleEvent, GameState, GameMode, HitEffect, FloatingText, AttackLine, Meteor } from '../types';
import { 
  NORMAL_BATTLE_INTERVAL_MS,
  DEATH_ANIMATION_FRAMES, 
  VORTEX_INITIAL_RADIUS, 
  VORTEX_GROWTH_RATE,
  VORTEX_STRENGTH,
  VORTEX_SPIRAL_FORCE,
  SPHERE_GRAVITY,
  DAMPING,
  REPULSION_FORCE,
  PIXEL_MODE_THRESHOLD,
  INITIAL_HP,
  GRAVITY_ABYSS_RADIUS_FACTOR,
  GRAVITY_ABYSS_HOLE_SIZE_DEGREES,
  GRAVITY_ABYSS_ROTATION_SPEED
} from '../constants/gameConfig';
import { getPlayerSize, getColorFromId, getSafeImageUrl } from '../utils/gameUtils';

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
  // --- 1. STATE ---
  const [gameState, setGameState] = useState<GameState>(GameState.AwaitingPlayers);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.Classic);
  const [battleLog, setBattleLog] = useState<BattleEvent[]>([]);
  const [winner, setWinner] = useState<Player | null>(null);
  const [top3, setTop3] = useState<Player[]>([]);
  const [totalAliveCount, setTotalAliveCount] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [followedPlayerId, setFollowedPlayerId] = useState<number | null>(null);
  const [playerSizeMultiplier, setPlayerSizeMultiplier] = useState<number>(1.0);
  const [isReelMode, setIsReelMode] = useState(false);
  const [isSpectatorMode, setIsSpectatorMode] = useState(false);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);

  // --- 2. REFS ---
  const arenaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastStateUpdateRef = useRef<number>(0);
  const eliminationOrderRef = useRef<Player[]>([]);
  const lastEliminatedPlayerRef = useRef<Player | null>(null);
  const attackLinesRef = useRef<AttackLine[]>([]);
  const attackAccumulatorRef = useRef<number>(0);
  const eventCounterRef = useRef<number>(0);
  const lastBattleTimeRef = useRef<number>(0);
  const lastHitEffectIdRef = useRef<number>(0);
  const hitEffectsRef = useRef<HitEffect[]>([]);

  const TOP_MARGIN = 140; 
  const BOTTOM_MARGIN = 80; 
  const DEFAULT_PROFILE_IMAGE = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

  // --- 3. HELPERS ---
  const triggerScreenShake = useCallback(() => {
    if (isShaking) return;
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 300);
  }, [isShaking]);

  const addHitEffect = useCallback((x: number, y: number, color: string = '#ffffff', type: HitEffect['type'] = 'hit') => {
    const id = lastHitEffectIdRef.current++;
    hitEffectsRef.current.push({ id, x, y, color, type, startTime: Date.now() });
  }, []);

  const addLogEventsBatch = useCallback((events: {text: string, type: BattleEvent['type']}[]) => {
    if (events.length === 0) return;
    const newEvents = events.map(e => ({ id: eventCounterRef.current++, text: e.text, type: e.type }));
    setBattleLog(prev => [...prev, ...newEvents].slice(-50));
  }, []);

  const runBattleRound = useCallback((timestamp: number, alivePlayers: Player[], elapsedSeconds: number) => {
    const currentCount = alivePlayers.length;
    if (currentCount <= 1) return;

    // Calculate attack rate based on remaining time and player count
    const estimatedHitsToKill = 10;
    const ticksPerSecond = 60;
    const remainingTime = Math.max(1, targetDuration - elapsedSeconds);
    
    const initialRate = (totalPlayersRef.current * estimatedHitsToKill) / (targetDuration * ticksPerSecond);
    let targetRate = (currentCount * estimatedHitsToKill) / (remainingTime * ticksPerSecond);

    // CINEMATIC SLOW-MO: Drastically reduce targetRate for final duels
    if (currentCount <= 15) targetRate = 0.4 / ticksPerSecond; // ~1 death every 25 seconds
    else if (currentCount <= 60) targetRate = 4.0 / ticksPerSecond; 
    else targetRate = Math.min(targetRate, initialRate * 4); // Cap speed

    // Accumulate attack energy
    attackAccumulatorRef.current += targetRate;
    let attacksThisFrame = Math.floor(attackAccumulatorRef.current);
    
    // Limit attacks in the finale to keep it clean
    if (currentCount <= 15) attacksThisFrame = Math.min(attacksThisFrame, 1);
    else if (currentCount <= 60) attacksThisFrame = Math.min(attacksThisFrame, 2);

    if (attacksThisFrame > 0) {
        attackAccumulatorRef.current -= attacksThisFrame;
        const newLogs: {text: string, type: BattleEvent['type']}[] = [];

        for (let i = 0; i < attacksThisFrame; i++) {
            const attackerIdx = Math.floor(Math.random() * alivePlayers.length);
            let targetIdx = Math.floor(Math.random() * alivePlayers.length);
            while (targetIdx === attackerIdx && alivePlayers.length > 1) {
                targetIdx = Math.floor(Math.random() * alivePlayers.length);
            }

            const attacker = alivePlayers[attackerIdx];
            const target = alivePlayers[targetIdx];
            if (!attacker || !target) continue;

            const damage = 10 + Math.random() * 15;
            target.hp -= damage;

            if (target.hp <= 0 && target.isAlive) {
                target.isAlive = false;
                target.hp = 0;
                target.dying = DEATH_ANIMATION_FRAMES;
                lastEliminatedPlayerRef.current = target;
                eliminationOrderRef.current.push({ ...target });
                if (currentCount < 20) newLogs.push({ text: `${attacker.name} eliminou ${target.name}!`, type: 'elimination' });
                addHitEffect(target.x, target.y, '#ff4444', 'meteor'); // BIG EFFECT for death
            } else {
                addHitEffect(target.x, target.y, '#00ffff', 'hit'); // Normal hit color
            }

            // Draw laser if not in pixel mode
            if (currentCount <= 500) {
                attackLinesRef.current.push({
                    id: eventCounterRef.current++,
                    startX: attacker.x, startY: attacker.y, endX: target.x, endY: target.y,
                    life: 45, color: '#00ffff'
                });
            }
        }
        if (newLogs.length > 0) addLogEventsBatch(newLogs);
    }
  }, [targetDuration, addLogEventsBatch]);

  // --- 4. MAIN LOOP ---
  useEffect(() => {
    if (gameState === GameState.AwaitingPlayers || gameState === GameState.Finished) {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
    }
    
    let isLooping = true;
    const stopNarrationFn = audio?.stopNarration;

    const gameLoop = (timestamp: number) => {
        if (!isLooping) return;
        
        const arena = arenaRef.current;
        const canvas = canvasRef.current;
        if (!arena || !canvas) {
            animationFrameRef.current = requestAnimationFrame(gameLoop);
            return;
        }

        const lw = arena.clientWidth;
        const lh = arena.clientHeight;

        if (gameState === GameState.Running) {
            const currentPlayers = playersRef.current;
            const aliveOnes = currentPlayers.filter(p => p.isAlive);
            const currentAliveCount = aliveOnes.length;
            
            if (startTimeRef.current === 0) startTimeRef.current = timestamp;
            const elapsed = (timestamp - startTimeRef.current) / 1000;
            
            if (gameMode === GameMode.Classic) {
                runBattleRound(timestamp, aliveOnes, elapsed);
            }

            const nextBatch: Player[] = [];
            const currentSize = getPlayerSize(currentAliveCount, lw) * playerSizeMultiplier;
            const radius = currentSize / 2;

            for (let i = 0; i < currentPlayers.length; i++) {
                const p = currentPlayers[i];
                
                if (p.hp <= 0 && p.isAlive) {
                    p.isAlive = false;
                    p.dying = DEATH_ANIMATION_FRAMES;
                    if (p.id === followedPlayerId) setFollowedPlayerId(null);
                }

                if (p.dying && p.dying > 0) p.dying--;
                if (!p.isAlive && (!p.dying || p.dying <= 0)) continue;
                nextBatch.push(p);

                let sScale = 1.0;
                if (currentAliveCount <= 15) sScale = 0.20;
                else if (currentAliveCount <= 50) sScale = 0.45;
                else if (currentAliveCount <= 100) sScale = 0.75;

                let nVx = p.vx;
                let nVy = p.vy;

                if (gameMode === GameMode.Classic) {
                    if (p.angle === undefined) p.angle = Math.random() * Math.PI * 2;
                    if (p.targetSpeed === undefined) p.targetSpeed = (1.0 + Math.random() * 1.5);
                    const tSpeed = (p.targetSpeed || 1.5) * sScale;
                    p.angle += (Math.random() - 0.5) * 0.1 * sScale; 
                    const dvx = Math.cos(p.angle) * tSpeed;
                    const dvy = Math.sin(p.angle) * tSpeed;
                    nVx += (dvx - nVx) * (0.05 * sScale);
                    nVy += (dvy - nVy) * (0.05 * sScale);
                } else if (gameMode === GameMode.ElasticClash) {
                    if (nVx === 0 && nVy === 0) {
                        const angle = Math.random() * Math.PI * 2;
                        const dSpeed = 2.5 * sScale;
                        nVx = Math.cos(angle) * dSpeed;
                        nVy = Math.sin(angle) * dSpeed;
                    } else {
                        const tSpeed = 2.5 * sScale;
                        const ratio = tSpeed / (Math.sqrt(nVx*nVx + nVy*nVy) || 1);
                        nVx *= ratio; nVy *= ratio;
                    }
                }

                const sSize = currentAliveCount > 500 ? 10 : 30;
                for (let j = 0; j < sSize; j++) {
                    const other = currentPlayers[Math.floor(Math.random() * currentPlayers.length)];
                    if (!other || other.id === p.id || !other.isAlive) continue;
                    const dx = p.x - other.x;
                    const dy = p.y - other.y;
                    const distSq = dx * dx + dy * dy;
                    const mDist = radius * 2.4; 
                    if (distSq < mDist * mDist) {
                        const dist = Math.sqrt(distSq) || 0.1;
                        const f = ((mDist - dist) / mDist) * 2.5 * sScale; 
                        nVx += (dx / dist) * f;
                        nVy += (dy / dist) * f;
                        
                        if (gameMode === GameMode.ElasticClash && p.isAlive && other.isAlive) {
                            const now = timestamp;
                            if ((!p.lastCollisionTime || now - p.lastCollisionTime > 400) && (!other.lastCollisionTime || now - other.lastCollisionTime > 400)) {
                                const dmg = (1.5 + Math.random() * 1.5);
                                other.hp -= dmg; other.lastCollisionTime = now;
                                p.hp -= dmg; p.lastCollisionTime = now;
                                if (other.hp <= 0 && other.isAlive) {
                                  other.isAlive = false; other.dying = DEATH_ANIMATION_FRAMES;
                                  lastEliminatedPlayerRef.current = other; eliminationOrderRef.current.push({...other});
                                  addHitEffect(other.x, other.y, '#ff4444', 'meteor');
                                } else { addHitEffect(other.x, other.y, '#ffffff', 'hit'); }
                                if (p.hp <= 0 && p.isAlive) {
                                  p.isAlive = false; p.dying = DEATH_ANIMATION_FRAMES;
                                  lastEliminatedPlayerRef.current = p; eliminationOrderRef.current.push({...p});
                                  addHitEffect(p.x, p.y, '#ff4444', 'meteor');
                                }
                            }
                        }
                    }
                }

                const dmp = gameMode === GameMode.ElasticClash ? 1.0 : (1.0 - (1.0 - DAMPING) * sScale);
                nVx *= dmp; nVy *= dmp;
                
                let nx = p.x + nVx; let ny = p.y + nVy;
                if (nx < radius) { nx = radius; nVx = Math.abs(nVx); if (p.angle !== undefined) p.angle = Math.PI - p.angle; }
                if (nx > lw - radius) { nx = lw - radius; nVx = -Math.abs(nVx); if (p.angle !== undefined) p.angle = Math.PI - p.angle; }
                if (ny < TOP_MARGIN + radius) { ny = TOP_MARGIN + radius; nVy = Math.abs(nVy); if (p.angle !== undefined) p.angle = -p.angle; }
                if (ny > lh - BOTTOM_MARGIN - radius) { ny = lh - BOTTOM_MARGIN - radius; nVy = -Math.abs(nVy); if (p.angle !== undefined) p.angle = -p.angle; }
                
                p.x = nx; p.y = ny; p.vx = nVx; p.vy = nVy;
            }
            playersRef.current = nextBatch;

            // UI State Sync (Throttled)
            if (timestamp - lastStateUpdateRef.current > 150) {
                const finalAliveOnes = nextBatch.filter(p => p.isAlive);
                const finalCount = finalAliveOnes.length;
                setTotalAliveCount(finalCount);
                if (finalCount <= 1000) setPlayers([...nextBatch]);
                
                // --- SYNC HIT EFFECTS (NEW: NO SETTIMEOUT) ---
                const nowTime = Date.now();
                // Filter out effects older than 450ms
                hitEffectsRef.current = hitEffectsRef.current.filter(e => nowTime - e.startTime < 450);
                // Sync to state for UI rendering
                setHitEffects([...hitEffectsRef.current]);
                
                if (finalCount <= 1) {
                    const win = finalAliveOnes[0] || lastEliminatedPlayerRef.current;
                    setGameState(GameState.Finished);
                    if (stopNarrationFn) stopNarrationFn();
                    setTimeout(() => {
                        setWinner(win);
                        const eo = eliminationOrderRef.current;
                        const top = win ? [win] : [];
                        for (let k = eo.length-1; k>=0 && top.length<3; k--) {
                            if (!top.find(x => x.id === eo[k].id)) top.push(eo[k]);
                        }
                        setTop3(top);
                    }, 2000);
                }
                lastStateUpdateRef.current = timestamp;
            }
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
            if (canvas.width !== lw || canvas.height !== lh) { canvas.width = lw; canvas.height = lh; }
            ctx.clearRect(0, 0, lw, lh);
            const dp = playersRef.current;
            const alCount = dp.filter(p => p.isAlive).length;
            const pSize = getPlayerSize(alCount, lw) * playerSizeMultiplier;
            const r = pSize/2;
            const drawImgs = alCount <= 3000;

            dp.forEach(p => {
                const opacity = p.isAlive ? 1 : (p.dying || 0) / DEATH_ANIMATION_FRAMES;
                if (opacity <= 0) return;
                ctx.globalAlpha = opacity;
                if (drawImgs && p.isAlive) {
                    const img = imageCache.current[getSafeImageUrl(p.imageUrl)];
                    if (img) {
                        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.clip();
                        ctx.drawImage(img, p.x - r, p.y - r, pSize, pSize); ctx.restore();
                    } else { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fillStyle = getColorFromId(p.id); ctx.fill(); }
                } else { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fillStyle = getColorFromId(p.id); ctx.fill(); }

                if (p.isAlive && alCount <= 150) {
                    const barW = pSize * 1.2; const barH = Math.max(4, pSize / 10);
                    const barX = p.x - barW / 2; const barY = p.y + r + 5;
                    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(barX, barY, barW, barH);
                    const hpP = Math.max(0, p.hp / (p.maxHp || 100));
                    ctx.fillStyle = hpP > 0.3 ? '#4ade80' : '#ef4444'; ctx.fillRect(barX, barY, barW * hpP, barH);
                    const fS = Math.min(18, Math.max(10, pSize / 5));
                    ctx.font = `bold ${fS}px Orbitron`; ctx.textAlign = 'center'; ctx.fillStyle = 'white'; 
                    ctx.fillText(p.name, p.x, barY + barH + fS + 2);
                }
            });
            attackLinesRef.current.forEach(l => {
                ctx.beginPath(); ctx.moveTo(l.startX, l.startY); ctx.lineTo(l.endX, l.endY);
                ctx.strokeStyle = '#00ffff'; ctx.globalAlpha = l.life/45; ctx.lineWidth = 2; ctx.stroke(); l.life--;
            });
            attackLinesRef.current = attackLinesRef.current.filter(l => l.life > 0);
        }
        animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);
    return () => { isLooping = false; if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [gameState, gameMode, playerSizeMultiplier, targetDuration, audio?.stopNarration]);

  // --- 5. ACTIONS ---
  const startBattle = useCallback(() => {
    const arena = arenaRef.current;
    if (!arena) return;
    const pCount = playersRef.current.length;
    if (pCount === 0) return;
    const lw = arena.clientWidth; const lh = arena.clientHeight;
    const scattered = playersRef.current.map(p => ({
        ...p, isAlive: true, hp: 100, maxHp: 100,
        x: Math.random() * (lw - 40) + 20, y: Math.random() * (lh - TOP_MARGIN - BOTTOM_MARGIN - 40) + TOP_MARGIN + 20,
        vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5
    }));
    playersRef.current = scattered; setPlayers(scattered); setTotalAliveCount(pCount);
    setGameState(GameState.Countdown); setCountdown(3);
    const itv = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) { clearInterval(itv); setGameState(GameState.Running); startTimeRef.current = performance.now(); return null; }
        return prev ? prev - 1 : null;
      });
    }, 1000);
  }, [playersRef, setPlayers]);

  const resetGame = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setGameState(GameState.AwaitingPlayers); setWinner(null); setTop3([]); setBattleLog([]); setTotalAliveCount(0); setFollowedPlayerId(null);
    setPlayers([]); playersRef.current = []; allPlayersRef.current = []; if (totalPlayersRef) totalPlayersRef.current = 0;
    attackLinesRef.current = []; attackAccumulatorRef.current = 0;
  }, [setPlayers, playersRef, allPlayersRef, totalPlayersRef]);

  const playAgain = useCallback(() => {
    const src = allPlayersRef.current.length > 0 ? allPlayersRef.current : playersRef.current;
    const rst = src.map(p => ({ ...p, isAlive: true, hp: 100, maxHp: 100, dying: 0, vx: 0, vy: 0 }));
    setPlayers(rst); playersRef.current = rst; setTotalAliveCount(rst.length);
    setGameState(GameState.AwaitingPlayers); setWinner(null); setTop3([]); setBattleLog([]);
  }, [setPlayers]);

  return {
    gameState, setGameState, gameMode, setGameMode, battleLog, setBattleLog, winner, setWinner, top3, setTop3, 
    isShaking, countdown, setCountdown, followedPlayerId, setFollowedPlayerId, playerSizeMultiplier, setPlayerSizeMultiplier, 
    isReelMode, setIsReelMode, isSpectatorMode, setIsSpectatorMode, hitEffects, setHitEffects, totalAliveCount, 
    arenaRef, canvasRef, startBattle, resetGame, playAgain, triggerScreenShake
  };
};
