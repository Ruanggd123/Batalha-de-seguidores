import { useState, useRef, useEffect, useCallback } from 'react';
import { BGM_PLAYLIST } from '../constants/gameConfig';
import { GameState } from '../types';

export const useBattleAudio = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.AwaitingPlayers);
  const [isMuted, setIsMuted] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.4);
  const [sfxVolume, setSfxVolume] = useState(0.6);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPreloaded, setIsPreloaded] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // PRELOAD ALL TRACKS
  useEffect(() => {
    const preload = () => {
        BGM_PLAYLIST.forEach((track) => {
            const tempAudio = new Audio();
            tempAudio.src = track.url;
            tempAudio.preload = "auto";
        });
        setIsPreloaded(true);
    };
    
    if (typeof window !== 'undefined') {
        const timer = setTimeout(preload, 1000);
        return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    const bgm = audioRef.current;
    if (!bgm) return;
    
    const isPlayingMode = gameState === GameState.Running || gameState === GameState.Countdown;
    
    if (isPlayingMode) {
        const track = BGM_PLAYLIST[currentTrackIndex];
        const normalize = (url: string) => {
            if (url.startsWith('http')) return url;
            return window.location.origin + (url.startsWith('/') ? '' : '/') + url;
        };
        
        const targetSrc = normalize(track.url);
        if (bgm.src !== targetSrc && !bgm.src.endsWith(track.url)) {
            bgm.pause();
            bgm.src = track.url;
            bgm.load(); 
        }
        bgm.volume = bgmVolume;

        bgm.play().catch(e => {
            if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
                console.warn("BGM Playback (retrying...):", e.name);
                if (e.name === 'NotSupportedError' || e.name === 'NetworkError') {
                   setTimeout(() => setCurrentTrackIndex(prev => (prev + 1) % BGM_PLAYLIST.length), 2000);
                }
            }
        });
    } else {
        if (!bgm.paused) {
            bgm.pause();
            bgm.currentTime = 0;
        }
    }
  }, [gameState, currentTrackIndex, bgmVolume]);

  const nextTrack = useCallback(() => {
    setCurrentTrackIndex(prev => (prev + 1) % BGM_PLAYLIST.length);
  }, []);

  const prevTrack = useCallback(() => {
    setCurrentTrackIndex(prev => (prev - 1 + BGM_PLAYLIST.length) % BGM_PLAYLIST.length);
  }, []);

  const playBeep = useCallback((frequency: number, type: OscillatorType, duration: number) => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1 * sfxVolume, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.error("AudioContext error:", e);
    }
  }, [isMuted, sfxVolume]);

  return {
    isMuted, setIsMuted,
    bgmVolume, setBgmVolume,
    sfxVolume, setSfxVolume,
    currentTrackIndex, setCurrentTrackIndex,
    nextTrack, prevTrack,
    currentTrackTitle: BGM_PLAYLIST[currentTrackIndex]?.title || 'Unknown',
    audioRef,
    playBeep,
    setGameState 
  };
};

