import React from 'react';

interface CountdownOverlayProps {
  countdown: number | null;
  activeTheme: any;
}

const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ countdown, activeTheme }) => {
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

export default CountdownOverlay;
