
export interface Player {
  id: number;
  name: string;
  imageUrl: string;
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
}

export interface BattleEvent {
  id: number;
  text: string;
  // Fix: Added 'commentary' to the type union to resolve comparison errors in services/geminiService.ts and components/BattleLog.tsx.
  type: 'attack' | 'elimination' | 'info' | 'winner' | 'aoe' | 'commentary';
}

// Fix: Added missing CommentaryResult interface to resolve import error in services/geminiService.ts.
export interface CommentaryResult {
  text: string;
  audioB64: string;
}

// Fix: Added missing BattleSummary interface to resolve import error in services/geminiService.ts.
export interface BattleSummary {
  narrative: string;
  duration: string;
}

export enum GameState {
  AwaitingPlayers = 'AwaitingPlayers',
  GeneratingPowers = 'GeneratingPowers',
  Countdown = 'Countdown',
  Running = 'Running',
  Finished = 'Finished',
}

export enum GameMode {
  Classic = 'Classic',
  GravityAbyss = 'GravityAbyss',
  Vortex = 'Vortex',
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
