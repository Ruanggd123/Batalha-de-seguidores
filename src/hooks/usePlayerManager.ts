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
  const [githubToken] = useState(() => (import.meta.env.VITE_GITHUB_TOKEN as string) || '');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [listMetadata, setListMetadata] = useState<{ lastUpdate: string; username: string; count: number } | null>(null);

  // Persistence for Github Token
  useEffect(() => {
    localStorage.setItem('battleRoyale_githubToken', githubToken);
  }, [githubToken]);

  // Trigger GitHub Action (Scraper) via API
  const triggerGithubAction = useCallback(async (username: string) => {
    if (!username) {
        setBotStatus('error');
        setBotError('Usuário não fornecido.');
        return;
    }

    if (!githubToken) {
        setBotStatus('error');
        setBotError('Configuração de API do GitHub incompleta (VITE_GITHUB_TOKEN ausente).');
        return;
    }

    setBotStatus('running');
    setBotError(null);
    setBotLogs(['Iniciando comando remoto via GitHub API...', 'Aguardando resposta do servidor...']);

    try {
        const response = await fetch('https://api.github.com/repos/Ruanggd123/Batalha-de-seguidores/actions/workflows/update_followers.yml/dispatches', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({
                ref: 'main',
                inputs: {
                    username: username.replace('@', ''),
                }
            })
        });

        if (response.status === 204) {
            setBotStatus('success');
            setBotLogs(prev => [...prev, '✅ SUCESSO! O GitHub começou a processar sua lista.', 'Aguarde cerca de 2-3 minutos e o site será atualizado sozinho.']);
            addLogEvent(`Comando enviado ao GitHub para @${username}! A extração leva 2-3 min.`, 'info');
            
            // Queimar a licença se não for admin
            if (!isAdmin) {
                const burned = await burnLicense(licenseKey);
                if (burned) {
                    addLogEvent('Chave de licença utilizada com sucesso.', 'info');
                    setBotLogs(prev => [...prev, '🎫 LICENÇA CONSUMIDA: Esta chave não poderá ser usada novamente.']);
                    
                    // Trava de segurança: Desautorizar imediatamente após o uso
                    setIsAuthorized(false);
                    setLicenseKey('');
                    localStorage.removeItem('battleRoyale_licenseKey');
                }
            }
        } else {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || `Erro do GitHub: ${response.status}`);
        }
    } catch (err: any) {
        setBotStatus('error');
        setBotError(`Falha ao disparar Robô: ${err.message}`);
    }
  }, [githubToken, addLogEvent]);

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
      setBotError("Nenhum jogador encontrado no arquivo.");
      setBotStatus('error');
      return;
    }
    totalPlayersRef.current = parsedPlayers.length;
    addLogEvent(`Carregados ${parsedPlayers.length} lutadores na arena!`, 'info');
    
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
    setPlayers(initialPlayers);
    playersRef.current = initialPlayers;
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

  const processData = useCallback((content: string) => {
    if (!content.trim()) return;
    addLogEvent('Analisando formato dos dados...', 'info');
    
    // Pequeno delay para feedback visual
    setTimeout(() => {
        try {
            // Tenta JSON primeiro
            if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
                const data = JSON.parse(content);
                const sourcePlayers = Array.isArray(data) ? data : [data];
                const parsed = sourcePlayers.map(p => {
                    if (typeof p === 'string') return { name: p.trim(), imageUrl: DEFAULT_AVATAR };
                    let name = p.name || p.username || p.full_name || p.id;
                    let imageUrl = p.imageUrl || p.profile_pic_url || p.profile_pic_url_hd || p.avatar_url;
                    let instagramUrl = p.instagramUrl || p.profile_url || p.link;
                    
                    if (!instagramUrl && name && typeof name === 'string' && name.startsWith('@')) {
                        instagramUrl = `https://www.instagram.com/${name.substring(1)}/`;
                    }
                    
                    if (!imageUrl || imageUrl === '') imageUrl = DEFAULT_AVATAR;
                    return name ? { 
                        name: name.trim(), 
                        imageUrl: getSafeImageUrl(imageUrl),
                        instagramUrl: instagramUrl || undefined
                    } : null;
                }).filter(p => p !== null) as any[];
                
                if (parsed.length > 0) {
                    initializePlayers(parsed);
                    setBotStatus('success');
                } else {
                    throw new Error("Nenhum seguidor válido encontrado no JSON.");
                }
            } else {
                // Tenta CSV
                const parsed = parseCsvData(content);
                if (parsed && parsed.length > 0) {
                    initializePlayers(parsed);
                    setBotStatus('success');
                } else {
                    throw new Error("Não foi possível identificar o formato (JSON ou CSV).");
                }
            }
        } catch (e: any) {
            console.error("Erro no processamento:", e);
            setBotError(`Erro: ${e.message || 'Formato de arquivo inválido.'}`);
            addLogEvent('Falha ao processar os dados.', 'info');
            setBotStatus('error');
        }
    }, 100);
  }, [addLogEvent, initializePlayers, parseCsvData]);

  const processFile = useCallback((file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result as string;
        processData(content);
    };
    reader.readAsText(file);
  }, [processData]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processFile(file);
  }, [processFile]);

  const loadInstagramData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsAutoLoading(true);
    try {
      // 1. Fetch metadata first
      const infoUrl = `followers_info.json?t=${Date.now()}`;
      const infoRes = await fetch(infoUrl);
      if (infoRes.ok) {
        const info = await infoRes.json();
        setListMetadata(info);
      }

      // 2. Fetch followers list
      const url = `followers.json?t=${Date.now()}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (!isSilent) {
            setBotError(`Erro ${response.status}: Arquivo não encontrado no servidor.`);
            setBotStatus('error');
        }
        return;
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        initializePlayers(data);
        if (!isSilent) {
            setBotStatus('success');
            setBotLogs(prev => [...prev, '✅ Lista de seguidores carregada com sucesso!']);
        }
      } else {
        if (!isSilent) {
            setBotError('O arquivo de dados está vazio ou no formato incorreto.');
            setBotStatus('error');
        }
      }
    } catch (e) {
        console.warn("Followers data not available:", e);
        if (!isSilent) {
            setBotError('Falha ao ler os dados. Verifique a internet ou aguarde o robô finalizar.');
            setBotStatus('error');
        }
    } finally {
      if (!isSilent) setIsAutoLoading(false);
    }
  }, [initializePlayers]);

  // auto-load removed to ensure app starts at setup screen

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
                            
                            // Queimar a licença se não for admin (Modo Local)
                            if (!isAdmin) {
                                await burnLicense(licenseKey);
                                setIsAuthorized(false);
                                setLicenseKey('');
                                localStorage.removeItem('battleRoyale_licenseKey');
                            }

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

  // Load followers metadata on mount
  useEffect(() => {
    loadInstagramData(true);
  }, [loadInstagramData]);

  return {
    players, setPlayers,
    playersRef,
    profileName, setProfileName,
    platform, setPlatform,
    jsonInput, setJsonInput,
    totalPlayersRef,
    initializePlayers,
    parseCsvData,
    processData,
    processFile,
    handleFileUpload,
    loadInstagramData,
    scrapeFromBot,
    triggerGithubAction,
    isAutoLoading,
    botStatus,
    botError,
    botLogs,
    allPlayersRef,
    licenseKey, setLicenseKey,
    githubToken,
    isAuthorized,
    isAdmin,
    isValidatingKey,
    checkLicense,
    listMetadata
  };
};
