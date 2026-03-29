import React from 'react';

interface SubtitlesProps {
  text: string;
}

const Subtitles: React.FC<SubtitlesProps> = ({ text }) => {
  if (!text) return null;

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4 pointer-events-none animate-fade-in">
      <div className="bg-black/80 backdrop-blur-md border border-white/20 p-4 rounded-xl shadow-2xl text-center">
        <p className="text-xl sm:text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-white to-purple-400 leading-tight drop-shadow-lg">
          {text}
        </p>
      </div>
    </div>
  );
};

export default Subtitles;
