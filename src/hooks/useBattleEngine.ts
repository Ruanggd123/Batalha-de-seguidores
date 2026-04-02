import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Player, BattleEvent, GameState, GameMode, HitEffect, FloatingText, AttackLine, Meteor } from '../types';
import { DEFAULT_AVATAR } from '../constants/assets';
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
import { getPlayerSize, getColorFromId, getSafeImageUrl, isImageUsable } from '../utils/gameUtils';

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
  const [winnerZoom, setWinnerZoom] = useState<{x: number, y: number, scale: number} | null>(null);

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
  const initialHpRef = useRef<number>(0);

  // --- 3. HELPERS (DYNAMIC MARGINS) ---
  const getMargins = useCallback((arenaHeight: number) => {
    const isSmallHeight = arenaHeight < 450;
    return {
        top: isSmallHeight ? 60 : 140,
        bottom: isSmallHeight ? 40 : 80
    };
  }, []);

  const TOP_MARGIN = 140; 
  const BOTTOM_MARGIN = 80; 

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

  const runBattleRound = useCallback((timestamp: number, alivePlayers: Player[], elapsedSeconds: number, currentMode: GameMode) => {
    const currentCount = alivePlayers.length;
    if (currentCount <= 1) return;

    const duration = targetDuration || 30;
    const progress = Math.min(1, elapsedSeconds / duration);

    const FINAL_DUEL_PROGRESS = Math.max(0, (duration - 10)) / duration; 
    const isFinalDuel   = progress >= FINAL_DUEL_PROGRESS && currentCount <= 10;
    const isMassacre    = progress >= FINAL_DUEL_PROGRESS && currentCount > 10;
    const isSuddenDeath = progress >= 0.97 && currentCount > 1;

    // --- MODE OVERRIDE FOR ELASTIC CLASH ---
    // Removido o bloqueio para permitir que o Massacre ocorra e a batalha dure o tempo correto.

    // Removed redundant 1-player centering as we now move directly to the Podium component

    if (initialHpRef.current === 0) {
        let hpSum = 0;
        for (let i = 0; i < alivePlayers.length; i++) hpSum += alivePlayers[i].hp;
        initialHpRef.current = hpSum;
    }

    if (isSuddenDeath) {
        const toKill = Math.min(currentCount - 1, Math.max(1, Math.ceil((currentCount - 1) / 8)));
        const victims = [...alivePlayers].sort(() => Math.random() - 0.5).slice(0, toKill);
        
        for (const p of victims) {
            p.hp = 0; p.isAlive = false; p.dying = DEATH_ANIMATION_FRAMES;
            lastEliminatedPlayerRef.current = p;
            eliminationOrderRef.current.push({ ...p });
            addHitEffect(p.x, p.y, '#ff4444', 'meteor');
        }
        return;
    }

    if (isMassacre) {
        const toKill = Math.min(currentCount - 10, Math.max(1, Math.ceil((currentCount - 10) * 0.05)));
        const victims = [...alivePlayers].sort(() => Math.random() - 0.5).slice(0, toKill);

        for (const p of victims) {
            if (!p || !p.isAlive) continue;
            p.hp = 0; p.isAlive = false; p.dying = DEATH_ANIMATION_FRAMES;
            lastEliminatedPlayerRef.current = p;
            eliminationOrderRef.current.push({ ...p });
            addHitEffect(p.x, p.y, '#ff4444', 'meteor');
        }
        return;
    }

    if (isFinalDuel) {
        const duelProgress = (progress - FINAL_DUEL_PROGRESS) / (1 - FINAL_DUEL_PROGRESS); 
        const duelIntensity = 0.3 + duelProgress * 0.7;
        
        const remainingTime = Math.max(0.1, (1 - progress) * duration);
        let duelHpSum = 0;
        for (let i = 0; i < alivePlayers.length; i++) duelHpSum += alivePlayers[i].hp;
        
        const baseDamage = (duelHpSum / (remainingTime * 60)) * (1.1 + Math.random() * 0.4); 
        const damage = Math.max(0.05, baseDamage * duelIntensity);

        const attackerIdx = Math.floor(Math.random() * alivePlayers.length);
        let targetIdx = Math.floor(Math.random() * alivePlayers.length);
        while (targetIdx === attackerIdx && alivePlayers.length > 1) {
            targetIdx = (targetIdx + 1) % alivePlayers.length;
        }
        
        const attacker = alivePlayers[attackerIdx];
        const target   = alivePlayers[targetIdx];
        if (!attacker || !target) return;

        target.hp -= damage;
        
        if (eventCounterRef.current % 3 === 0) {
            addHitEffect(target.x, target.y, '#FFD700', 'hit');
            attackLinesRef.current.push({
                id: eventCounterRef.current++,
                startX: attacker.x, startY: attacker.y,
                endX: target.x, endY: target.y,
                life: 18, color: '#FFD700'
            });
        } else {
            eventCounterRef.current++;
        }

        if (target.hp <= 0 && target.isAlive) {
            target.isAlive = false; target.hp = 0;
            target.dying = DEATH_ANIMATION_FRAMES;
            lastEliminatedPlayerRef.current = target;
            eliminationOrderRef.current.push({ ...target });
            addLogEventsBatch([{ text: `⚔️ ${attacker.name} vence o duelo final!`, type: 'elimination' }]);
        }
        return;
    }

    let targetHpPercent = 1.0;
    if (progress < 0.33) {
        targetHpPercent = 1.0 - (progress / 0.33) * 0.15;
    } else if (progress < 0.66) {
        targetHpPercent = 0.85 - ((progress - 0.33) / 0.33) * 0.75;
    } else {
        targetHpPercent = 0.1 - ((progress - 0.66) / (FINAL_DUEL_PROGRESS - 0.66)) * 0.1;
    }
    targetHpPercent = Math.max(0.005, targetHpPercent);

    const alCount = alivePlayers.length;
    const isEndingDuel = alCount === 2;
    const duelSlowDown = isEndingDuel ? 0.25 : 1.0; 
    let currentHpSum = 0;
    for (let i = 0; i < alivePlayers.length; i++) currentHpSum += alivePlayers[i].hp;

    const targetHp = initialHpRef.current * targetHpPercent;
    let hpToRemove = (currentHpSum - targetHp) * duelSlowDown;

    if (hpToRemove > 0) {
        const avgDamagePerHit = 17.5;
        let targetHitsThisFrame = (hpToRemove / avgDamagePerHit) / 3;

        // CATCH-UP LOGIC: If current HP is higher than target HP for this progress, we ACCELERATE!
        const catchupFactor = currentHpSum > targetHp ? (currentHpSum / targetHp) : 1.0;
        targetHitsThisFrame *= Math.min(catchupFactor, 6.0); // Allow up to 6x acceleration to hit the 30s mark

        // PERFORMANCE CAPS (Relaxed significantly to ensure 30s duration is met)
        if (currentCount > 5000) targetHitsThisFrame = Math.min(targetHitsThisFrame, 400); 
        else if (currentCount > 1000) targetHitsThisFrame = Math.min(targetHitsThisFrame, 200);
        else targetHitsThisFrame = Math.min(targetHitsThisFrame, 50);

        attackAccumulatorRef.current += targetHitsThisFrame;
        let attacksCount = Math.floor(attackAccumulatorRef.current);

        if (attacksCount > 0) {
            attackAccumulatorRef.current -= attacksCount;
            const newLogs: { text: string, type: BattleEvent['type'] }[] = [];

            for (let i = 0; i < attacksCount; i++) {
                const attackerIdx = Math.floor(Math.random() * alivePlayers.length);
                let targetIdx = Math.floor(Math.random() * alivePlayers.length);
                while (targetIdx === attackerIdx && alivePlayers.length > 1) {
                    targetIdx = Math.floor(Math.random() * alivePlayers.length);
                }
                const attacker = alivePlayers[attackerIdx];
                const target   = alivePlayers[targetIdx];
                if (!attacker || !target) continue;

                const damage = 12 + Math.random() * 10;
                target.hp -= damage;

                if (target.hp <= 0 && target.isAlive) {
                    target.isAlive = false; target.hp = 0;
                    target.dying = DEATH_ANIMATION_FRAMES;
                    lastEliminatedPlayerRef.current = target;
                    eliminationOrderRef.current.push({ ...target });
                    if (currentCount < 15) newLogs.push({ text: `${attacker.name} eliminado!`, type: 'elimination' });
                    addHitEffect(target.x, target.y, '#f59e0b', 'meteor'); // Gold for death
                } else {
                    // Optimized Visuals: Unified colors to prevent dizziness (DVD/Classic Mode)
                    const effectColor = currentMode === GameMode.Classic ? '#00ffff' : '#8b5cf6';
                    addHitEffect(target.x, target.y, effectColor, 'impact');
                }

                if (currentCount <= 50 && Math.random() < 0.35) {
                    if (currentMode === GameMode.Classic) {
                        attackLinesRef.current.push({
                            id: eventCounterRef.current++,
                            startX: attacker.x, startY: attacker.y,
                            endX: target.x, endY: target.y,
                            life: 20, color: '#00ffff'
                        });
                    } else {
                        addHitEffect(target.x, target.y, '#f59e0b', 'meteor');
                    }
                }
            }
            if (newLogs.length > 0) addLogEventsBatch(newLogs);
        }
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
            
            if (startTimeRef.current === 0) {
                startTimeRef.current = timestamp;
                initialHpRef.current = 0; 
            }
            const elapsed = (timestamp - startTimeRef.current) / 1000;
            
            if (gameMode === GameMode.Classic || gameMode === GameMode.ElasticClash) {
                runBattleRound(timestamp, aliveOnes, elapsed, gameMode);
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

                const progress = Math.min(1, elapsed / targetDuration);
                const rhythmMultiplier = 0.6 + 1.9 * Math.sin(progress * Math.PI);
                
                let sScale = rhythmMultiplier;
                
                if (currentAliveCount <= 10) sScale *= 0.18; 
                else if (currentAliveCount <= 25) sScale *= 0.35; 
                else if (currentAliveCount <= 60) sScale *= 0.65; 
                else if (currentAliveCount <= 200) sScale *= 0.85; 

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

                let sSize = 25;
                if (currentAliveCount > 3000) sSize = 5;
                else if (currentAliveCount > 1000) sSize = 10;
                else if (currentAliveCount > 400) sSize = 15;

                for (let j = 0; j < sSize; j++) {
                    const other = currentPlayers[Math.floor(Math.random() * currentPlayers.length)];
                    if (!other || other.id === p.id || !other.isAlive) continue;
                    const dx = p.x - other.x;
                    const dy = p.y - other.y;
                    const distSq = dx * dx + dy * dy;
                    const mDist = radius * 2.4; 
                    if (distSq < mDist * mDist) {
                        const dist = Math.sqrt(distSq) || 0.1;
                        const overlap = mDist - dist;
                        const separationX = (dx / dist) * (overlap / 2);
                        const separationY = (dy / dist) * (overlap / 2);
                        p.x += separationX; p.y += separationY;
                        other.x -= separationX; other.y -= separationY;

                        const f = (overlap / mDist) * 2.5 * sScale; 
                        nVx += (dx / dist) * f;
                        nVy += (dy / dist) * f;
                        
                        if (gameMode === GameMode.ElasticClash && p.isAlive && other.isAlive) {
                            const now = timestamp;
                            if ((!p.lastCollisionTime || now - p.lastCollisionTime > 400) && (!other.lastCollisionTime || now - other.lastCollisionTime > 400)) {
                                const dmg = (0.5 + Math.random() * 1.5); 
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
                
                const margins = getMargins(lh);
                const tm = margins.top;
                const bm = margins.bottom;

                let nx = p.x + nVx; let ny = p.y + nVy;
                if (nx < radius) { 
                  nx = radius; nVx = Math.abs(nVx); 
                  if (p.angle !== undefined) p.angle = Math.PI - p.angle;
                  if (gameMode === GameMode.ElasticClash) { p.hp -= 0.5; addHitEffect(p.x, p.y, '#ffffff', 'hit'); }
                }
                if (nx > lw - radius) { 
                  nx = lw - radius; nVx = -Math.abs(nVx); 
                  if (p.angle !== undefined) p.angle = Math.PI - p.angle;
                  if (gameMode === GameMode.ElasticClash) { p.hp -= 0.5; addHitEffect(p.x, p.y, '#ffffff', 'hit'); }
                }
                if (ny < tm + radius) { 
                  ny = tm + radius; nVy = Math.abs(nVy); 
                  if (p.angle !== undefined) p.angle = -p.angle;
                  if (gameMode === GameMode.ElasticClash) { p.hp -= 0.5; addHitEffect(p.x, p.y, '#ffffff', 'hit'); }
                }
                if (ny > lh - bm - radius) { 
                  ny = lh - bm - radius; nVy = -Math.abs(nVy); 
                  if (p.angle !== undefined) p.angle = -p.angle;
                  if (gameMode === GameMode.ElasticClash) { p.hp -= 0.5; addHitEffect(p.x, p.y, '#ffffff', 'hit'); }
                }
                
                // Check if died from wall hit
                if (gameMode === GameMode.ElasticClash && p.hp <= 0 && p.isAlive) {
                  p.isAlive = false; p.dying = DEATH_ANIMATION_FRAMES;
                  lastEliminatedPlayerRef.current = p; eliminationOrderRef.current.push({...p});
                  addHitEffect(p.x, p.y, '#ff4444', 'meteor');
                }
                
                p.x = nx; p.y = ny; p.vx = nVx; p.vy = nVy;
            }
            playersRef.current = nextBatch;

            if (timestamp - lastStateUpdateRef.current > 150) {
                const finalAliveOnes = nextBatch.filter(p => p.isAlive);
                const finalCount = finalAliveOnes.length;
                setTotalAliveCount(finalCount);
                if (finalCount <= 1000) setPlayers([...nextBatch]);
                
                const nowTime = Date.now();
                hitEffectsRef.current = hitEffectsRef.current.filter(e => nowTime - e.startTime < 450);
                setHitEffects([...hitEffectsRef.current]);
                
                if (finalCount <= 1) {
                    const win = finalAliveOnes[0] || lastEliminatedPlayerRef.current;
                    
                    // CRITICAL FIX: Set winner and top 3 BEFORE setting GameState.Finished
                    // This ensures the podium re-renders with valid data immediately.
                    const eo = eliminationOrderRef.current;
                    const top = win ? [win] : [];
                    for (let k = eo.length-1; k>=0 && top.length<3; k--) {
                        if (!top.find(x => x.id === eo[k].id)) top.push(eo[k]);
                    }
                    
                    setWinner(win);
                    setTop3(top);
                    setGameState(GameState.Finished);
                    
                    if (stopNarrationFn) stopNarrationFn();
                    
                    // Clear canvas one last time to ensure no stuck graphics
                    const canvas = canvasRef.current;
                    if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                }
                lastStateUpdateRef.current = timestamp;
            }
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            if (lw > 0 && lh > 0) {
                if (canvas.width !== lw || canvas.height !== lh) { canvas.width = lw; canvas.height = lh; }
                ctx.globalAlpha = 1.0;
                ctx.clearRect(0, 0, lw, lh);
            } else {
                animationFrameRef.current = requestAnimationFrame(gameLoop);
                return; 
            }
            const dp = playersRef.current;
            const alCount = dp.filter(p => p.isAlive).length;
            const pSize = getPlayerSize(alCount, lw) * playerSizeMultiplier;
            const r = pSize/2;
            
            const showDetails = alCount <= 200;
            const showImages = alCount <= 2500;

            if (alCount <= 10 && alCount > 1 && gameState === GameState.Running) {
                ctx.save();
                ctx.globalAlpha = 1.0;
                const pulse = 0.85 + Math.sin(timestamp * 0.006) * 0.15;
                const msg = '⚔️ CONFRONTO FINAL ⚔️';
                
                // --- Premium Design Header Overlay ---
                const bannerH = 70;
                const bannerY = 120; // Lower than the header
                
                // Background Glow Bar
                const grad = ctx.createLinearGradient(0, bannerY, lw, bannerY);
                grad.addColorStop(0, 'transparent');
                grad.addColorStop(0.5, 'rgba(234, 179, 8, 0.25)');
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.fillRect(0, bannerY - bannerH/2, lw, bannerH);

                ctx.font = `black ${Math.round(42 * pulse)}px Orbitron, sans-serif`;
                ctx.textAlign = 'center';
                ctx.shadowBlur = 30; ctx.shadowColor = '#FFD700';
                ctx.fillStyle = '#FFD700';
                ctx.fillText(msg, lw / 2, bannerY + 15);
                ctx.shadowBlur = 0;
                ctx.restore();
            }

            dp.forEach((p, pIdx) => {
                const opacity = p.isAlive ? 1 : (p.dying || 0) / DEATH_ANIMATION_FRAMES;
                if (opacity <= 0) return;
                ctx.globalAlpha = opacity;

                const alCount = dp.filter(pl => pl.isAlive).length;
                const pSize = getPlayerSize(alCount, lw) * playerSizeMultiplier;
                const r = pSize/2;

                // 1. Draw Halo if in Final Duelo
                if (alCount === 2 && p.isAlive) {
                    const haloColor = pIdx === 0 ? '#FFD700' : '#ff4444';
                    const haloRadius = r + 6 + Math.sin(timestamp * 0.008 + pIdx * Math.PI) * 3;
                    ctx.save();
                    ctx.globalAlpha = 0.85 * opacity;
                    ctx.beginPath(); ctx.arc(p.x, p.y, haloRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = haloColor; ctx.lineWidth = 3;
                    ctx.shadowBlur = 12; ctx.shadowColor = haloColor;
                    ctx.stroke();
                    ctx.shadowBlur = 0; ctx.restore();
                    ctx.globalAlpha = opacity;
                }

                // 2. Draw Image or Placeholder
                // Aumentamos o limite para 4000 para melhor visual em batalhas grandes
                // E garantimos que o jogador SEGUIDO sempre mostre a imagem, independente do total
                const isFollowed = p.id === followedPlayerId;
                const showImages = alCount <= 4000 || isFollowed;
                
                if (showImages && p.isAlive) {
                    const img = p.image;
                    if (img && isImageUsable(img)) {
                        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.clip();
                        ctx.drawImage(img, p.x - r, p.y - r, pSize, pSize); ctx.restore();
                    } else { 
                        // --- VIBRANT PLACERHOLDER ---
                        const hue = (p.id * 137.5) % 360;
                        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2);
                        ctx.fillStyle = `hsl(${hue}, 45%, 45%)`; 
                        ctx.fill();
                        
                        ctx.beginPath();
                        ctx.fillStyle = 'rgba(255,255,255,0.3)';
                        ctx.arc(p.x, p.y - r/5, r/3, 0, Math.PI*2);
                        ctx.moveTo(p.x - r/2, p.y + r/2);
                        ctx.quadraticCurveTo(p.x, p.y + r/6, p.x + r/2, p.y + r/2);
                        ctx.fill();
                    }
                } else if (p.isAlive) { 
                    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2);
                    ctx.fillStyle = '#1e293b'; 
                    ctx.fill();
                }

                // 3. Health Bars (if needed)
                const showDetails = alCount <= 200;
                if (p.isAlive && showDetails) {
                    let hpOpacity = 1.0;
                    if (alCount > 5000) hpOpacity = 0.05;
                    else if (alCount > 800) hpOpacity = 0.3;
                    
                    const barW = pSize * 1.3; 
                    const barH = Math.max(3, pSize / 8);
                    const barX = p.x - barW / 2; 
                    const barY = p.y + r + 4;

                    ctx.fillStyle = `rgba(0,0,0,${hpOpacity * 0.4})`; 
                    ctx.fillRect(barX, barY, barW, barH);
                    
                    const hpP = Math.max(0, p.hp / (p.maxHp || 100));
                    const barColor = hpP > 0.3 ? '#4ade80' : '#ef4444';
                    ctx.fillStyle = barColor; ctx.globalAlpha = hpOpacity;
                    ctx.fillRect(barX, barY, barW * hpP, barH);
                    ctx.globalAlpha = opacity;

                    if (alCount <= 150) {
                        const fS = Math.min(16, Math.max(9, pSize / 5));
                        ctx.font = `bold ${fS}px Orbitron`; ctx.textAlign = 'center'; ctx.fillStyle = 'white'; 
                        ctx.fillText(p.name, p.x, barY + barH + fS + 2);
                    }
                }
            });

            attackLinesRef.current.forEach(l => {
                ctx.beginPath(); ctx.moveTo(l.startX, l.startY); ctx.lineTo(l.endX, l.endY);
                ctx.strokeStyle = l.color || '#00ffff'; 
                ctx.globalAlpha = l.life/60; 
                ctx.lineWidth = 1.8; 
                ctx.stroke(); 
                
                if (l.life > 10) {
                    const angle = Math.atan2(l.endY - l.startY, l.endX - l.startX);
                    const headLen = 12;
                    ctx.beginPath();
                    ctx.moveTo(l.endX, l.endY);
                    ctx.lineTo(l.endX - headLen * Math.cos(angle - Math.PI/7), l.endY - headLen * Math.sin(angle - Math.PI/7));
                    ctx.moveTo(l.endX, l.endY);
                    ctx.lineTo(l.endX - headLen * Math.cos(angle + Math.PI/7), l.endY - headLen * Math.sin(angle + Math.PI/7));
                    ctx.stroke();
                }
                l.life--;
            });
            attackLinesRef.current = attackLinesRef.current.filter(l => l.life > 0);
        }
        animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);
    return () => { isLooping = false; if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [gameState, gameMode, playerSizeMultiplier, targetDuration, audio?.stopNarration]);

  const startBattle = useCallback(() => {
    const arena = arenaRef.current;
    if (!arena) return;
    const pCount = playersRef.current.length;
    if (pCount === 0) return;
    const lw = arena.clientWidth; const lh = arena.clientHeight;
    const scattered = playersRef.current.map(p => {
        const margins = getMargins(lh);
        return {
            ...p, isAlive: true, hp: 100, maxHp: 100,
            x: Math.random() * (lw - 40) + 20, y: Math.random() * (lh - margins.top - margins.bottom - 40) + margins.top + 20,
            vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5
        };
    });
    playersRef.current = scattered; setPlayers(scattered); setTotalAliveCount(pCount);
    setGameState(GameState.Countdown); setCountdown(3);
    const itv = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(itv);
          setGameState(GameState.Running);
          startTimeRef.current = 0;
          initialHpRef.current = 0;
          return null;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);
  }, [playersRef, setPlayers, getMargins]);

  const resetGame = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setGameState(GameState.AwaitingPlayers); setWinner(null); setTop3([]); setBattleLog([]); setTotalAliveCount(0); setFollowedPlayerId(null);
    setPlayers([]); playersRef.current = []; allPlayersRef.current = []; if (totalPlayersRef) totalPlayersRef.current = 0;
    attackLinesRef.current = []; attackAccumulatorRef.current = 0;
    setWinnerZoom(null);
  }, [setPlayers, playersRef, allPlayersRef, totalPlayersRef]);

  const playAgain = useCallback(() => {
    const src = allPlayersRef.current.length > 0 ? allPlayersRef.current : playersRef.current;
    const rst = src.map(p => ({ ...p, isAlive: true, hp: 100, maxHp: 100, dying: 0, vx: 0, vy: 0 }));
    setPlayers(rst); playersRef.current = rst; setTotalAliveCount(rst.length);
    setGameState(GameState.AwaitingPlayers); setWinner(null); setTop3([]); setBattleLog([]);
    setWinnerZoom(null);
  }, [setPlayers, playersRef, allPlayersRef]);

  return {
    gameState, setGameState, gameMode, setGameMode, battleLog, setBattleLog, winner, setWinner, top3, setTop3, 
    isShaking, countdown, setCountdown, followedPlayerId, setFollowedPlayerId, playerSizeMultiplier, setPlayerSizeMultiplier, 
    isReelMode, setIsReelMode, isSpectatorMode, setIsSpectatorMode, hitEffects, setHitEffects, totalAliveCount, 
    winnerZoom,
    arenaRef, canvasRef, startBattle, resetGame, playAgain, triggerScreenShake
  };
};
