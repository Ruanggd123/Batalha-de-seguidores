import React from 'react';
import { HitEffect, FloatingText, Player } from '../../types';

interface BattleArenaProps {
  arenaRef: React.RefObject<HTMLDivElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isReelMode: boolean;
  getArenaTransform: () => React.CSSProperties;
  handleCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseLeave: () => void;
}

const BattleArena: React.FC<BattleArenaProps> = ({
  arenaRef, canvasRef, isReelMode,
  getArenaTransform, handleCanvasClick, handleCanvasMouseMove, handleCanvasMouseLeave
}) => {
  return (
    <div className={`${isReelMode ? 'h-full flex items-center justify-center bg-black' : 'w-full h-full'} relative overflow-hidden`}>
      <div 
        ref={arenaRef} 
        style={getArenaTransform()} 
        className={`${isReelMode ? 'relative h-full max-h-screen aspect-[9/16] border-x-2 border-fuchsia-500/30 bg-black/40 shadow-2xl overflow-hidden' : 'absolute inset-0'}`}
      >
        <canvas 
          ref={canvasRef} 
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          className="block w-full h-full"
        />
      </div>
    </div>
  );
};

export default BattleArena;
