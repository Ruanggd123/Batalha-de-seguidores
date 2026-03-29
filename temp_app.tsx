// Fix: Corrected React import statement to properly import hooks.
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Player, BattleEvent, GameState, FloatingText, HitEffect, GameMode, AttackLine, Meteor } from './types';
import { generatePowersForPlayers } from './services/powerService';
import { generateDemoPlayers } from './services/demoPlayerService';
import BattleLog from './components/BattleLog';
import WinnerConfetti from './components/WinnerConfetti';
import DynamicBackground from './components/backgrounds/DynamicBackground';


const INITIAL_HP = 100;
const NORMAL_BATTLE_INTERVAL_MS = 200; // Velocidade normal para o fim de jogo (<= 100 jogadores)
const MAX_SPEED_BATTLE_INTERVAL_MS = 1; // Velocidade máxima para hordas gigantes
const KNOCKBACK_FORCE = 15;
const REPULSION_FORCE = 1.0;
const DAMPING = 0.95;
const AOE_CHANCE = 0.05;
const AOE_RADIUS = 120;
const AOE_DAMAGE_BASE = 3;
const AOE_DAMAGE_RANDOM = 5;
const PHYSICS_OPTIMIZATION_THRESHOLD = 200; // Otimiza a física com mais agressividade
const PHYSICS_SAMPLE_SIZE = 15;
const DEATH_ANIMATION_FRAMES = 30;
const UI_UPDATE_INTERVAL = 100; // ms

// Game Mode Constants
const VORTEX_STRENGTH = 50;
const VORTEX_SPIRAL_FORCE = 0.8; // New: Adds a spiral motion to the vortex pull
const VORTEX_INITIAL_RADIUS = 50;
const VORTEX_GROWTH_RATE = 0.5;
// New Gravity Abyss Constants
const GRAVITY_ABYSS_ROTATION_SPEED = 0.003;
const SPHERE_GRAVITY = 0.15;
const GRAVITY_ABYSS_RADIUS_FACTOR = 0.45;
const GRAVITY_ABYSS_HOLE_SIZE_DEGREES = 60;


// Player size constants for dynamic scaling
const MIN_PLAYER_SIZE = 2; // Tamanho mínimo de 2px para o modo de pixel
const MAX_PLAYER_SIZE = 80;
const MIN_PLAYERS_FOR_MAX_SIZE = 50;
const MAX_PLAYERS_FOR_MIN_SIZE = 200; // Switch to pixel mode sooner for better performance
const PIXEL_MODE_THRESHOLD = 12; // Size at which we switch to simple dots

// New mechanics constants
const ATTACK_TRACER_THRESHOLD = 150;
const ATTACK_TRACER_LIFESPAN = 20; // frames
const METEOR_SHOWER_THRESHOLD = 1000;
const METEOR_SPAWN_INTERVAL = 500; // ms
const METEOR_IMPACT_TIMER = 180; // frames (~3s)
const METEOR_RADIUS = 150;
const METEOR_DAMAGE_BASE = 15;
const METEOR_DAMAGE_RANDOM = 10;
const METEOR_KNOCKBACK = 25;

const BGM_PLAYLIST = [
  "https://opengameart.org/sites/default/files/battleThemeA.mp3",
  "https://opengameart.org/sites/default/files/Visager_-_17_-_Fight_Loop.mp3",
  "https://opengameart.org/sites/default/files/Visager_-_14_-_The_Final_Trap.mp3",
  "https://opengameart.org/sites/default/files/Visager_-_05_-_The_Great_Lighthouse.mp3"
];

// Helper to convert HSL to RGB for optimized rendering
// h in [0, 360], s in [0, 1], l in [0, 1] -> {r, g, b} in [0, 255]
const hslToRgb = (h: number, s: number, l: number) => {
    let r, g, b;
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h / 360 + 1 / 3);
        g = hue2rgb(p, q, h / 360);
        b = hue2rgb(p, q, h / 360 - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};
const colorCache = new Map<number, {r: number, g: number, b: number}>();
const getRgbColorFromId = (id: number) => {
    if (colorCache.has(id)) {
        return colorCache.get(id)!;
    }
    const hue = (id * 137.508) % 360; // Use golden angle approximation
    const color = hslToRgb(hue, 0.8, 0.6);
    colorCache.set(id, color);
    return color;
};


// Helper function to determine player size with dynamic scaling
const getPlayerSize = (count: number): number => {
    if (count <= MIN_PLAYERS_FOR_MAX_SIZE) {
        return MAX_PLAYER_SIZE;
    }
    if (count >= MAX_PLAYERS_FOR_MIN_SIZE) {
        return MIN_PLAYER_SIZE;
    }

    // Linear interpolation between the min and max sizes based on player count
    const playerCountRange = MAX_PLAYERS_FOR_MIN_SIZE - MIN_PLAYERS_FOR_MAX_SIZE;
    const sizeRange = MAX_PLAYER_SIZE - MIN_PLAYER_SIZE;
    const progress = (count - MIN_PLAYERS_FOR_MAX_SIZE) / playerCountRange;
    
    return Math.round(MAX_PLAYER_SIZE - progress * sizeRange);
};

// Helper function to generate a color from an ID
const getColorFromId = (id: number): string => {
    const hue = (id * 137.508) % 360; // Use golden angle approximation
    return `hsl(${hue}, 80%, 60%)`;
};

type Platform = 'Instagram' | 'TikTok';

const gameModeDetails = {
  [GameMode.Classic]: { title: 'Batalha Clássica', description: 'Uma arena aberta onde apenas o mais forte sobrevive. Empurre e ataque!', icon: '⚔️' },
  [GameMode.GravityAbyss]: { title: 'Abismo Gravitacional', description: 'Uma esfera gigante gira sem parar. A gravidade o puxa para o fundo - escale as paredes para não ser engolido pelo abismo em movimento!', icon: '🌐' },
  [GameMode.Vortex]: { title: 'Vórtice Aniquilador', description: 'Um vórtice mortal no centro se expande. Fuja para as bordas para sobreviver!', icon: '🌀' },
};

const themes = {
  [GameMode.Classic]: {
    classes: {
      border: 'border-purple-400/20',
      borderSelected: 'border-purple-400',
      ringSelected: 'ring-purple-400/70',
      bgSelected: 'bg-purple-900/30',
      shadowSelected: 'shadow-[0_0_20px_rgba(192,132,252,0.5)]',
      text: 'text-purple-300',
      textGlow: '0 0 8px rgba(192, 132, 252, 0.7)',
      bg: 'bg-purple-600',
      hoverBg: 'hover:bg-purple-700',
      radioBg: 'bg-purple-600 border-purple-300',
      radioShadow: 'shadow-[0_0_15px_rgba(192,132,252,0.6)]',
      titleGradientFrom: 'from-purple-400',
      titleGradientTo: 'to-pink-500',
      dotColor: 'rgba(192, 132, 252, 0.1)',
      neonColor: 'rgb(192, 132, 252)',
    }
  },
  [GameMode.GravityAbyss]: {
    classes: {
      border: 'border-indigo-400/20',
      borderSelected: 'border-cyan-400',
      ringSelected: 'ring-cyan-400/70',
      bgSelected: 'bg-indigo-900/30',
      shadowSelected: 'shadow-[0_0_20px_rgba(34,211,238,0.5)]',
      text: 'text-indigo-300',
      textGlow: '0 0 8px rgba(165, 180, 252, 0.7)',
      bg: 'bg-indigo-600',
      hoverBg: 'hover:bg-indigo-700',
      radioBg: 'bg-indigo-600 border-cyan-300',
      radioShadow: 'shadow-[0_0_15px_rgba(34,211,238,0.6)]',
      titleGradientFrom: 'from-indigo-400',
      titleGradientTo: 'to-cyan-500',
      dotColor: 'rgba(129, 140, 248, 0.1)',
      neonColor: 'rgb(34, 211, 238)',
    }
  },
  [GameMode.Vortex]: {
    classes: {
      border: 'border-red-400/20',
      borderSelected: 'border-orange-400',
      ringSelected: 'ring-orange-400/70',
      bgSelected: 'bg-red-900/30',
      shadowSelected: 'shadow-[0_0_20px_rgba(251,146,60,0.5)]',
      text: 'text-red-300',
      textGlow: '0 0 8px rgba(239, 68, 68, 0.7)',
      bg: 'bg-red-600',
      hoverBg: 'hover:bg-red-700',
      radioBg: 'bg-red-600 border-orange-300',
      radioShadow: 'shadow-[0_0_15px_rgba(251,146,60,0.6)]',
      titleGradientFrom: 'from-red-500',
      titleGradientTo: 'to-orange-500',
      dotColor: 'rgba(239, 68, 68, 0.1)',
      neonColor: 'rgb(251, 146, 60)',
    }
  },
} as const;


const App: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [battleLog, setBattleLog] = useState<BattleEvent[]>([]);
  const [gameState, setGameState] = useState<GameState>(GameState.AwaitingPlayers);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.Classic);
  const [winner, setWinner] = useState<Player | null>(null);
  const [top3, setTop3] = useState<Player[]>([]);
  const eliminationOrderRef = useRef<Player[]>([]);
  const [jsonInput, setJsonInput] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [isSpectatorMode, setIsSpectatorMode] = useState(false);
  const [followedPlayerId, setFollowedPlayerId] = useState<number | null>(null);
  const [recordNextBattle, setRecordNextBattle] = useState(false);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string>('');
  const [hoveredPlayer, setHoveredPlayer] = useState<Player | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [platform, setPlatform] = useState<Platform>('Instagram');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playerSizeMultiplier, setPlayerSizeMultiplier] = useState<number>(1.0);
  const [isReelMode, setIsReelMode] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  const animationFrameRef = useRef<number | null>(null);
  const lastBattleTickRef = useRef<number>(0);
  const lastStateUpdateRef = useRef<number>(0);
  const eventCounterRef = useRef<number>(0);
  const hitEffectCounterRef = useRef<number>(0);
  const floatingTextCounterRef = useRef<number>(0);
  const arenaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const playersRef = useRef<Player[]>([]);
  const vortexRadiusRef = useRef<number>(VORTEX_INITIAL_RADIUS);
  const abyssRotationRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hoveredPlayerRef = useRef<Player | null>(null);
  const gameSessionId = useRef(0);
  const preBattleRotationRef = useRef(0);
  const lastEliminatedPlayerRef = useRef<Player | null>(null);
  
  // Refs for new mechanics
  const attackLinesRef = useRef<AttackLine[]>([]);
  const attackLineCounterRef = useRef<number>(0);
  const meteorsRef = useRef<Meteor[]>([]);
  const meteorCounterRef = useRef<number>(0);
  const lastMeteorSpawnRef = useRef<number>(0);

  // Refs for large scale battles
  const totalPlayersRef = useRef<number>(0);

  const scaledConstants = useMemo(() => ({
    KNOCKBACK_FORCE: KNOCKBACK_FORCE,
    REPULSION_FORCE: REPULSION_FORCE,
    AOE_RADIUS: AOE_RADIUS,
    VORTEX_STRENGTH: VORTEX_STRENGTH,
    VORTEX_SPIRAL_FORCE: VORTEX_SPIRAL_FORCE,
    VORTEX_INITIAL_RADIUS: VORTEX_INITIAL_RADIUS,
    VORTEX_GROWTH_RATE: VORTEX_GROWTH_RATE,
    SPHERE_GRAVITY: SPHERE_GRAVITY,
    METEOR_RADIUS: METEOR_RADIUS,
    METEOR_KNOCKBACK: METEOR_KNOCKBACK,
  }), []);


  useEffect(() => {
     playersRef.current = players;
  }, [players]);

  useEffect(() => {
     const savedProfileName = localStorage.getItem('battleRoyaleProfileName');
    if (savedProfileName) {
      setProfileName(savedProfileName);
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      if (gameState === GameState.Running || gameState === GameState.Countdown) {
        audioRef.current.volume = 0.5;
        audioRef.current.play().catch(e => console.log("Audio play blocked:", e));
      } else if (gameState === GameState.Finished || gameState === GameState.Idle) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [gameState, currentTrackIndex]);
  

  const addLogEventsBatch = useCallback((events: {text: string, type: BattleEvent['type']}[]) => {
    if (events.length === 0) return;
    const newEvents = events.map(e => ({ id: eventCounterRef.current++, text: e.text, type: e.type }));
    setBattleLog(prev => [...prev, ...newEvents].slice(-100));
  }, []);

  const addLogEvent = useCallback((text: string, type: BattleEvent['type']) => {
    addLogEventsBatch([{ text, type }]);
  }, [addLogEventsBatch]);

  const toggleRecordNextBattle = () => {
    if (isRecordingActive) return; // Don't toggle while recording
    setRecordNextBattle(prev => !prev);
  };

  const downloadRecording = () => {
    if (!recordedVideoUrl) return;
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    a.download = `batalha-royale-${new Date().toISOString().split('T')[0]}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const initializePlayers = (parsedPlayers: { name: string; imageUrl: string }[]) => {
      if (parsedPlayers.length === 0) {
        alert("Nenhum jogador encontrado.");
        return;
      }
      totalPlayersRef.current = parsedPlayers.length;
      addLogEvent(`Carregados ${parsedPlayers.length} lutadores na arena! A batalha será épica!`, 'info');
      
      const arena = arenaRef.current;
      const arenaWidth = arena?.clientWidth ?? window.innerWidth;
      const arenaHeight = arena?.clientHeight ?? window.innerHeight;
      
      const logicalWidth = arenaWidth;
      const logicalHeight = arenaHeight;

      const initialPlayers = parsedPlayers.map((p, index) => ({
          ...p,
          id: index,
          hp: INITIAL_HP,
          maxHp: INITIAL_HP,
          isAlive: true,
          imageUrl: `https://corsproxy.io/?${encodeURIComponent(p.imageUrl)}`,
          x: logicalWidth / 2, // Posição temporária, será definida no início da batalha
          y: logicalHeight / 2, // Posição temporária, será definida no início da batalha
          vx: 0,
          vy: 0,
      }));
      setPlayers(initialPlayers);
      playersRef.current = initialPlayers;

      setIsControlPanelOpen(false);
  }

  const parseCsvData = (content: string): { name: string; imageUrl: string }[] | null => {
    try {
        const lines = content.split('\n').filter(line => line.trim() !== '');
        const parsedPlayers = lines.map(line => {
            const parts = line.split(',');
            if (parts.length >= 2) {
                const name = parts[0].trim();
                // Handle cases where URL might contain commas
                const imageUrl = parts.slice(1).join(',').trim(); 
                if (name && imageUrl) {
                    return { name, imageUrl };
                }
            } else if (parts.length === 1) {
                const name = parts[0].trim();
                if (name) {
                    return { name, imageUrl: `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(name)}` };
                }
            }
            return null;
        }).filter((p): p is { name: string; imageUrl: string } => p !== null);

        return parsedPlayers;
    } catch {
        return null;
    }
  };

  const processJsonData = (content: string, selectedPlatform: Platform) => {
    if (!content.trim()) {
      alert('Os dados estão vazios.');
      return;
    }

    // Heuristic for pasted CSV for Instagram
    const isLikelyCsv = content.includes(',') && !content.includes('{') && !content.includes('}');
    if (isLikelyCsv && selectedPlatform === 'Instagram') {
        addLogEvent('Detectado formato CSV para Instagram no texto colado. Processando...', 'info');
        const parsed = parseCsvData(content);
        if (parsed && parsed.length > 0) {
            initializePlayers(parsed);
            return;
        }
    }

    addLogEvent('Processando dados JSON...', 'info');
    setTimeout(() => {
        try {
            let data;
            try {
                data = JSON.parse(content);
            } catch (e) {
                const lines = content.split('\n').filter(line => line.trim() !== '');
                if (lines.length > 0) {
                    let successfullyParsed = 0;
                    const parsedData = lines.map(line => {
                        try {
                            const parsedLine = JSON.parse(line);
                            successfullyParsed++;
                            return parsedLine;
                        } catch (lineError) {
                            console.warn('Pulando linha JSON inválida:', line);
                            return null;
                        }
                    }).filter(item => item !== null);
                    
                    if (successfullyParsed === 0 && lines.length > 0) {
                        throw new Error("Nenhuma linha JSON válida foi encontrada no texto colado.");
                    }
                    
                    addLogEvent(`Processado ${successfullyParsed} de ${lines.length} linhas.`, 'info');
                    data = parsedData;
                } else {
                    throw e;
                }
            }
            
            let sourcePlayers: any[] = [];
            if (Array.isArray(data)) {
                sourcePlayers = data;
            } else if (typeof data === 'object' && data !== null) {
                // Heuristic to find the list of players if the JSON is a wrapper object
                const potentialPlayerArrays = Object.values(data).filter(Array.isArray);
                if (potentialPlayerArrays.length > 0) {
                    // Find the largest array, assuming it's the list of players
                    sourcePlayers = potentialPlayerArrays.reduce((a, b) => a.length > b.length ? a : b, []);
                    if (sourcePlayers.length > 0) {
                        addLogEvent(`Detectado um objeto JSON. Usando a lista de ${sourcePlayers.length} itens encontrada dentro dele.`, 'info');
                    }
                }
                
                if (sourcePlayers.length === 0) {
                    // If no array found or all were empty, treat the object as a single player
                    sourcePlayers = [data];
                }
            } else {
                alert('Estrutura JSON não suportada.');
                return;
            }

            const parsedPlayers = sourcePlayers.map(p => {
                if (typeof p === 'string' && p.trim() !== '') {
                    return { name: p.trim(), imageUrl: `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(p.trim())}` };
                }
                if (typeof p !== 'object' || p === null) return null;
                
                let name: string | undefined;
                let imageUrl: string | undefined;

                // Try to extract name from common fields
                name = p.name || p.username || p.full_name || p.nickname || p.uniqueId || p.login || p.id;
                
                // Try to extract image URL from common fields
                imageUrl = p.profile_pic_url || p.profile_pic_url_hd || p.profile_image_url || p.pfp_url || p.avatar_url || p.avatarThumb || p.image || p.picture;

                if (!imageUrl && name) {
                    imageUrl = `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(name)}`;
                }

                if (typeof name === 'string' && name.trim() !== '' && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
                   return { name: name.trim(), imageUrl: imageUrl.trim() };
                }
                
                return null;
            }).filter((p): p is { name: string; imageUrl: string } => p !== null);
            
            if (parsedPlayers.length === 0) {
                alert('Nenhum lutador com formato válido foi encontrado para a plataforma selecionada. Verifique o Guia de Formato de Dados.');
                return;
            }
            initializePlayers(parsedPlayers);

        } catch (error) {
            alert(`Falha ao analisar os dados. Verifique o formato e a plataforma selecionada. Erro: ${error instanceof Error ? error.message : String(error)}`);
            console.error(error);
        }
    }, 50);
  };
  
  const processFile = (file?: File) => {
    if (file) {
      addLogEvent(`Lendo o arquivo ${file.name}... Por favor, aguarde.`, 'info');
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (file.name.toLowerCase().endsWith('.csv') && platform === 'Instagram') {
            addLogEvent('Detectado arquivo CSV para Instagram. Processando...', 'info');
            const parsed = parseCsvData(content);
            if (parsed && parsed.length > 0) {
                initializePlayers(parsed);
            } else {
                alert('Falha ao processar o arquivo CSV. Verifique o formato: username,image_url');
            }
        } else {
            processJsonData(content, platform);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processFile(file);
    if (event.currentTarget) {
      event.currentTarget.value = '';
    }
  };

  const handleChooseFileClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  const generatePowersAndRun = () => {
    setGameState(GameState.GeneratingPowers);
    addLogEvent("Invocando poderes para os lutadores...", 'info');
    vortexRadiusRef.current = scaledConstants.VORTEX_INITIAL_RADIUS;
    abyssRotationRef.current = Math.random() * 2 * Math.PI; // Start at a random rotation
    
    const playerNames = playersRef.current.map(p => p.name);
    const powers = generatePowersForPlayers(playerNames);
    
    // Atribui poderes e reposiciona os jogadores
    let updatedPlayers = playersRef.current.map((p, i) => ({ ...p, power: powers[i] || 'Olhar Feroz' }));
    
    // Reposiciona os jogadores com base no modo de jogo
    const arena = arenaRef.current;
    if (arena) {
        const arenaWidth = arena.clientWidth;
        const arenaHeight = arena.clientHeight;
        const logicalWidth = arenaWidth;
        const logicalHeight = arenaHeight;
        const logicalCenterX = logicalWidth / 2;
        const logicalCenterY = logicalHeight / 2;
        
        updatedPlayers = updatedPlayers.map(p => {
            let newX, newY;
            if (gameMode === GameMode.GravityAbyss) {
                const sphereRadius = Math.min(logicalWidth, logicalHeight) * GRAVITY_ABYSS_RADIUS_FACTOR;
                // Surge em um ponto aleatório dentro da esfera, de preferência na metade superior
                const angle = (Math.random() * Math.PI) - (Math.PI / 2); // Top half
                const spawnRadius = Math.random() * sphereRadius * 0.9;
                newX = logicalCenterX + Math.cos(angle) * spawnRadius;
                newY = logicalCenterY + Math.sin(angle) * spawnRadius;
            } else {
                // Surgimento aleatório padrão
                const playerSize = (getPlayerSize(updatedPlayers.length) * playerSizeMultiplier);
                const radius = playerSize / 2;
                newX = radius + (Math.random() * (logicalWidth - playerSize));
                newY = radius + (Math.random() * (logicalHeight - playerSize));
            }
            return { ...p, x: newX, y: newY, vx: 0, vy: 0 };
        });
    }

    playersRef.current = updatedPlayers;
    setPlayers(updatedPlayers);


    setTimeout(() => {
        addLogEvent("A batalha começa!", 'info');
        setGameState(GameState.Running);
    }, 50);
  };

  const playBeep = (frequency: number, type: OscillatorType, duration: number) => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.error("AudioContext error:", e);
    }
  };

  const startBattle = () => {
    if (players.length < 2) {
      alert("Você precisa de pelo menos 2 jogadores para iniciar uma batalha!");
      return;
    }

    setIsControlPanelOpen(true);

    const startRecordingAndCountdown = async () => {
      const sessionId = gameSessionId.current;

      if (recordNextBattle) {
        try {
          // FIX: The `cursor` property is valid for getDisplayMedia but may be missing from older TypeScript DOM type definitions. Casting to `any` to prevent a type error.
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'never' } as any, // Hide cursor for cleaner recording
            audio: true,
          });
          
          const recorderOptions = {
            mimeType: 'video/webm',
            videoBitsPerSecond: 8000000, // 8 Mbps for high quality video
          };

          mediaRecorderRef.current = new MediaRecorder(stream, recorderOptions);
          recordedChunksRef.current = [];

          mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };

          mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            setRecordedVideoUrl(url);
            setIsRecordingActive(false);
            stream.getTracks().forEach(track => track.stop());
          };

          stream.getVideoTracks()[0].onended = () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            setIsRecordingActive(false);
            setRecordNextBattle(false);
            addLogEvent("Gravação interrompida pelo usuário.", 'info');
          };

          mediaRecorderRef.current.start();
          setIsRecordingActive(true);
          if (isReelMode) {
              addLogEvent("🔴 Gravação em modo Reel (9:16) iniciada! Compartilhe esta aba para melhor qualidade.", 'info');
          } else {
              addLogEvent("🔴 Gravação iniciada!", 'info');
          }

        } catch (err) {
          console.error("Erro ao iniciar a gravação:", err);
          addLogEvent("Falha ao iniciar a gravação. Permissão negada.", 'elimination');
          alert("A permissão para gravação de tela foi negada. A batalha não pode começar.");
          setRecordNextBattle(false);
          return;
        }
      }

      setIsControlPanelOpen(false);
      setGameState(GameState.Countdown);

      const timer = (ms: number) => new Promise(res => setTimeout(res, ms));

      for (let i = 3; i > 0; i--) {
        if (sessionId !== gameSessionId.current) return;
        setCountdown(i);
        playBeep(440, 'sine', 0.5);
        await timer(1000);
      }
      
      if (sessionId !== gameSessionId.current) return;
      setCountdown(0); // For "LUTE!"
      playBeep(880, 'sine', 1.0);
      await timer(1000);

      if (sessionId !== gameSessionId.current) return;
      setCountdown(null);
      generatePowersAndRun();
    };

    startRecordingAndCountdown();
  };


  const startSpectatorMode = () => {
    const demoPlayers = generateDemoPlayers(50000);
    initializePlayers(demoPlayers);
    setIsSpectatorMode(true);
    addLogEvent("Modo Espectador: 50.000 lutadores de demonstração carregados!", 'info');
  };
  
  const addHitEffect = (x: number, y: number, color: string, type: HitEffect['type'] = 'hit', size?: number) => {
    const newEffect: HitEffect = { id: hitEffectCounterRef.current++, x, y, color, type, size };
    setHitEffects(prev => [...prev, newEffect]);
    setTimeout(() => {
        setHitEffects(prev => prev.filter(effect => effect.id !== newEffect.id));
    }, 600);
  };

  const addFloatingText = useCallback((x: number, y: number, text: string, type: FloatingText['type']) => {
    const newText: FloatingText = { id: floatingTextCounterRef.current++, x, y, text, type };
    setFloatingTexts(prev => [...prev, newText]);
    setTimeout(() => {
        setFloatingTexts(prev => prev.filter(t => t.id !== newText.id));
    }, 1500);
  }, []);

  const triggerScreenShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 300);
  };

  const runBattleRound = useCallback((newLogEvents: {text: string, type: BattleEvent['type']}[]) => {
    let modifiablePlayers = playersRef.current;
    
    // Filter alive players ONCE per round
    const alivePlayers = modifiablePlayers.filter(p => p.isAlive);
    let currentAliveCount = alivePlayers.length;
    
    if (currentAliveCount <= 1) {
        return; // No one to attack
    }

    // Limit attacks per tick to avoid freezing, but scale with player count
    // When <= 100 players, force exactly 1 attack per tick to prevent visual spam and slow down the game
    const attacksPerTick = currentAliveCount <= 100 ? 1 : Math.min(5000, Math.floor(currentAliveCount * 0.02) + 1);

    for (let i = 0; i < attacksPerTick; i++) {
      if (currentAliveCount <= 1) break;

      const attackerIndex = Math.floor(Math.random() * alivePlayers.length);
      const attacker = alivePlayers[attackerIndex];
      
      if (!attacker.isAlive) continue; // Attacker might have died in this tick
      
      const isAoeAttack = Math.random() < AOE_CHANCE && currentAliveCount > 30;

      if (isAoeAttack) {
        let targets: Player[] = [];
        
        // Optimize AOE target selection for massive player counts
        if (currentAliveCount > 2000) {
            // Pick a random sample to check for distance, instead of checking all 50,000
            const sampleSize = 50;
            for (let j = 0; j < sampleSize; j++) {
                const randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
                if (randomTarget.isAlive && randomTarget.id !== attacker.id) {
                    const dx = randomTarget.x - attacker.x;
                    const dy = randomTarget.y - attacker.y;
                    if ((dx * dx + dy * dy) < (scaledConstants.AOE_RADIUS * scaledConstants.AOE_RADIUS)) {
                        targets.push(randomTarget);
                    }
                }
            }
        } else {
            targets = alivePlayers.filter(p => {
              if (!p.isAlive || p.id === attacker.id) return false;
              const dx = p.x - attacker.x;
              const dy = p.y - attacker.y;
              return (dx * dx + dy * dy) < (scaledConstants.AOE_RADIUS * scaledConstants.AOE_RADIUS);
            });
        }

        if (targets.length > 2) {
           // Limit max targets to prevent massive log spam and lag
           if (targets.length > 15) targets = targets.slice(0, 15);
           
           newLogEvents.push({text: `${attacker.name} usou ${attacker.power || 'um poder'} em área, atingindo ${targets.length} oponentes!`, type: 'aoe'});
           triggerScreenShake();
           if (currentAliveCount <= 200) {
               const playerSize = getPlayerSize(currentAliveCount) * playerSizeMultiplier;
               addHitEffect(attacker.x, attacker.y, getColorFromId(attacker.id), 'aoe-caster', playerSize * 1.5);
               addHitEffect(attacker.x, attacker.y, getColorFromId(attacker.id), 'aoe');
           }

           targets.forEach(target => {
              if (!target.isAlive) return;
              
              const damage = Math.floor(Math.random() * AOE_DAMAGE_RANDOM) + AOE_DAMAGE_BASE;
              if (currentAliveCount <= 200) addFloatingText(target.x, target.y, `-${damage}`, 'damage');
              
              const dx = target.x - attacker.x;
              const dy = target.y - attacker.y;
              const distance = Math.sqrt(dx*dx + dy*dy) || 1;
              const knockbackVx = (dx / distance) * scaledConstants.KNOCKBACK_FORCE * 0.5;
              const knockbackVy = (dy / distance) * scaledConstants.KNOCKBACK_FORCE * 0.5;

              const newHp = target.hp - damage;
              const isNowDead = newHp <= 0;

              if (isNowDead) {
                newLogEvents.push({text: `${target.name} foi eliminado por uma habilidade em área!`, type: 'elimination'});
                lastEliminatedPlayerRef.current = target;
                eliminationOrderRef.current.push(target);
                currentAliveCount--;
                if (target.id === followedPlayerId) {
                  setFollowedPlayerId(null);
                }
              }
              
              target.hp = Math.max(0, newHp);
              target.isAlive = !isNowDead;
              target.dying = isNowDead ? DEATH_ANIMATION_FRAMES : target.dying;
              target.vx += knockbackVx;
              target.vy += knockbackVy;
           });
           continue;
        }
      }
      
      let targetIndex = Math.floor(Math.random() * alivePlayers.length);
      let target = alivePlayers[targetIndex];
      let attempts = 0;
      
      // Find a valid alive target
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
        if (currentAliveCount <= 200) addFloatingText(target.x, target.y, 'Errou!', 'miss');
      } else if (roll < 0.15) {
        damage = Math.floor(Math.random() * 15) + 25;
        attackLog = `${attacker.name} acerta um GOLPE CRÍTICO com ${attacker.power || 'um ataque'} em ${target.name}!`;
        if (currentAliveCount <= 200) addFloatingText(target.x, target.y, `-${damage}`, 'crit');
        triggerScreenShake();
      } else {
        damage = Math.floor(Math.random() * 15) + 5;
        attackLog = `${attacker.name} usa ${attacker.power || 'um ataque'} em ${target.name}!`;
        if (currentAliveCount <= 200) addFloatingText(target.x, target.y, `-${damage}`, 'damage');
      }
      
      // Only log regular attacks if there are few players, otherwise log spam causes lag
      if (currentAliveCount < 50 || roll < 0.15) {
          newLogEvents.push({text: attackLog, type: 'attack'});
      }
      
      if (damage > 0 && currentAliveCount <= 200) {
        addHitEffect(target.x, target.y, getColorFromId(target.id), 'hit');
      }

      if (currentAliveCount <= ATTACK_TRACER_THRESHOLD) {
          attackLinesRef.current.push({
              id: attackLineCounterRef.current++,
              startX: attacker.x,
              startY: attacker.y,
              endX: target.x,
              endY: target.y,
              life: ATTACK_TRACER_LIFESPAN,
              color: getColorFromId(attacker.id),
          });
      }
     
      const dx = target.x - attacker.x;
      const dy = target.y - attacker.y;
      const distance = Math.sqrt(dx*dx + dy*dy) || 1;
      const knockbackVx = (dx / distance) * scaledConstants.KNOCKBACK_FORCE;
      const knockbackVy = (dy / distance) * scaledConstants.KNOCKBACK_FORCE;

      const newHp = target.hp - damage;
      const isNowDead = newHp <= 0;
      if (isNowDead) {
          newLogEvents.push({text: `${target.name} foi eliminado!`, type: 'elimination'});
          lastEliminatedPlayerRef.current = target;
          eliminationOrderRef.current.push(target);
          currentAliveCount--;
          triggerScreenShake();
          if (target.id === followedPlayerId) {
            setFollowedPlayerId(null);
          }
      }
      target.hp = Math.max(0, newHp);
      target.isAlive = !isNowDead;
      target.dying = isNowDead ? DEATH_ANIMATION_FRAMES : target.dying;
      target.vx += knockbackVx;
      target.vy += knockbackVy;
    }
    
    playersRef.current = modifiablePlayers;
  }, [addLogEvent, addFloatingText, followedPlayerId, gameMode, scaledConstants, playerSizeMultiplier]);

  // Combined Physics, Battle, and Drawing Loop
  useEffect(() => {
    let isLooping = gameState !== GameState.AwaitingPlayers || players.length > 0;

    const gameLoop = (timestamp: number) => {
        if (!isLooping) return;

        animationFrameRef.current = requestAnimationFrame(gameLoop);

        const currentPlayers = playersRef.current;
        const arena = arenaRef.current;
        const canvas = canvasRef.current;
        if (!arena || !canvas) return;

        let alivePlayers = currentPlayers.filter(p => p.isAlive);
        const aliveInArenaCount = alivePlayers.length;
        const totalAliveCount = aliveInArenaCount;

        const arenaWidth = arena.clientWidth;
        const arenaHeight = arena.clientHeight;
        const centerX = arenaWidth / 2;
        const centerY = arenaHeight / 2;
        
        const logicalWidth = arenaWidth;
        const logicalHeight = arenaHeight;
        const logicalCenterX = logicalWidth / 2;
        const logicalCenterY = logicalHeight / 2;

        const newLogEvents: {text: string, type: BattleEvent['type']}[] = [];

        // --- Battle Logic Update ---
        if (gameState === GameState.Running) {
          // Dynamic battle interval based on total players alive
          const NORMAL_SPEED_THRESHOLD = 100;
          const MAX_SPEED_THRESHOLD = 10000;
          let battleInterval;

          if (totalAliveCount <= NORMAL_SPEED_THRESHOLD) {
              battleInterval = NORMAL_BATTLE_INTERVAL_MS;
          } else if (totalAliveCount >= MAX_SPEED_THRESHOLD) {
              battleInterval = MAX_SPEED_BATTLE_INTERVAL_MS;
          } else {
              // Interpolate logarithmically for smoother speed change
              const logNormal = Math.log(NORMAL_SPEED_THRESHOLD);
              const logMax = Math.log(MAX_SPEED_THRESHOLD);
              const logCurrent = Math.log(totalAliveCount);
              const progress = (logCurrent - logNormal) / (logMax - logNormal);
              battleInterval = Math.max(MAX_SPEED_BATTLE_INTERVAL_MS, NORMAL_BATTLE_INTERVAL_MS - progress * (NORMAL_BATTLE_INTERVAL_MS - MAX_SPEED_BATTLE_INTERVAL_MS));
          }

          if (timestamp - lastBattleTickRef.current > battleInterval) {
            runBattleRound(newLogEvents);
            lastBattleTickRef.current = timestamp;
          }
        }

        // --- New Mechanics: Meteor Shower ---
        if (gameState === GameState.Running && alivePlayers.length > METEOR_SHOWER_THRESHOLD) {
            if (timestamp - lastMeteorSpawnRef.current > METEOR_SPAWN_INTERVAL) {
                meteorsRef.current.push({
                    id: meteorCounterRef.current++,
                    x: Math.random() * logicalWidth,
                    y: Math.random() * logicalHeight,
                    radius: scaledConstants.METEOR_RADIUS,
                    impactTimer: METEOR_IMPACT_TIMER,
                    totalTime: METEOR_IMPACT_TIMER,
                });
                lastMeteorSpawnRef.current = timestamp;
            }
        }
        
        // Update meteor timers and handle impacts
        meteorsRef.current.forEach((meteor) => {
            meteor.impactTimer--;
            if (meteor.impactTimer <= 0) {
                // Impact!
                newLogEvents.push({text: `Um meteoro caiu, causando destruição em massa!`, type: 'aoe'});
                triggerScreenShake();
                if (aliveInArenaCount <= 200) {
                    addHitEffect(meteor.x, meteor.y, '#ff4500', 'meteor');
                }
                
                alivePlayers.forEach(p => {
                    const dx = p.x - meteor.x;
                    const dy = p.y - meteor.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < meteor.radius * meteor.radius) {
                        const damage = METEOR_DAMAGE_BASE + Math.floor(Math.random() * METEOR_DAMAGE_RANDOM);
                        if (aliveInArenaCount <= 200) addFloatingText(p.x, p.y, `-${damage}`, 'crit');
                        
                        const distance = Math.sqrt(distSq) || 1;
                        p.vx += (dx / distance) * scaledConstants.METEOR_KNOCKBACK;
                        p.vy += (dy / distance) * scaledConstants.METEOR_KNOCKBACK;

                        const newHp = p.hp - damage;
                        if (newHp <= 0 && p.isAlive) {
                           newLogEvents.push({text: `${p.name} foi pulverizado por um meteoro!`, type: 'elimination'});
                           p.isAlive = false;
                           p.dying = DEATH_ANIMATION_FRAMES;
                           lastEliminatedPlayerRef.current = p;
                           eliminationOrderRef.current.push(p);
                        }
                        p.hp = Math.max(0, newHp);
                    }
                });
            }
        });
        meteorsRef.current = meteorsRef.current.filter(m => m.impactTimer > 0);

        // Update attack tracer lifespans
        attackLinesRef.current.forEach(line => line.life--);
        attackLinesRef.current = attackLinesRef.current.filter(l => l.life > 0);

        // --- State-based Physics & Positioning ---
        if (gameState === GameState.AwaitingPlayers && currentPlayers.length > 0) {
            preBattleRotationRef.current += 0.001;
            const formationRadius = Math.min(logicalWidth, logicalHeight) * 0.25;
            const angleStep = (2 * Math.PI) / currentPlayers.length;
            
            currentPlayers.forEach((p, i) => {
                const angle = i * angleStep + preBattleRotationRef.current;
                p.x = logicalCenterX + Math.cos(angle) * formationRadius;
                p.y = logicalCenterY + Math.sin(angle) * formationRadius;
            });

        } else if (gameState === GameState.Running) {
            const playerSize = getPlayerSize(alivePlayers.length || currentPlayers.length) * playerSizeMultiplier;
            const radius = playerSize / 2;
            const minDistance = playerSize;
            const optimizePhysics = alivePlayers.length > PHYSICS_OPTIMIZATION_THRESHOLD;
            
            if (gameMode === GameMode.Vortex) {
                vortexRadiusRef.current += scaledConstants.VORTEX_GROWTH_RATE;
            }
            if (gameMode === GameMode.GravityAbyss) {
                abyssRotationRef.current += GRAVITY_ABYSS_ROTATION_SPEED;
            }

            const nextPlayers: Player[] = [];
            for (let i = 0; i < currentPlayers.length; i++) {
                const p1 = currentPlayers[i];
                if (p1.dying && p1.dying > 0) p1.dying--;
                if (!p1.isAlive && (!p1.dying || p1.dying <= 0)) continue;
                
                nextPlayers.push(p1);

                let newVx = p1.vx;
                let newVy = p1.vy;
                
                if (p1.isAlive) {
                  switch (gameMode) {
                    case GameMode.GravityAbyss:
                      newVy += scaledConstants.SPHERE_GRAVITY;
                      break;
                    case GameMode.Vortex:
                      const dxVortex = logicalCenterX - p1.x;
                      const dyVortex = logicalCenterY - p1.y;
                      const distVortex = Math.sqrt(dxVortex * dxVortex + dyVortex * dyVortex) || 1;
                      const pullForce = scaledConstants.VORTEX_STRENGTH / (distVortex * distVortex);
                      const spiralForce = scaledConstants.VORTEX_SPIRAL_FORCE / distVortex;
                      newVx += (dxVortex / distVortex) * pullForce;
                      newVy += (dyVortex / distVortex) * pullForce;
                      newVx += (-dyVortex / distVortex) * spiralForce;
                      newVy += (dxVortex / distVortex) * spiralForce;
                      break;
                  }
                  
                  // Disable expensive repulsion physics for large numbers of players
                  if (!optimizePhysics) {
                      const playersToCheck = alivePlayers;

                      playersToCheck.forEach(p2 => {
                          if (!p2 || p1.id === p2.id) return;
                          const dx = p1.x - p2.x;
                          const dy = p1.y - p2.y;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          if (distance < minDistance && distance > 0) {
                              const force = scaledConstants.REPULSION_FORCE * (1 - distance / minDistance);
                              const angle = Math.atan2(dy, dx);
                              newVx += Math.cos(angle) * force;
                              newVy += Math.sin(angle) * force;
                          }
                      });
                  }
                }

                newVx *= DAMPING;
                newVy *= DAMPING;
                let newX = p1.x + newVx;
                let newY = p1.y + newVy;
                
                if (p1.isAlive) {
                  switch (gameMode) {
                    case GameMode.Vortex:
                      const distFromVortex = Math.sqrt(Math.pow(newX - logicalCenterX, 2) + Math.pow(newY - logicalCenterY, 2));
                      if (distFromVortex < vortexRadiusRef.current) {
                          newLogEvents.push({text: `${p1.name} foi consumido pelo vórtice!`, type: 'elimination'});
                          p1.isAlive = false;
                          p1.dying = DEATH_ANIMATION_FRAMES;
                          lastEliminatedPlayerRef.current = p1;
                          eliminationOrderRef.current.push(p1);
                          triggerScreenShake();
                      }
                      break;
                  }
                }

                if (gameMode === GameMode.Classic || gameMode === GameMode.Vortex) {
                  if (newX < radius) { newX = radius; newVx *= -0.5; }
                  if (newX > logicalWidth - radius) { newX = logicalWidth - radius; newVx *= -0.5; }
                  if (newY < radius) { newY = radius; newVy *= -0.5; }
                  if (newY > logicalHeight - radius) { newY = logicalHeight - radius; newVy *= -0.5; }
                } else if (gameMode === GameMode.GravityAbyss) {
                    const sphereRadius = Math.min(logicalWidth, logicalHeight) * GRAVITY_ABYSS_RADIUS_FACTOR;
                    const dxCenter = newX - logicalCenterX;
                    const dyCenter = newY - logicalCenterY;
                    const distFromCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
                    
                    if (distFromCenter > sphereRadius - radius) {
                        const holeSizeRad = (GRAVITY_ABYSS_HOLE_SIZE_DEGREES * Math.PI) / 180;
                        const holeStartRad = abyssRotationRef.current - holeSizeRad / 2;
                        const holeEndRad = abyssRotationRef.current + holeSizeRad / 2;
                        const playerAngleRad = Math.atan2(dyCenter, dxCenter);
                        const normalizeAngle = (angle: number) => (angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
                        const normalizedPlayerAngle = normalizeAngle(playerAngleRad);
                        const normalizedHoleStart = normalizeAngle(holeStartRad);
                        const normalizedHoleEnd = normalizeAngle(holeEndRad);
                        let isInsideHole = false;
                        if (normalizedHoleStart < normalizedHoleEnd) {
                            isInsideHole = normalizedPlayerAngle >= normalizedHoleStart && normalizedPlayerAngle <= normalizedHoleEnd;
                        } else {
                            isInsideHole = normalizedPlayerAngle >= normalizedHoleStart || normalizedPlayerAngle <= normalizedHoleEnd;
                        }
                        if (isInsideHole) {
                            if (p1.isAlive) {
                                newLogEvents.push({text: `${p1.name} caiu no abismo!`, type: 'elimination'});
                                p1.isAlive = false;
                                p1.dying = DEATH_ANIMATION_FRAMES;
                                lastEliminatedPlayerRef.current = p1;
                                eliminationOrderRef.current.push(p1);
                            }
                        } else {
                            const overlap = distFromCenter - (sphereRadius - radius);
                            newX -= (dxCenter / distFromCenter) * overlap;
                            newY -= (dyCenter / distFromCenter) * overlap;
                            const normalX = dxCenter / distFromCenter;
                            const normalY = dyCenter / distFromCenter;
                            const dotProduct = newVx * normalX + newVy * normalY;
                            newVx -= 2 * dotProduct * normalX * 0.5;
                            newVy -= 2 * dotProduct * normalY * 0.5;
                        }
                    }
                }
                p1.x = newX;
                p1.y = newY;
                p1.vx = newVx;
                p1.vy = newVy;
            }
            playersRef.current = nextPlayers;
        } else {
             const nextPlayers: Player[] = [];
             for (let i = 0; i < currentPlayers.length; i++) {
                 const p = currentPlayers[i];
                 if (p.dying && p.dying > 0) p.dying--;
                 if (p.isAlive || (p.dying && p.dying > 0)) {
                     nextPlayers.push(p);
                 }
             }
             playersRef.current = nextPlayers;
        }

        if (newLogEvents.length > 0) {
            addLogEventsBatch(newLogEvents);
        }
        
        // --- End Game Check ---
        const finalAlivePlayers = playersRef.current.filter(p => p.isAlive);
        if (gameState === GameState.Running && finalAlivePlayers.length <= 1) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
                addLogEvent("⏹️ Gravação finalizada. Salve o vídeo na tela de resultados.", 'info');
            }
            
            let winnerCandidate: Player | null = finalAlivePlayers[0] || null;

            if (!winnerCandidate && playersRef.current.length > 0) {
                // Tie-breaker logic: if no one is alive, find the player who was eliminated most recently.
                // This is determined by finding the player with the highest "dying" frame count.
                const allDeadPlayers = [...playersRef.current].filter(p => !p.isAlive && p.dying !== undefined);
                if (allDeadPlayers.length > 0) {
                    winnerCandidate = allDeadPlayers.reduce((last, current) => {
                        return (current.dying! >= last.dying!) ? current : last;
                    });
                } else {
                    // Absolute fallback if the above fails for any reason
                    winnerCandidate = lastEliminatedPlayerRef.current;
                }
            }

            if (winnerCandidate) {
                setFollowedPlayerId(winnerCandidate.id);
            }
            
            setPlayers([...playersRef.current]);
            setGameState(GameState.Finished);

            // Determine Top 3
            const currentEliminationOrder = eliminationOrderRef.current;
            let finalTop3: Player[] = [];
            
            if (winnerCandidate) {
                finalTop3.push(winnerCandidate);
            }
            
            // Add 2nd and 3rd place from the end of the elimination order
            for (let i = currentEliminationOrder.length - 1; i >= 0 && finalTop3.length < 3; i--) {
                const p = currentEliminationOrder[i];
                if (!finalTop3.find(t => t.id === p.id)) {
                    finalTop3.push(p);
                }
            }

            setTimeout(() => {
                setWinner(winnerCandidate);
                setTop3(finalTop3);
                if (winnerCandidate) {
                    addLogEvent(`${winnerCandidate.name} é o último a resistir! VITÓRIA!`, 'winner');
                } else {
                    addLogEvent('A batalha foi tão intensa que terminou em um clímax espetacular!', 'winner');
                }
            }, 2500);
            return; 
        }

        // --- Drawing Update ---
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        if(canvas.width !== arenaWidth || canvas.height !== arenaHeight) {
            canvas.width = arenaWidth;
            canvas.height = arenaHeight;
        }
        
        // Background
        const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(arenaWidth, arenaHeight));
        bgGradient.addColorStop(0, '#0f071e');
        bgGradient.addColorStop(1, '#000411');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const invMultiplier = 1;
        const playersToDraw = playersRef.current;
        const alivePlayerCount = alivePlayers.length || playersRef.current.length;
        const currentScreenSize = getPlayerSize(alivePlayerCount) * playerSizeMultiplier;
        const isPixelMode = currentScreenSize <= PIXEL_MODE_THRESHOLD;

        // Mode-specific arena drawing
        switch(gameMode) {
            case GameMode.GravityAbyss: {
                const sphereRadius = Math.min(arenaWidth, arenaHeight) * GRAVITY_ABYSS_RADIUS_FACTOR;
                
                // Draw the sphere/bowl background
                ctx.save();
                ctx.translate(centerX, centerY);
                const sphereGradient = ctx.createRadialGradient(0, 0, sphereRadius * 0.8, 0, 0, sphereRadius);
                sphereGradient.addColorStop(0, '#1c133a');
                sphereGradient.addColorStop(1, '#0f071e');
                ctx.fillStyle = sphereGradient;
                ctx.beginPath();
                ctx.arc(0, 0, sphereRadius, 0, 2 * Math.PI);
                ctx.fill();

                // Draw a rotating pattern to show movement
                ctx.rotate(abyssRotationRef.current);
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(165, 180, 252, 0.1)';
                ctx.lineWidth = 2;
                for (let i = 0; i < 12; i++) {
                    const angle = i * (Math.PI / 6);
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(angle) * sphereRadius, Math.sin(angle) * sphereRadius);
                }
                ctx.stroke();
                ctx.restore(); // Restores from translate and rotate

                // Draw the abyss WALL (an arc with a gap)
                const holeSizeRad = (GRAVITY_ABYSS_HOLE_SIZE_DEGREES * Math.PI) / 180;
                const holeStartRad = abyssRotationRef.current - holeSizeRad / 2;
                const holeEndRad = abyssRotationRef.current + holeSizeRad / 2;

                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, sphereRadius, holeEndRad, holeStartRad); // Arc from end to start
                
                const wallGradient = ctx.createRadialGradient(centerX, centerY, sphereRadius - 10, centerX, centerY, sphereRadius);
                wallGradient.addColorStop(0, 'rgba(34, 211, 238, 0)');
                wallGradient.addColorStop(1, 'rgba(34, 211, 238, 0.8)');
                ctx.strokeStyle = wallGradient;
                ctx.lineWidth = 4;
                ctx.shadowColor = '#22d3ee';
                ctx.shadowBlur = 20;
                ctx.stroke();
                ctx.restore();
                break;
            }
            case GameMode.Vortex:
                ctx.save();
                const screenVortexRadius = vortexRadiusRef.current * invMultiplier;
                const pulse = Math.sin(Date.now() / 200) * 10 + screenVortexRadius;
                const vortexGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulse);
                vortexGradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
                vortexGradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.4)'); // red-500
                vortexGradient.addColorStop(0.8, 'rgba(251, 146, 60, 0.1)'); // orange-400
                vortexGradient.addColorStop(1, 'rgba(50, 0, 0, 0)');
                ctx.fillStyle = vortexGradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, pulse, 0, 2 * Math.PI);
                ctx.fill();

                const rings = 3;
                for (let i = 1; i <= rings; i++) {
                    ctx.beginPath();
                    const ringRadius = (screenVortexRadius / rings) * i;
                    const rotation = (Date.now() / (1000 + i * 500)) * (rings - i + 1);
                    ctx.setLineDash([10, 20]);
                    ctx.arc(centerX, centerY, ringRadius, rotation, rotation + Math.PI * 1.5);
                    ctx.strokeStyle = `rgba(255, 150, 150, ${0.5 - i * 0.1})`;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
                ctx.setLineDash([]);
                ctx.restore();
                break;
        }

        // Draw meteor warnings (under players) - REMOVED VISUALLY TO REDUCE LAG
        // The logic still runs in the background, but we don't draw the circles.

        // --- Player Drawing ---
        if (isPixelMode) {
             // Highly optimized drawing mode for massive numbers
            const size = Math.max(1, Math.floor(currentScreenSize));
            const halfSize = size / 2;
            
            for (const player of playersToDraw) {
                const screenX = player.x * invMultiplier;
                const screenY = player.y * invMultiplier;

                let alpha = 1;
                if (player.dying && player.dying > 0) {
                    alpha = player.dying / DEATH_ANIMATION_FRAMES;
                }
                
                if (alpha < 1) {
                    ctx.globalAlpha = alpha;
                }
                
                ctx.fillStyle = getColorFromId(player.id);
                ctx.fillRect(screenX - halfSize, screenY - halfSize, size, size);
                
                if (alpha < 1) {
                    ctx.globalAlpha = 1;
                }
            }
        } else {
             // Detailed avatar drawing for smaller numbers
            const hoveredPlayerId = hoveredPlayerRef.current ? hoveredPlayerRef.current.id : null;
            const sortedPlayers = [...playersToDraw].sort((a, b) => {
                if (a.id === hoveredPlayerId) return 1;
                if (b.id === hoveredPlayerId) return -1;
                return a.y - b.y; // Draw players at the bottom on top
            });

            // Pre-load images if needed
            sortedPlayers.forEach(player => {
                if (!imageCache.current[player.imageUrl]) {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = player.imageUrl;
                    
                    let retryCount = 0;
                    img.onerror = () => {
                        if (retryCount === 0) {
                            retryCount++;
                            // Try with a proxy
                            img.src = `https://api.allorigins.win/raw?url=${encodeURIComponent(player.imageUrl)}`;
                        } else if (retryCount === 1) {
                            retryCount++;
                            // Try another proxy
                            img.src = `https://corsproxy.io/?url=${encodeURIComponent(player.imageUrl)}`;
                        } else if (retryCount === 2) {
                            retryCount++;
                            // Fallback to DiceBear
                            img.src = `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(player.name)}`;
                        }
                    };
                    imageCache.current[player.imageUrl] = img;
                }
            });

            for (const player of sortedPlayers) {
                const glowColor = getColorFromId(player.id);
                const isFollowed = player.id === followedPlayerId;
                const isHovered = player.id === hoveredPlayerId;

                ctx.save();

                if (player.dying && player.dying > 0) {
                  ctx.globalAlpha = player.dying / DEATH_ANIMATION_FRAMES;
                }

                if (isHovered) {
                  ctx.shadowColor = '#ffffff';
                  ctx.shadowBlur = 30;
                } else if (isFollowed) {
                  const pulse = Math.sin(Date.now() / 150) * 8 + 16;
                  ctx.shadowColor = '#facc15';
                  ctx.shadowBlur = pulse;
                } else {
                  ctx.shadowColor = glowColor;
                  ctx.shadowBlur = 8;
                }
                
                const halfScreenSize = currentScreenSize / 2;
                const screenX = player.x * invMultiplier;
                const screenY = player.y * invMultiplier;
                const drawX = screenX - halfScreenSize;
                const drawY = screenY - halfScreenSize;

                ctx.beginPath();
                ctx.arc(screenX, screenY, halfScreenSize, 0, Math.PI * 2);
                if (isFollowed) {
                  const pulseOpacity = Math.sin(Date.now() / 150) * 0.4 + 0.6;
                  ctx.strokeStyle = `rgba(250, 204, 21, ${pulseOpacity})`;
                  ctx.lineWidth = 4;
                  ctx.stroke();
                }
                ctx.fillStyle = '#2d3748';
                ctx.fill();
                ctx.closePath();
                const img = imageCache.current[player.imageUrl];
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.save();
                    ctx.clip();
                    ctx.drawImage(img, drawX, drawY, currentScreenSize, currentScreenSize);
                    ctx.restore();
                }

                if (player.isAlive) {
                    const hpY = drawY + currentScreenSize + 5;
                    const hpPercentage = player.hp / player.maxHp;
                    ctx.fillStyle = 'rgba(55, 65, 81, 0.5)';
                    ctx.fillRect(drawX, hpY, currentScreenSize, 4);
                    ctx.fillStyle = '#4ade80';
                    ctx.fillRect(drawX, hpY, currentScreenSize * hpPercentage, 4);
                }

                if (player.isAlive && alivePlayerCount < 200) {
                    const hpY = drawY + currentScreenSize + 5;
                    const hpBarHeight = 4;
                    const fontSize = Math.max(9, currentScreenSize * 0.25);
                    const nameY = hpY + hpBarHeight + fontSize;
                    ctx.save();
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.textAlign = 'center';
                    ctx.font = `bold ${fontSize}px Inter`;
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                    ctx.shadowBlur = 3;
                    ctx.fillText(player.name, screenX, nameY, currentScreenSize * 1.5);
                    ctx.restore();
                }
                ctx.restore();
            }
        }
        
        // Draw Attack Tracers (on top of players)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 3;
        attackLinesRef.current.forEach(line => {
            const lifePercentage = line.life / ATTACK_TRACER_LIFESPAN;
            ctx.beginPath();
            ctx.moveTo(line.startX * invMultiplier, line.startY * invMultiplier);
            ctx.lineTo(line.endX * invMultiplier, line.endY * invMultiplier);
            ctx.strokeStyle = line.color;
            ctx.globalAlpha = lifePercentage; // Fade out
            ctx.shadowColor = line.color;
            ctx.shadowBlur = 10;
            ctx.stroke();
        });
        ctx.restore();

        // --- React State Update (throttled) ---
        if (gameState === GameState.Running && timestamp - lastStateUpdateRef.current > UI_UPDATE_INTERVAL) {
            setPlayers([...playersRef.current]);
            lastStateUpdateRef.current = timestamp;
        }
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
        isLooping = false;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    };
  }, [gameState, followedPlayerId, runBattleRound, gameMode, players.length, addLogEvent, addFloatingText, playerSizeMultiplier, scaledConstants]);
  
  const resetGame = () => {
    gameSessionId.current += 1; // Invalidate any running countdowns
    if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    setRecordNextBattle(false);
    setIsRecordingActive(false);
    if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
    }
    setRecordedVideoUrl(null);
    setPlayers([]);
    setBattleLog([]);
    setWinner(null);
    setTop3([]);
    eliminationOrderRef.current = [];
    setGameState(GameState.AwaitingPlayers);
    setJsonInput('');
    setIsSpectatorMode(false);
    setFollowedPlayerId(null);
    setHoveredPlayer(null);
    setCountdown(null);
    eventCounterRef.current = 0;
    imageCache.current = {};
    setIsControlPanelOpen(false);
    lastEliminatedPlayerRef.current = null;
    // Reset new mechanics refs
    attackLinesRef.current = [];
    meteorsRef.current = [];
    totalPlayersRef.current = 0;
  };

  const playAgain = () => {
    gameSessionId.current += 1;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const allPlayers = playersRef.current.map(p => ({
      ...p,
      hp: INITIAL_HP,
      maxHp: INITIAL_HP,
      isAlive: true,
      x: 0, y: 0, vx: 0, vy: 0,
      dying: undefined,
    })).sort((a,b) => a.id - b.id);
    
    setPlayers(allPlayers);
    playersRef.current = allPlayers;
    
    setBattleLog([ { id: eventCounterRef.current++, text: `Revanche! ${totalPlayersRef.current} lutadores retornam à arena!`, type: 'info' } ]);
    setWinner(null);
    setTop3([]);
    eliminationOrderRef.current = [];
    setGameState(GameState.AwaitingPlayers);
    setFloatingTexts([]);
    setHitEffects([]);
    attackLinesRef.current = [];
    meteorsRef.current = [];
    setFollowedPlayerId(null);
    lastEliminatedPlayerRef.current = null;
    setCountdown(null);
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
    }
    setRecordedVideoUrl(null);
  };

  const handleUnfollow = () => {
    setFollowedPlayerId(null);
  };
  
  const followedPlayer = useMemo(() => players.find(p => p.id === followedPlayerId), [players, followedPlayerId]);
  
  const getTransformedMouseCoords = (event: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const transform = new DOMMatrix(getComputedStyle(canvas.parentElement!).transform);

    const canvasX = (event.clientX - rect.left - transform.e) / transform.a;
    const canvasY = (event.clientY - rect.top - transform.f) / transform.d;

    return { x: canvasX, y: canvasY };
  };
  
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isControlPanelOpen) {
      setIsControlPanelOpen(false);
      return;
    }
    const coords = getTransformedMouseCoords(event);
    if (!coords) return;
    
    const logicalX = coords.x;
    const logicalY = coords.y;

    const alivePlayers = players.filter(p => p.isAlive);
    const playerScreenSize = getPlayerSize(alivePlayers.length) * playerSizeMultiplier;
    const playerLogicalSize = playerScreenSize;

    let clickedPlayer = null;
    // Iterate backwards to prioritize players drawn on top
    for (let i = alivePlayers.length - 1; i >= 0; i--) {
        const player = alivePlayers[i];
        const halfSize = playerLogicalSize / 2;
        const dx = logicalX - player.x;
        const dy = logicalY - player.y;

        if (dx * dx + dy * dy <= halfSize * halfSize) {
            clickedPlayer = player;
            break;
        }
    }

    if (clickedPlayer) {
        setFollowedPlayerId(clickedPlayer.id);
    } else {
        handleUnfollow();
    }
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getTransformedMouseCoords(event);
    if (!coords) {
        setHoveredPlayer(null);
        return;
    }
    
    const logicalX = coords.x;
    const logicalY = coords.y;

    setTooltipPosition({ x: event.clientX, y: event.clientY });

    const alivePlayers = players.filter(p => p.isAlive);
    const playerScreenSize = getPlayerSize(alivePlayers.length) * playerSizeMultiplier;
    const isPixelMode = playerScreenSize <= PIXEL_MODE_THRESHOLD;
    if (isPixelMode) {
      hoveredPlayerRef.current = null;
      setHoveredPlayer(null);
      return;
    }
    
    const playerLogicalSize = playerScreenSize;
    const halfSize = playerLogicalSize / 2;

    let foundPlayer: Player | null = null;
    for (let i = alivePlayers.length - 1; i >= 0; i--) {
        const player = alivePlayers[i];
        const dx = logicalX - player.x;
        const dy = logicalY - player.y;

        if (dx * dx + dy * dy <= halfSize * halfSize) {
            foundPlayer = player;
            break;
        }
    }
    hoveredPlayerRef.current = foundPlayer;
    setHoveredPlayer(foundPlayer);
  };

  const handleCanvasMouseLeave = () => {
    hoveredPlayerRef.current = null;
    setHoveredPlayer(null);
  };

  const getArenaTransform = () => {
      const transition = 'transform 1.5s ease-in-out';
      const playerToFollow = followedPlayer || winner;

      if (playerToFollow && arenaRef.current) {
          let zoom = 1.7;
          if (winner) zoom = 2.5;
          
          const arena = arenaRef.current;
          const targetX = arena.clientWidth / 2;
          const targetY = arena.clientHeight / 2;
          
          const playerScreenX = playerToFollow.x;
          const playerScreenY = playerToFollow.y;

          const translateX = targetX - playerScreenX * zoom;
          const translateY = targetY - playerScreenY * zoom;

          return { 
            transform: `scale(${zoom}) translate(${translateX}px, ${translateY}px)`,
            transition
          };
      }
      
      // Default, non-zoomed view
      return { 
        transform: 'scale(1) translate(0px, 0px)',
        transition: 'transform 1.5s ease-in-out' // Keep smooth transition when unfollowing
      };
  }
  
  const getEffectClass = (type: HitEffect['type']) => {
    switch(type) {
      case 'aoe': return 'aoe-effect';
      case 'aoe-caster': return 'aoe-caster-effect';
      case 'meteor': return 'meteor-effect';
      default: return 'hit-effect';
    }
  };

  const getEffectStyle = (effect: HitEffect): React.CSSProperties => {
    const invMultiplier = 1;
    const style: React.CSSProperties = {
        left: effect.x * invMultiplier,
        top: effect.y * invMultiplier,
        color: effect.color,
        transform: `translate(-50%, -50%)`,
    };
    if (effect.type === 'aoe') {
        style.width = `${AOE_RADIUS * 2}px`;
        style.height = `${AOE_RADIUS * 2}px`;
    } else if (effect.type === 'meteor') {
        style.width = `${METEOR_RADIUS * 2}px`;
        style.height = `${METEOR_RADIUS * 2}px`;
    } else if (effect.type === 'aoe-caster' && effect.size) {
        style.width = `${effect.size}px`;
        style.height = `${effect.size}px`;
    } else { // hit
        style.width = '40px';
        style.height = '40px';
    }
    return style;
  };
  

  const aliveCount = useMemo(() => players.filter(p => p.isAlive).length, [players]);
  const totalAliveCount = aliveCount;
  const activeTheme = themes[gameMode].classes;

  const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative inline-flex items-center ml-1">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs bg-gray-900 text-gray-200 rounded-md shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        {text}
      </div>
    </div>
  );

  const renderSetupView = () => (
    <>
      <header className="absolute top-0 left-0 right-0 p-4 z-20 pointer-events-none text-center">
        <h1 className={`text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br ${activeTheme.titleGradientFrom} ${activeTheme.titleGradientTo} font-orbitron animate-title-glow`} style={{ '--glow-color': activeTheme.neonColor }}>
          Batalha Royale de Seguidores
        </h1>
        <p className="mt-2 text-gray-300 max-w-2xl mx-auto text-sm sm:text-base">
          Crie sua própria batalha simulada com seus seguidores e veja quem sobrevive!
        </p>
        {isSpectatorMode && <p className="text-yellow-400 font-bold font-orbitron animate-pulse mt-1">MODO ESPECTADOR</p>}
      </header>
      
      <div className="absolute inset-0 z-10 overflow-y-auto p-4 flex flex-col items-center pt-24 sm:pt-28">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-start my-auto">
          {/* --- Coluna da Esquerda: Customização --- */}
          <div className="animate-fade-in-left space-y-8 p-6 sm:p-8 bg-gray-950/40 backdrop-blur-2xl rounded-2xl border border-white/10 relative overflow-hidden">
             <div className="absolute -inset-px rounded-2xl" style={{
                background: `radial-gradient(400px at 50% 0%, ${activeTheme.neonColor}15, transparent 80%)`
             }} />
            <div className="relative z-10">
                <h2 className={`text-2xl font-bold font-orbitron mb-4 border-b border-white/10 pb-3 ${activeTheme.text}`} style={{textShadow: `0 0 8px ${activeTheme.neonColor}60`}}>1. Customize a Arena</h2>
                <div className="grid md:grid-cols-3 gap-4">
                    {Object.values(GameMode).map(mode => {
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
                 <div className="grid sm:grid-cols-2 gap-6 items-center">
                    <div>
                        <label className="block text-base font-orbitron mb-2 text-gray-300">
                          Tamanho dos Lutadores
                          <InfoTooltip text="Lutadores maiores são mais fáceis de ver, mas ocupam mais espaço. Lutadores menores permitem uma visão mais ampla do campo de batalha." />
                        </label>
                        <div role="radiogroup" aria-label="Tamanho dos Lutadores" className="flex justify-center gap-1 bg-black/30 p-1.5 rounded-full border border-white/10 w-full">
                            {[
                                { label: 'P', value: 0.75 }, { label: 'M', value: 1.0 },
                                { label: 'G', value: 1.25 }, { label: 'XG', value: 1.5 },
                            ].map(({ label, value }) => (
                                <button role="radio" aria-checked={playerSizeMultiplier === value} onClick={() => setPlayerSizeMultiplier(value)} key={label}
                                    className={`w-full py-1.5 rounded-full text-sm font-bold transition-all duration-300 relative border-2 ${playerSizeMultiplier === value ? `${activeTheme.radioBg} ${activeTheme.radioShadow} border-transparent` : 'bg-transparent border-transparent text-gray-300 hover:bg-white/10'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-base font-orbitron mb-2 text-gray-300">
                          Formato de Gravação
                          <InfoTooltip text="Otimiza a arena para gravação de vídeo vertical (9:16), perfeito para TikTok, Reels ou Shorts. Lembre-se de ativar a gravação!" />
                        </label>
                       <button onClick={() => setIsReelMode(prev => !prev)} role="switch" aria-checked={isReelMode} className="w-full bg-black/30 p-1.5 rounded-full border border-white/10 flex items-center text-sm font-bold transition-all duration-300 relative">
                           <span className={`flex-1 z-10 py-1.5 px-3 rounded-full transition-all ${!isReelMode ? 'text-white' : 'text-gray-400'}`}>Padrão</span>
                           <span className={`flex-1 z-10 py-1.5 px-3 rounded-full transition-all ${isReelMode ? 'text-white' : 'text-gray-400'}`}>Reel</span>
                           <div 
                               className={`absolute top-1 left-1 h-[calc(100%-0.5rem)] w-[calc(50%-0.25rem)] rounded-full transition-transform duration-300 ease-in-out ${activeTheme.radioBg} ${activeTheme.radioShadow}`}
                               style={{ transform: isReelMode ? 'translateX(100%)' : 'translateX(0)' }}
                           />
                       </button>
                    </div>
                 </div>
            </div>
          </div>

          {/* --- Coluna da Direita: Ação Principal --- */}
          <div 
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            className={`animate-fade-in-right space-y-4 p-6 sm:p-8 bg-gray-950/60 backdrop-blur-2xl rounded-2xl border relative overflow-hidden transition-all duration-300 ${isDraggingOver ? `border-dashed border-2 ${activeTheme.borderSelected} scale-105` : `border-white/10`}`}
            style={{ boxShadow: !isDraggingOver ? `0 0 30px ${activeTheme.neonColor}20` : undefined }}
          >
             <div className="absolute -inset-px rounded-2xl opacity-50" style={{ background: `radial-gradient(600px at 50% 100%, ${activeTheme.neonColor}1A, transparent 80%)` }} />
             <div className="relative z-10">
                <h2 className={`text-2xl font-bold font-orbitron border-b border-white/10 pb-3 mb-4 ${activeTheme.text}`} style={{textShadow: `0 0 8px ${activeTheme.neonColor}60`}}>2. Convoque seus Lutadores</h2>
                
                <input id="profileName" type="text" value={profileName} onChange={(e) => { const newName = e.target.value; setProfileName(newName); localStorage.setItem('battleRoyaleProfileName', newName); }}
                  placeholder="Seu Nome de Invocador (Opcional)"
                  className={`w-full bg-black/40 border border-white/20 rounded-lg p-3 text-center text-gray-300 focus:ring-2 focus:outline-none focus:border-transparent ${activeTheme.borderSelected} transition-all`}
                />
                
                <div role="radiogroup" aria-label="Selecione a plataforma de origem" className="mt-4 flex justify-center gap-2 bg-black/30 p-1.5 rounded-full border border-white/10 w-fit mx-auto">
                  {(['Instagram', 'TikTok'] as Platform[]).map(p => (
                    <button role="radio" aria-checked={platform === p} onClick={() => setPlatform(p)} key={p} 
                      className={`px-6 py-1.5 rounded-full text-sm font-bold transition-all duration-300 relative border-2 ${platform === p ? `${activeTheme.radioBg} ${activeTheme.radioShadow} border-transparent` : 'bg-transparent border-transparent text-gray-300 hover:bg-white/10'}`}>
                      {p}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-4">
                  <input ref={fileInputRef} type="file" accept=".json,.jsonl,.txt,.csv" onChange={handleFileUpload} className="hidden" />
                  <button onClick={handleChooseFileClick} className={`w-full ${activeTheme.bg} ${activeTheme.hoverBg} text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 glow-button flex items-center justify-center gap-2 transform hover:scale-105`}>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                     Carregar do Arquivo...
                  </button>
                  
                  <div className="relative flex items-center text-sm text-gray-500">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="flex-shrink mx-4">OU ARRASTE E SOLTE</span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>

                  <textarea 
                      value={jsonInput} 
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder="Cole os dados dos seus seguidores aqui..." 
                      className="w-full h-24 bg-black/40 border border-white/20 rounded-lg p-3 text-gray-300 font-mono text-sm focus:ring-2 focus:outline-none focus:border-transparent resize-y"
                  />
                  <button onClick={() => processJsonData(jsonInput, platform)} disabled={!jsonInput.trim()} className={`w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                    Carregar Dados Colados
                  </button>
                </div>
                
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-gray-400 hover:text-white list-none flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 detail-arrow" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    Guia de Formato de Dados
                  </summary>
                  <div className="mt-2 p-3 bg-black/30 rounded-lg border border-white/10 space-y-2 text-gray-400">
                      <p><strong className="text-white">Instagram (CSV):</strong> O arquivo deve ter duas colunas, `name` e `pfp_url` (ou `username` e `imageUrl`).</p>
                      <p><strong className="text-white">TikTok (JSON):</strong> Use o JSON exportado por ferramentas de extração. O sistema buscará por `nickname` e `avatarThumb`.</p>
                      <p>O sistema é flexível e tentará encontrar os dados corretos mesmo em JSONs aninhados.</p>
                  </div>
                </details>
             </div>
          </div>
        </div>

        <div className="mt-8 text-center animate-fade-in [animation-delay:200ms]">
          <button onClick={startSpectatorMode} className="bg-transparent border-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black font-bold py-3 px-6 rounded-lg transition-all duration-300 glow-button-yellow w-full md:w-auto">
              Entrar como Espectador (50.000 Lutadores)
          </button>
        </div>
      </div>
    </>
  );

  const renderControlPanel = () => (
    <div className={`h-full w-full lg:w-[320px] xl:w-[400px] flex flex-col gap-4 p-4 bg-gray-950/80 backdrop-blur-md border-t ${activeTheme.border} lg:border-l lg:border-t-0 rounded-t-2xl lg:rounded-none overflow-y-auto custom-scrollbar`}
     style={{ 
        backgroundImage: `radial-gradient(circle at 1px 1px, ${activeTheme.dotColor} 1px, transparent 0)`,
        backgroundSize: '2rem 2rem'
    }}>
       {/* Subtle puller handle/button for Reel Mode & Mobile */}
      <button
        onClick={() => setIsControlPanelOpen(prev => !prev)}
        className="lg:hidden absolute top-0 left-0 right-0 h-10 flex items-center justify-center cursor-grab active:cursor-grabbing"
        aria-label={isControlPanelOpen ? "Recolher painel" : "Expandir painel"}
      >
          <div className="w-10 h-1.5 bg-gray-500/70 rounded-full"></div>
      </button>

      <div className="flex-shrink-0 pt-10 lg:pt-0">
          <h2 className={`text-2xl font-bold font-orbitron text-center ${activeTheme.text}`} style={{textShadow: activeTheme.textGlow}}>Painel de Controle</h2>
          <div className="mt-2 text-center text-lg">
            Lutadores Vivos: <span className="font-bold text-green-400 animate-pulse">{totalAliveCount} / {totalPlayersRef.current}</span>
          </div>
      </div>

      {followedPlayer && (
        <div className="flex-shrink-0 bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-yellow-400/50 shadow-lg animate-fade-in">
          <div className="flex items-center gap-3">
            <img src={followedPlayer.imageUrl} alt={followedPlayer.name} className="w-12 h-12 rounded-full border-2 border-yellow-400" />
            <div className="flex-grow">
              <p className="font-bold text-yellow-300">Seguindo: {followedPlayer.name}</p>
              <p className="text-sm text-gray-300">{followedPlayer.power}</p>
              <div className="w-full bg-gray-600 rounded-full h-2.5 mt-1">
                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${(followedPlayer.hp / followedPlayer.maxHp) * 100}%` }}></div>
              </div>
            </div>
            <button onClick={handleUnfollow} className="bg-red-500/50 hover:bg-red-500 text-white rounded-full p-2 self-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </div>
      )}

      {gameState === GameState.Running && !followedPlayer && (
        <div className="flex-shrink-0 text-center p-3 bg-white/5 backdrop-blur-sm rounded-lg text-gray-300">
          Clique em um lutador para segui-lo.
        </div>
      )}

      <div className="flex-grow min-h-0">
          <BattleLog events={battleLog} />
      </div>

      <div className="flex flex-col gap-3 flex-shrink-0">
        <button onClick={toggleRecordNextBattle} disabled={isRecordingActive} className={`w-full font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 ${recordNextBattle ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-600/50 hover:bg-gray-600'}`}>
          <div className={`w-4 h-4 rounded-full ${recordNextBattle ? 'bg-white animate-pulse' : 'bg-red-500'}`}></div>
          {isRecordingActive ? 'Gravando...' : (recordNextBattle ? 'Gravação Armada' : 'Gravar Próxima Batalha')}
        </button>
        <button onClick={resetGame} className="w-full bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-all">
          Parar e Voltar
        </button>
      </div>
    </div>
  );

  const renderFinishedView = () => (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-lg animate-fade-in p-4">
      <WinnerConfetti />
      <div className={`text-center p-6 sm:p-8 rounded-2xl bg-gray-950/80 border ${activeTheme.border} ${activeTheme.shadowSelected} ${isReelMode ? 'h-full max-h-full aspect-[9/16] flex flex-col justify-center overflow-y-auto custom-scrollbar' : 'max-w-2xl w-full'}`}>
        {top3.length > 0 && (
          <div className="mb-8">
            <h2 className="text-3xl sm:text-4xl font-black text-white font-orbitron mb-6" style={{textShadow: '0 0 10px rgba(255, 255, 255, 0.5)'}}>
              PÓDIO DOS CAMPEÕES
            </h2>
            <div className="flex flex-row justify-center items-end gap-2 sm:gap-6 h-48 sm:h-56">
              {/* 2nd Place */}
              {top3[1] && (
                <div className="flex flex-col items-center animate-fade-in [animation-delay:1000ms]">
                  <div className="relative">
                    <img src={top3[1].imageUrl} alt={top3[1].name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-gray-300 shadow-lg object-cover" />
                    <div className="absolute -bottom-3 -right-3 bg-gray-300 text-gray-800 font-bold rounded-full w-8 h-8 flex items-center justify-center border-2 border-gray-900 shadow-md">
                      🥈
                    </div>
                  </div>
                  <div className="mt-4 bg-gradient-to-t from-gray-400 to-gray-300 w-20 sm:w-24 h-24 sm:h-28 rounded-t-lg flex items-start justify-center pt-2 shadow-[0_0_15px_rgba(156,163,175,0.5)] border-t border-x border-gray-200">
                    <span className="font-bold text-gray-900 text-xl">2º</span>
                  </div>
                  <p className="font-bold text-gray-300 mt-2 text-sm sm:text-base truncate w-24 text-center">{top3[1].name}</p>
                </div>
              )}

              {/* 1st Place */}
              {top3[0] && (
                <div className="flex flex-col items-center animate-fade-in [animation-delay:500ms] z-10">
                  <div className="relative">
                    <img src={top3[0].imageUrl} alt={top3[0].name} className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] object-cover" />
                    <div className="absolute -bottom-4 -right-4 bg-yellow-400 text-yellow-900 font-bold rounded-full w-10 h-10 flex items-center justify-center border-2 border-yellow-900 shadow-lg text-xl">
                      🥇
                    </div>
                  </div>
                  <div className="mt-4 bg-gradient-to-t from-yellow-500 to-yellow-400 w-24 sm:w-28 h-32 sm:h-40 rounded-t-lg flex items-start justify-center pt-2 shadow-[0_0_25px_rgba(250,204,21,0.6)] border-t border-x border-yellow-200">
                    <span className="font-black text-yellow-900 text-2xl">1º</span>
                  </div>
                  <p className="font-bold text-yellow-400 mt-2 text-base sm:text-lg truncate w-28 text-center" style={{textShadow: '0 0 5px rgba(250, 204, 21, 0.5)'}}>{top3[0].name}</p>
                </div>
              )}

              {/* 3rd Place */}
              {top3[2] && (
                <div className="flex flex-col items-center animate-fade-in [animation-delay:1500ms]">
                  <div className="relative">
                    <img src={top3[2].imageUrl} alt={top3[2].name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-amber-600 shadow-lg object-cover" />
                    <div className="absolute -bottom-2 -right-2 bg-amber-600 text-amber-100 font-bold rounded-full w-7 h-7 flex items-center justify-center border-2 border-amber-900 shadow-md text-sm">
                      🥉
                    </div>
                  </div>
                  <div className="mt-4 bg-gradient-to-t from-amber-700 to-amber-600 w-16 sm:w-20 h-16 sm:h-20 rounded-t-lg flex items-start justify-center pt-2 shadow-[0_0_10px_rgba(217,119,6,0.5)] border-t border-x border-amber-500">
                    <span className="font-bold text-amber-100 text-lg">3º</span>
                  </div>
                  <p className="font-bold text-amber-600 mt-2 text-xs sm:text-sm truncate w-20 text-center">{top3[2].name}</p>
                </div>
              )}
            </div>
            
            {top3[0] && (
              <div className="mt-8 bg-white/5 p-4 rounded-lg border border-yellow-400/20 animate-fade-in [animation-delay:2000ms]">
                <p className="text-lg sm:text-xl text-gray-300">O grande campeão sobreviveu com o poder de</p>
                <p className="text-xl sm:text-2xl font-bold mt-1 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">{top3[0].power}</p>
              </div>
            )}
          </div>
        )}
        
        <div className="my-6 h-px bg-white/10"></div>
        
        {recordedVideoUrl && (
            <div className="mt-6">
                <p className="text-lg font-bold text-green-400 mb-2">Gravação da Batalha Pronta!</p>
                <button onClick={downloadRecording} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all glow-button-green w-full">
                    Baixar Vídeo (.webm)
                </button>
            </div>
        )}
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

  const renderCountdown = () => {
    if (countdown === null) return null;
    const text = countdown > 0 ? countdown : "LUTE!";
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
        <p key={countdown} className="text-9xl font-black text-white font-orbitron animate-ping-pong" style={{ textShadow: `0 0 30px ${activeTheme.dotColor.replace('0.1', '1')}`}}>
          {text}
        </p>
      </div>
    );
  };
  
  const panelWrapperClasses = `z-10 transition-transform duration-500 ease-in-out ${
    isReelMode 
      ? `absolute bottom-0 left-0 w-full h-1/2 sm:h-1/3 ${isControlPanelOpen ? 'translate-y-0' : 'translate-y-[calc(100%-2.5rem)]'}`
      : `absolute bottom-0 left-0 w-full h-1/2 sm:h-1/3 lg:top-0 lg:right-0 lg:bottom-auto lg:left-auto lg:h-full flex-shrink-0 overflow-hidden lg:w-[320px] xl:w-[400px] ${isControlPanelOpen ? 'translate-y-0 lg:translate-x-0' : 'translate-y-[calc(100%-2.5rem)] lg:translate-y-0 lg:translate-x-full'}`
  }`;


  return (
    <main className="h-[100dvh] w-screen bg-[#0f071e] font-inter overflow-hidden relative">
      <DynamicBackground />
      <audio 
        ref={audioRef} 
        src={BGM_PLAYLIST[currentTrackIndex]} 
        loop={false}
        onEnded={() => setCurrentTrackIndex(prev => (prev + 1) % BGM_PLAYLIST.length)}
        preload="auto" 
      />
      
      {/* Mute Button */}
      <button 
        onClick={() => setIsMuted(!isMuted)}
        className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm border border-white/20 transition-all"
        title={isMuted ? "Ativar som" : "Desativar som"}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

      {gameState === GameState.AwaitingPlayers && players.length === 0 && renderSetupView()}
      
      {(gameState !== GameState.AwaitingPlayers || players.length > 0) && (
        <div className={`w-full h-full ${isReelMode ? 'relative' : 'flex flex-col lg:flex-row relative'} transition-opacity duration-500 ${gameState === GameState.AwaitingPlayers && players.length === 0 ? 'opacity-0' : 'opacity-100'}`}>
          <div className={`${isReelMode ? 'h-full flex items-center justify-center bg-black' : 'w-full h-full'} relative overflow-hidden`}>
            {gameState === GameState.Running && totalPlayersRef.current > 0 && (
                 <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-2/3 sm:w-1/3 max-w-sm">
                    <div className="text-center mb-1 text-sm font-bold font-orbitron text-white" style={{textShadow: '1px 1px 2px black'}}>
                        Vivos: <span className="text-green-300">{totalAliveCount}</span> / {totalPlayersRef.current}
                    </div>
                    <div className="w-full bg-black/50 backdrop-blur-sm rounded-full h-2.5 border border-white/20">
                        <div 
                            className="bg-gradient-to-r from-green-400 to-cyan-400 h-full rounded-full transition-all duration-300 ease-linear" 
                            style={{ width: `${(totalAliveCount / totalPlayersRef.current) * 100}%` }}
                        ></div>
                    </div>
                </div>
            )}
            <div ref={arenaRef} style={getArenaTransform()} className={`${isReelMode ? 'relative h-full aspect-[9/16] border-x-2 border-gray-800' : 'absolute inset-0'}`}>
              <canvas 
                ref={canvasRef} 
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={handleCanvasMouseLeave}
              />

              {/* Hit Effects */}
              {hitEffects.map(effect => (
                  <div key={effect.id} className={getEffectClass(effect.type)} style={getEffectStyle(effect)} />
              ))}

              {/* Floating Texts */}
              {floatingTexts.map(text => {
                  const invMultiplier = 1;
                  return (
                    <div key={text.id} className={`floating-text ${text.type}`} style={{ left: text.x * invMultiplier, top: text.y * invMultiplier }}>{text.text}</div>
                  );
              })}
            </div>
             {gameState === GameState.AwaitingPlayers && players.length > 0 && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-center">
                <h2 className={`text-2xl sm:text-4xl font-bold font-orbitron text-white mb-2`} style={{textShadow: `0 0 15px ${activeTheme.dotColor.replace('0.1', '0.8')}`}}>
                    Arena Pronta!
                </h2>
                <p className="text-base sm:text-xl text-gray-300 mb-8">
                    {totalPlayersRef.current} lutadores aguardam o início do combate.
                </p>
                <button 
                    onClick={startBattle} 
                    className={`animate-pulse-strong text-white font-black py-4 px-8 sm:py-6 sm:px-12 rounded-2xl text-xl sm:text-3xl font-orbitron transition-all duration-300 hover:scale-105 ${activeTheme.bg} ${activeTheme.hoverBg} glow-button relative overflow-hidden border-2 ${activeTheme.borderSelected}`}
                >
                    INICIAR BATALHA
                </button>
                 <button onClick={resetGame} className="mt-6 text-gray-400 hover:text-white underline">
                    Carregar outros lutadores
                </button>
              </div>
            )}
          </div>
          
          <div className={panelWrapperClasses}>
              {gameState === GameState.AwaitingPlayers && players.length > 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-center bg-gray-950/80 p-4" style={{ 
                      backgroundImage: `radial-gradient(circle at 1px 1px, ${activeTheme.dotColor} 1px, transparent 0)`,
                      backgroundSize: '2rem 2rem'
                  }}>
                      <h3 className={`text-xl font-bold font-orbitron ${activeTheme.text}`}>Aguardando Batalha</h3>
                      <p className="text-gray-300 mt-2">{totalPlayersRef.current} lutadores na arena.</p>
                      <p className="text-gray-400 text-sm mt-4">Pressione o botão no centro para começar.</p>
                  </div>
              ) : renderControlPanel()}
          </div>
          
          {!isReelMode && (gameState !== GameState.AwaitingPlayers || players.length > 0) && (
              <button
                  onClick={() => setIsControlPanelOpen(prev => !prev)}
                  aria-label={isControlPanelOpen ? "Recolher painel" : "Expandir painel"}
                  // Fix: Adjusted responsive layout for the control panel to be more flexible on smaller screens.
                  className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 z-20 items-center justify-center w-8 h-20 bg-gray-800/80 hover:bg-gray-700/80 backdrop-blur-sm rounded-l-md transition-all duration-500 ease-in-out ${isControlPanelOpen ? 'right-[320px] xl:right-[400px]' : 'right-0'}`}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-white transition-transform duration-500 ${isControlPanelOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
              </button>
          )}

        </div>
      )}
      
      {gameState === GameState.Finished && renderFinishedView()}
      {gameState === GameState.Countdown && renderCountdown()}

      {hoveredPlayer && (
        <div 
          className="absolute z-50 p-3 bg-gray-900/80 backdrop-blur-sm text-white rounded-lg pointer-events-none text-sm border border-white/20 shadow-lg"
          style={{ left: tooltipPosition.x + 15, top: tooltipPosition.y + 15 }}
        >
            <p className="font-bold">{hoveredPlayer.name}</p>
            <p className="text-purple-300">{hoveredPlayer.power}</p>
            <p>HP: {hoveredPlayer.hp}/{hoveredPlayer.maxHp}</p>
        </div>
      )}

      <style>{`
        body {
            overscroll-behavior: none;
        }
        details > summary {
            list-style: none;
        }
        details > summary::-webkit-details-marker {
            display: none;
        }
        details[open] .detail-arrow {
            transform: rotate(90deg);
        }
        .detail-arrow {
            transition: transform 0.2s;
        }
        @keyframes title-glow {
            0%, 100% { filter: drop-shadow(0 0 5px var(--glow-color)); text-shadow: 0 0 8px var(--glow-color); }
            50% { filter: drop-shadow(0 0 20px var(--glow-color)); text-shadow: 0 0 16px var(--glow-color); }
        }
        .animate-title-glow {
            animation: title-glow 4s ease-in-out infinite;
        }
        .glow-button {
            box-shadow: 0 0 10px ${activeTheme.dotColor.replace('0.1', '0.6')}, 0 0 20px ${activeTheme.dotColor.replace('0.1', '0.4')};
        }
        .glow-button-yellow {
             box-shadow: 0 0 10px rgba(250, 204, 21, 0.6), 0 0 20px rgba(250, 204, 21, 0.4);
        }
         .glow-button-green {
             box-shadow: 0 0 10px rgba(34, 197, 94, 0.6), 0 0 20px rgba(34, 197, 94, 0.4);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); border-radius: 20px; border: 3px solid transparent; }

        .hit-effect {
          position: absolute;
          border-radius: 50%;
          border: 3px solid currentColor;
          animation: hit-anim 0.4s ease-out forwards;
        }
        .aoe-effect {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, transparent 50%, currentColor 100%);
          animation: aoe-anim 0.6s ease-out forwards;
        }
        .aoe-caster-effect {
            position: absolute;
            border-radius: 50%;
            background: radial-gradient(circle, currentColor 0%, transparent 70%);
            animation: aoe-caster-anim 0.5s ease-out forwards;
        }
        .meteor-effect {
            position: absolute;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,165,0,0.8) 40%, rgba(255,69,0,0.5) 70%, transparent 100%);
            animation: meteor-impact 0.8s ease-out forwards;
        }

        @keyframes hit-anim {
          from { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          to { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
        @keyframes aoe-anim {
          from { transform: translate(-50%, -50%) scale(0.2); opacity: 0.8; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
        @keyframes aoe-caster-anim {
            from { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
            to { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        }
        @keyframes meteor-impact {
            0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }

        .floating-text {
          position: absolute;
          font-weight: bold;
          font-family: 'Orbitron', sans-serif;
          pointer-events: none;
          animation: float-up 1.5s ease-out forwards;
          text-shadow: 1px 1px 2px black;
          transform: translateX(-50%);
        }
        .floating-text.damage { color: #ffffff; font-size: 1.2rem; }
        .floating-text.crit { color: #f97316; font-size: 1.8rem; animation: float-up-crit 1.5s ease-out forwards; }
        .floating-text.miss { color: #9ca3af; font-size: 1rem; }
        
        @keyframes float-up {
          from { transform: translate(-50%, 0); opacity: 1; }
          to { transform: translate(-50%, -80px); opacity: 0; }
        }
        @keyframes float-up-crit {
          0% { transform: translate(-50%, 0) scale(1); opacity: 1; }
          20% { transform: translate(-50%, -20px) scale(1.5); }
          100% { transform: translate(-50%, -100px) scale(1.5); opacity: 0; }
        }

        @keyframes animate-slide-in-bottom {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in-bottom {
            animation: animate-slide-in-bottom 0.3s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
        }

        @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.5s cubic-bezier(0.215, 0.610, 0.355, 1.000) forwards; }

        @keyframes fade-in-left {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in-left { animation: fade-in-left 0.6s 0.2s cubic-bezier(0.215, 0.610, 0.355, 1.000) both; }

        @keyframes fade-in-right {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in-right { animation: fade-in-right 0.6s 0.4s cubic-bezier(0.215, 0.610, 0.355, 1.000) both; }


        @keyframes ping-pong {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-ping-pong {
            animation: ping-pong 1s ease-in-out infinite;
        }
        @keyframes pulse-strong {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        .animate-pulse-strong {
            animation: pulse-strong 2s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
};

export default App;