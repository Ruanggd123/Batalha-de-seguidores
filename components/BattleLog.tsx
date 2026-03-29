import React, { useRef, useEffect } from 'react';
import { BattleEvent } from '../types';

interface BattleLogProps {
  events: BattleEvent[];
}

const getEventIcon = (type: BattleEvent['type']) => {
    switch(type) {
        case 'attack':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 2.5a.5.5 0 00-1 0v11a.5.5 0 001 0v-11zM18.5 2.5a.5.5 0 00-1 0v11a.5.5 0 001 0v-11zM11.243 1.056a.5.5 0 00-.486 0L2.057 5.056a.5.5 0 00.486.868L11 2.586l8.457 3.338a.5.5 0 00.486-.868L11.243 1.056zM11 5a3 3 0 11-6 0 3 3 0 016 0zm-3 2a1 1 0 100-2 1 1 0 000 2z"/><path d="M12 11a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zm-3 0a1 1 0 011-1h1a1 1 0 110 2H9a1 1 0 01-1-1zM6 11a1 1 0 011-1h1a1 1 0 110 2H7a1 1 0 01-1-1z"/></svg>;
        case 'aoe':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.21 2.47a.75.75 0 011.06 0l1.22 1.22a.75.75 0 001.06 0l1.22-1.22a.75.75 0 011.06 1.06l-1.22 1.22a.75.75 0 000 1.06l1.22 1.22a.75.75 0 01-1.06 1.06l-1.22-1.22a.75.75 0 00-1.06 0l-1.22 1.22a.75.75 0 01-1.06-1.06l1.22-1.22a.75.75 0 000-1.06L8.21 3.53a.75.75 0 010-1.06zM3.75 9.25a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM5.25 11.5a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM4 13.25a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM5.25 15a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM7 8.25a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01A.75.75 0 017 8.25v-.01zM8.5 10.5a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM7 14.25a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM8.5 16.5a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM10.75 8.5a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM12.25 10.75a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM10.75 14.5a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM12.25 16.75a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM14.25 9.5a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM15.75 11.75a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM14.25 13.5a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zM15.75 15.75a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01z" clipRule="evenodd" /></svg>;
        case 'elimination':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>;
        case 'winner':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>;
        case 'commentary':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-300" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.083-3.083A7.002 7.002 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM4.836 14.33a6.002 6.002 0 0011.13-1.325A6.002 6.002 0 0010 4c-3.314 0-6 2.686-6 6 0 1.31.423 2.526 1.155 3.551L4.836 14.33z" clipRule="evenodd" /></svg>;
        default: // info
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>;
    }
};

const getEventStyle = (type: BattleEvent['type']) => {
    switch (type) {
      case 'attack':
        return 'text-gray-300';
      case 'aoe':
        return 'text-orange-300 font-semibold';
      case 'elimination':
        return 'text-red-400 font-bold';
      case 'winner':
        return 'text-yellow-400 text-lg font-bold';
      case 'commentary':
        return 'text-cyan-300 italic';
      default:
        return 'text-blue-400';
    }
};

const BattleLog: React.FC<BattleLogProps> = ({ events }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div
      className="h-full w-full bg-black/30 backdrop-blur-sm rounded-lg flex flex-col p-4 custom-scrollbar"
    >
      <h3 className="text-xl font-bold mb-3 text-center border-b border-gray-600/50 pb-2 text-purple-300 font-orbitron flex-shrink-0" style={{textShadow: '0 0 8px rgba(192, 132, 252, 0.7)'}}>Registro de Batalha</h3>
      <div 
        ref={logContainerRef}
        className="flex-grow overflow-y-auto pr-2"
        style={{ maskImage: 'linear-gradient(to bottom, transparent, black 1.5rem, black calc(100% - 1.5rem), transparent)' }}
      >
        <div className="flex flex-col gap-2 text-sm font-inter pt-2 pb-6">
          {events.map((event) => (
            <div key={event.id} className={`flex items-start gap-2 animate-slide-in-bottom ${getEventStyle(event.type)}`}>
              <span className="mt-0.5 flex-shrink-0">{getEventIcon(event.type)}</span>
              <p className="flex-grow">{event.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BattleLog;