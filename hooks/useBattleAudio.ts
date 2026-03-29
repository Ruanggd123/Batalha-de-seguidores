import { useState, useRef, useEffect, useCallback } from 'react';
import { BGM_PLAYLIST } from '../constants/gameConfig';
import { GameState } from '../types';

export const useBattleAudio = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.AwaitingPlayers);
  const [isMuted, setIsMuted] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.4);
  const [sfxVolume, setSfxVolume] = useState(0.6);
  const [narrationVolume, setNarrationVolume] = useState(1.0);
  const [isNarrationEnabled, setIsNarrationEnabled] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  
  const [currentNarration, setCurrentNarration] = useState<string>("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isNarratingRef = useRef<boolean>(false);
  const lastNarrationTimeRef = useRef<number>(0);
  
  // Refs to ensure the speech engine always has the latest values without needing dependency array restarts
  const volumeRef = useRef(narrationVolume);
  const enabledRef = useRef(isNarrationEnabled);

  useEffect(() => { volumeRef.current = narrationVolume; }, [narrationVolume]);
  useEffect(() => { enabledRef.current = isNarrationEnabled; }, [isNarrationEnabled]);

  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      // Sort: pt-BR > other pt > everything else
      const sortedVoices = [...allVoices].sort((a, b) => {
        const aPtBR = a.lang.includes('pt-BR') || a.lang.includes('pt_BR');
        const bPtBR = b.lang.includes('pt-BR') || b.lang.includes('pt_BR');
        if (aPtBR && !bPtBR) return -1;
        if (!aPtBR && bPtBR) return 1;
        
        const aPt = a.lang.startsWith('pt');
        const bPt = b.lang.startsWith('pt');
        if (aPt && !bPt) return -1;
        if (!aPt && bPt) return 1;
        
        return a.name.localeCompare(b.name);
      });

      setAvailableVoices(sortedVoices);
      if (sortedVoices.length > 0 && !selectedVoiceURI) {
        const defaultVoice = sortedVoices.find(v => v.lang.includes('pt-BR')) || sortedVoices[0];
        setSelectedVoiceURI(defaultVoice.voiceURI);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [selectedVoiceURI]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    // Stop any ongoing narration if the game ends or resets
    if (gameState === (GameState.Finished as any) || gameState === (GameState.AwaitingPlayers as any)) {
      window.speechSynthesis.cancel();
      isNarratingRef.current = false;
      setCurrentNarration("");
    }
  }, [gameState]);

  useEffect(() => {
    const bgm = audioRef.current;
    if (!bgm) return;
    
    // Unity BGM logic across all states
    if (gameState === (GameState.Running as any) || gameState === (GameState.Countdown as any)) {
        bgm.volume = bgmVolume;
        bgm.play().catch(e => {
            if (e.name !== 'AbortError') {
                console.error("BGM Playback error:", e);
                // Attempt to skip if source is invalid
                if (e.name === 'NotSupportedError') {
                    console.warn("Retrying next track due to unsupported source...");
                    setCurrentTrackIndex(prev => (prev + 1) % BGM_PLAYLIST.length);
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

  const phraseHistoryRef = useRef<string[]>([]);
  const MAX_HISTORY = 5;

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

  const narrateText = useCallback((text: string) => {
    if (!text || !enabledRef.current) {
      window.speechSynthesis.cancel();
      return;
    }
    
    window.speechSynthesis.cancel();
    setCurrentNarration(text);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volumeRef.current;
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    
    // Memory logic to prevent repetition
    phraseHistoryRef.current.push(text);
    if (phraseHistoryRef.current.length > MAX_HISTORY) phraseHistoryRef.current.shift();

    const voice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
    if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
    } else {
        utterance.lang = 'pt-BR';
    }
    
    utterance.onstart = () => { isNarratingRef.current = true; };
    utterance.onend = () => {
      isNarratingRef.current = false;
      setTimeout(() => setCurrentNarration(prev => prev === text ? "" : prev), 2000);
    };
    
    window.speechSynthesis.speak(utterance);
  }, [availableVoices, selectedVoiceURI]);

  const stopNarration = useCallback(() => {
    window.speechSynthesis.cancel();
    isNarratingRef.current = false;
    setCurrentNarration("");
  }, []);

  const playBase64Audio = useCallback((base64: string, volume: number = narrationVolume) => {
    if (!base64) return;
    try {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = volume;
      audio.play().catch(e => console.error("Playback error:", e));
      audio.onended = () => {
        URL.revokeObjectURL(url);
        isNarratingRef.current = false;
      };
    } catch (e) {
      console.error("Error playing base64 audio:", e);
      isNarratingRef.current = false;
    }
  }, [narrationVolume]);

  return {
    isMuted, setIsMuted,
    bgmVolume, setBgmVolume,
    sfxVolume, setSfxVolume,
    narrationVolume, setNarrationVolume,
    isNarrationEnabled, setIsNarrationEnabled,
    currentTrackIndex, setCurrentTrackIndex,
    audioRef,
    isNarratingRef,
    lastNarrationTimeRef,
    phraseHistoryRef,
    playBeep,
    narrateText,
    stopNarration,
    playBase64Audio,
    currentNarration,
    availableVoices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    setGameState // Export the setter so App can update it
  };
};
