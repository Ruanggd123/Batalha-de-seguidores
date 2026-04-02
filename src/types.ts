export interface Player {
  id: number;
  name: string;
  imageUrl: string;
  instagramUrl?: string; // URL to the player's profile
  hp: number;
  maxHp: number;
  isAlive: boolean;
  power?: string;
  key?: string; // For animation keying
  dying?: number; // Countdown for death animation

  // Physics properties
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle?: number; // Current movement angle for natural steering
  targetSpeed?: number; // Desired speed for smoother acceleration
  lastCollisionTime?: number;
  isCharged?: boolean; // For DVD mode: true if the player hit a wall
  image?: HTMLImageElement; // Pre-loaded image object for direct rendering
}

export interface BattleEvent {
  id: number;
  text: string;
  // Fix: Added 'commentary' to the type union to resolve comparison errors in services/geminiService.ts and components/BattleLog.tsx.
  type: 'attack' | 'elimination' | 'info' | 'winner' | 'aoe' | 'commentary';
}

// Game States

export enum GameState {
  AwaitingPlayers = 'AwaitingPlayers',
  GeneratingPowers = 'GeneratingPowers',
  Countdown = 'Countdown',
  Running = 'Running',
  Finished = 'Finished',
}

export type Platform = 'Instagram' | 'TikTok';

export enum GameMode {
  Classic = 'Classic',
  GravityAbyss = 'GravityAbyss',
  Vortex = 'Vortex',
  ElasticClash = 'ElasticClash',
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  type: 'damage' | 'crit' | 'miss';
}

export interface HitEffect {
  id: number;
  x: number;
  y: number;
  color: string;
  type: 'hit' | 'aoe' | 'aoe-caster' | 'meteor';
  size?: number;
}

export interface AttackLine {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  life: number;
  color: string;
}

export interface Meteor {
  id: number;
  x: number;
  y: number;
  radius: number;
  impactTimer: number; // countdown in frames
  totalTime: number; // initial time for animation scaling
}
