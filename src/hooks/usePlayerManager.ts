import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Player, Platform, BattleEvent } from '../types';
import { INITIAL_HP } from '../constants/gameConfig';
import { getSafeImageUrl } from '../utils/gameUtils';
import { DEFAULT_AVATAR } from '../constants/assets';
import { validateLicense, burnLicense } from '../services/licenseService';


export const usePlayerManager = (addLogEvent: (text: string, type: BattleEvent['type']) => void) => {
  // --- 1. HOOKS: STATES (Keep order stable!) ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [profileName, setProfileName] = useState<string>('');
  const [platform, setPlatform] = useState<Platform>('Instagram');
  const [jsonInput, setJsonInput] = useState('');
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [botStatus, setBotStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [botError, setBotError] = useState<string | null>(null);
  const [botLogs, setBotLogs] = useState<string[]>([]);
  
  // New States (Added for License System)
  const [licenseKey, setLicenseKey] = useState(() => localStorage.getItem('battleRoyale_licenseKey') || '');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);

  // --- 2. HOOKS: REFS ---
  const playersRef = useRef<Player[]>([]);
  const totalPlayersRef = useRef<number>(0);
  const allPlayersRef = useRef<Player[]>([]);

  // --- 3. HOOKS: EFFECTS & CALLBACKS ---
  
  // Sync ref with state
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Load saved profile
  useEffect(() => {
    const saved = localStorage.getItem('battleRoyaleProfileName');
    if (saved) setProfileName(saved);
  }, []);

  // License Validation Logic (Powered by Firebase)
  const checkLicense = useCallback(async (key: string) => {
    if (!key) {
        setIsAuthorized(false);
        setIsAdmin(false);
        return;
    }

    setIsValidatingKey(true);
    
    try {
        const result = await validateLicense(key);
        if (result.status === 'admin') {
            setIsAuthorized(true);
            setIsAdmin(true);
            localStorage.setItem('battleRoyale_licenseKey', key);
        } else if (result.status === 'valid') {
            setIsAuthorized(true);
            setIsAdmin(false);
            localStorage.setItem('battleRoyale_licenseKey', key);
        } else {
            setIsAuthorized(false);
            setIsAdmin(false);
        }
    } catch (e) {
        console.warn("Erro ao validar chave global:", e);
        setIsAuthorized(false);
        setIsAdmin(false);
    } finally {
        setIsValidatingKey(false);
    }
  }, []);

  // auto-validate key on load
  useEffect(() => {
    if (licenseKey) checkLicense(licenseKey);
  }, [licenseKey, checkLicense]);

  const initializePlayers = useCallback((parsedPlayers: { name: string; imageUrl: string }[]) => {
    if (parsedPlayers.length === 0) {
      alert("Nenhum jogador encontrado.");
      return;
    }
    totalPlayersRef.current = parsedPlayers.length;
    addLogEvent(`Carregados ${parsedPlayers.length} lutadores na arena! A batalha será épica!`, 'info');
    
    const initialPlayers = parsedPlayers.map((p, index) => ({
        ...p,
        imageUrl: getSafeImageUrl(p.imageUrl),
        id: index,
        hp: INITIAL_HP,
        maxHp: INITIAL_HP,
        isAlive: true,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
    }));
    
    allPlayersRef.current = initialPlayers;
    setPlayers([]);
    playersRef.current = [];
  }, [addLogEvent]);

  const parseCsvData = useCallback((content: string): { name: string; imageUrl: string }[] | null => {
    try {
        const lines = content.split('\n').filter(line => line.trim() !== '');
        return lines.map(line => {
            let name = "";
            let imageUrl = "";
            const urlMatch = line.match(/(https?:\/\/[^\s,;]+)/);
            if (urlMatch) {
                imageUrl = urlMatch[0];
                name = line.replace(imageUrl, '').replace(/^[ ,;\t]+|[ ,;\t]+$/g, '').trim();
            } else {
                name = line.split(/[ ,;\t]+/)[0];
            }
            if (name && !imageUrl) imageUrl = DEFAULT_AVATAR;
            if (name) {
                let instagramUrl = "";
                if (line.includes('instagram.com/')) {
                   const match = line.match(/(https?:\/\/www\.instagram\.com\/[^\s,;?\/]+)/);
                   if (match) instagramUrl = match[0];
                } else if (name.startsWith('@')) {
                   instagramUrl = `https://www.instagram.com/${name.substring(1)}/`;
                }
                return { name, imageUrl: getSafeImageUrl(imageUrl), instagramUrl: instagramUrl || undefined };
            }
            return null;
        }).filter((p) => p !== null) as any[];
    } catch (e) {
        return null;
    }
  }, []);

  const processJsonData = useCallback((content: string, selectedPlatform: Platform) => {
    if (!content.trim()) return;
    addLogEvent('Processando dados...', 'info');
    setTimeout(() => {
        try {
            let data = JSON.parse(content);
            let sourcePlayers = Array.isArray(data) ? data : [data];
            const parsedPlayers = sourcePlayers.map(p => {
                if (typeof p === 'string') return { name: p.trim(), imageUrl: DEFAULT_AVATAR };
                let name = p.name || p.username || p.full_name || p.id;
                let imageUrl = p.profile_pic_url || p.profile_pic_url_hd || p.avatar_url || DEFAULT_AVATAR;
                return name ? { name: name.trim(), imageUrl: getSafeImageUrl(imageUrl) } : null;
            }).filter(p => p !== null) as any[];
            initializePlayers(parsedPlayers);
        } catch (e) {
            alert('Falha ao analisar os dados.');
        }
    }, 50);
  }, [addLogEvent, initializePlayers]);

  const processFile = useCallback((file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result as string;
        processJsonData(content, platform);
    };
    reader.readAsText(file);
  }, [processJsonData, platform]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processFile(file);
  }, [processFile]);

  const loadInstagramData = useCallback(async (silent = false) => {
    if (!silent) setIsAutoLoading(true);
    try {
      const response = await fetch('./followers.json');
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data)) initializePlayers(data);
    } catch (e) {
        console.error(e);
    } finally {
      if (!silent) setIsAutoLoading(false);
    }
  }, [initializePlayers]);

  // auto-load latest results on mount (silent)
  useEffect(() => {
    loadInstagramData(true);
  }, [loadInstagramData]);

  const scrapeFromBot = useCallback(async (username: string) => {
    if (!username) return;

    // Verificar se estamos em ambiente local (o robô só funciona localmente)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (!isLocal) {
        setBotStatus('error');
        setBotError('O Robô (Scraper) só funciona rodando LOCALMENTE. No GitHub, você pode atualizar os seguidores acessando a aba "Actions" e executando o workflow "Update Instagram Followers", ou simplesmente carregando um arquivo JSON manualmente.');
        return;
    }

    setBotStatus('running');
    setBotError(null);
    setBotLogs([]);
    addLogEvent(`Iniciando robô para @${username}...`, 'info');

    try {
        const response = await fetch(`/api/scrape?username=${username.replace('@', '')}&key=${licenseKey}`);
        if (response.status === 401) {
            setIsAuthorized(false);
            throw new Error('Chave inválida ou já utilizada.');
        }
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Falha no leitor de stream.');
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            const lines = text.split('\n\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const log = line.replace('data: ', '').trim();
                    if (log.startsWith('DONE: ')) {
                        const code = log.replace('DONE: ', '').trim();
                        if (code === '0') {
                            setBotStatus('success');
                            addLogEvent(`Extração concluída! Baixando arquivo...`, 'info');
                            
                            // Auto-download logic
                            const link = document.createElement('a');
                            link.href = './followers.json';
                            link.download = 'followers.json';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        } else {
                            setBotStatus('error');
                            setBotLogs(prev => [...prev, `Erro no Robô: Código ${code}`]);
                        }
                    } else if (log) {
                        setBotLogs(prev => [...prev.slice(-100), log]);
                    }
                }
            }
        }
    } catch (err: any) {
        setBotStatus('error');
        setBotError(err.message);
    }
  }, [addLogEvent, licenseKey]);

  return {
    players, setPlayers,
    playersRef,
    profileName, setProfileName,
    platform, setPlatform,
    jsonInput, setJsonInput,
    totalPlayersRef,
    initializePlayers,
    parseCsvData,
    processJsonData,
    processFile,
    handleFileUpload,
    loadInstagramData,
    scrapeFromBot,
    isAutoLoading,
    botStatus,
    botError,
    botLogs,
    allPlayersRef,
    licenseKey, setLicenseKey,
    isAuthorized,
    isAdmin,
    isValidatingKey,
    checkLicense
  };
};
