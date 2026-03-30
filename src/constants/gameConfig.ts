import { GameMode } from '../types';

export const INITIAL_HP = 100;
export const NORMAL_BATTLE_INTERVAL_MS = 200;
export const MAX_SPEED_BATTLE_INTERVAL_MS = 1;
export const KNOCKBACK_FORCE = 15;
export const REPULSION_FORCE = 1.0;
export const DAMPING = 0.95;
export const AOE_CHANCE = 0;
export const AOE_RADIUS = 120;
export const AOE_DAMAGE_BASE = 3;
export const AOE_DAMAGE_RANDOM = 5;
export const PHYSICS_OPTIMIZATION_THRESHOLD = 200;
export const PHYSICS_SAMPLE_SIZE = 15;
export const DEATH_ANIMATION_FRAMES = 30;
export const UI_UPDATE_INTERVAL = 300; // Drastically increased for 50,000 players

export const VORTEX_STRENGTH = 50;
export const VORTEX_SPIRAL_FORCE = 0.8;
export const VORTEX_INITIAL_RADIUS = 50;
export const VORTEX_GROWTH_RATE = 0.5;

export const GRAVITY_ABYSS_ROTATION_SPEED = 0.003;
export const SPHERE_GRAVITY = 0.15;
export const GRAVITY_ABYSS_RADIUS_FACTOR = 0.45;
export const GRAVITY_ABYSS_HOLE_SIZE_DEGREES = 60;

export const MIN_PLAYER_SIZE = 3;
export const MAX_PLAYER_SIZE = 150; 
export const MIN_PLAYERS_FOR_MAX_SIZE = 10;
export const MAX_PLAYERS_FOR_MIN_SIZE = 2500; // Curve starts rising here
export const PIXEL_MODE_THRESHOLD = 1000; // Use dots above 1000

export const ATTACK_TRACER_THRESHOLD = 150;
export const ATTACK_TRACER_LIFESPAN = 20;
export const METEOR_SHOWER_THRESHOLD = 1000;
export const METEOR_SPAWN_INTERVAL = 500;
export const METEOR_IMPACT_TIMER = 180;
export const METEOR_RADIUS = 150;
export const METEOR_DAMAGE_BASE = 15;
export const METEOR_DAMAGE_RANDOM = 10;
export const METEOR_KNOCKBACK = 25;

export const SPAWN_BATCH_INITIAL = 20;
export const SPAWN_BATCH_MAX = 500;
export const SPAWN_ACCELERATION = 1.1; // 10% increase per batch
export const SPAWN_INTERVAL_MS = 16; // 60fps-ish

export const BGM_PLAYLIST = [
  "https://opengameart.org/sites/default/files/battleThemeA.mp3",
  "https://opengameart.org/sites/default/files/Visager_-_17_-_Fight_Loop.mp3",
  "https://opengameart.org/sites/default/files/Visager_-_14_-_The_Final_Trap.mp3",
  "https://opengameart.org/sites/default/files/Visager_-_05_-_The_Great_Lighthouse.mp3"
];

export const gameModeDetails = {
  [GameMode.Classic]: { title: 'Batalha Clássica', description: 'Uma arena aberta onde apenas o mais forte sobrevive. Empurre e ataque!', icon: '⚔️' },
  [GameMode.GravityAbyss]: { title: 'Abismo Gravitacional', description: 'Uma esfera gigante gira sem parar. A gravidade o puxa para o fundo - escale as paredes para não ser engolido pelo abismo em movimento!', icon: '🌐' },
  [GameMode.Vortex]: { title: 'Vórtice Aniquilador', description: 'Um vórtice mortal no centro se expande. Fuja para as bordas para sobreviver!', icon: '🌀' },
};

export const themes = {
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
      radioSelected: 'bg-purple-600 border-purple-300',
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
      radioSelected: 'bg-indigo-600 border-cyan-300',
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
      radioSelected: 'bg-red-600 border-orange-300',
    }
  },
} as const;
