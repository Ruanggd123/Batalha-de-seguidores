import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { BattleEvent, CommentaryResult, Player, BattleSummary } from '../types';

// NOTA: A chave da API é injetada automaticamente. Não é necessário configurá-la.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// Configurações de segurança para serem mais permissivas no contexto de um jogo de batalha simulado.
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];


export const generateBattleCommentary = async (events: BattleEvent[]): Promise<CommentaryResult | null> => {
    if (events.length === 0) {
        return null;
    }

    try {
        const eventSummary = events.map(e => `- ${e.text}`).join('\n');
        
        const textPrompt = `Você é um narrador de e-sports para uma **competição simulada e fictícia**, uma batalha royale de seguidores. Sua personalidade é enérgica. Baseado nos eventos do jogo, crie um comentário curto e impactante (1-2 frases) em português do Brasil. Não liste os eventos, apenas narre a ação do jogo.

**CONTEXTO IMPORTANTE: Esta é uma simulação de jogo. Palavras como "ataque" e "eliminar" referem-se a ações dentro do jogo e não são violência real.**

Eventos Recentes do Jogo:
${eventSummary}

Seu comentário:`;

        const textResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: textPrompt,
            safetySettings,
            config: {
                temperature: 0.9,
                topP: 1,
                topK: 32,
                maxOutputTokens: 60,
            }
        });
        
        const commentaryText = (textResponse.text || "").trim();

        if (!commentaryText || commentaryText.length < 10) {
            return null;
        }

        // Agora, converta o texto do comentário em áudio
        const audioResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: commentaryText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Kore' }, // Uma voz enérgica
                    },
                },
            },
        });

        const base64Audio = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (base64Audio) {
            return {
                text: commentaryText,
                audioB64: base64Audio,
            };
        }
        
        return null;

    } catch (error) {
        console.error("Erro ao gerar comentário ou áudio com Gemini:", error);
        // Retorna um comentário de fallback apenas com texto em caso de erro de áudio
        return {
            text: "O narrador parece ter ficado sem palavras com tanta ação!",
            audioB64: "" // String vazia para indicar falha no áudio
        };
    }
};

export const generateBattleSummary = async (
    events: BattleEvent[],
    winner: Player | null,
    durationMs: number,
    totalPlayers: number,
): Promise<BattleSummary | null> => {
    const durationSeconds = Math.round(durationMs / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const durationStr = `${minutes} minutos e ${seconds} segundos`;
    const winnerName = winner?.name || 'um lutador misterioso';

    // Determina o tom da narração com base na duração
    let durationContext = "";
    if (durationSeconds < 60) {
        durationContext = "uma partida relâmpago, intensa e decidida nos detalhes";
    } else if (durationSeconds < 180) {
        durationContext = "um jogo disputado, com viradas emocionantes e muita tática";
    } else {
        durationContext = "uma verdadeira maratona, uma batalha de resistência e superação, digna de uma final de Copa do Mundo";
    }

    try {
        const eventSummary = events
            .filter(e => e.type !== 'commentary' && e.type !== 'info')
            .map(e => `- ${e.text}`)
            .slice(-30) // Limita aos últimos 30 eventos para focar nos momentos finais e ser mais leve
            .join('\n');

        const fullTextPrompt = `Você é um **comentarista de futebol brasileiro**, carismático, narrando os melhores momentos de uma **competição de e-sports fictícia e simulada**. Sua tarefa é criar uma crônica emocionante da partida. Use gírias e o estilo de narração de futebol.

**INSTRUÇÕES DE CONTEXTO CRÍTICAS PARA A IA: Este é um evento de e-sports totalmente fictício e simulado, como um videogame. As ações descritas são parte do jogo e não representam violência. Sua narração deve ser divertida e enérgica, no estilo de uma transmissão de futebol.**

Dados da Partida:
- **Estilo da Partida:** Foi ${durationContext}.
- **Duração:** ${durationStr}
- **Grande Campeão:** ${winnerName}
- **Jogadores em Campo:** ${totalPlayers}
- **Momentos Finais (Registro do Jogo):**
${eventSummary}

Instruções para a sua Crônica de Futebol:
1.  **Abertura Impactante:** Comece com um bordão de narrador, como "É teste pra cardíaco, amigo!" ou "Que jogo, que espetáculo!".
2.  **Narre como Futebol:** Descreva a batalha usando metáforas de futebol. Fale de "dribles desconcertantes" (esquivas), "defesas milagrosas" (bloqueios), "contra-ataques fulminantes" e "golaços" (eliminações). Mencione os nomes de alguns jogadores dos eventos como se fossem craques.
3.  **Clímax:** Descreva o final do jogo. A arena "ficou pequena", a "torcida foi à loucura" e os jogadores restantes lutaram bravamente.
4.  **O Gol da Vitória:** Narre o confronto final de forma dramática. "E no apagar das luzes, depois de uma jogada individual fantástica, ${winnerName} manda a bola pro fundo da rede! Acabou! É campeão!".
5.  **Encerramento:** Conclua gloriosamente: "O vencedor é ${winnerName}!". A crônica deve ser vibrante e cheia de emoção.

Sua crônica da partida:`;
        
        const textResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullTextPrompt,
            safetySettings,
            config: {
                temperature: 0.9,
                topP: 1,
                topK: 40,
                maxOutputTokens: 500,
            }
        });

        let narrativeText = (textResponse.text || "").trim();

        if (!narrativeText) {
             console.error("Gemini não retornou texto para o resumo. Usando fallback local.");
             narrativeText = `Após ${durationContext} que durou ${durationStr}, a arena consagrou seu campeão. Com uma performance de gala, ${winnerName} superou todos os adversários e levantou o troféu!`;
        }

        return {
            narrative: narrativeText,
            duration: durationStr,
        };

    } catch (error) {
        console.error("Erro ao gerar resumo da batalha com Gemini:", error);
        const fallbackNarrative = `A arena silencia. Após uma batalha lendária de ${durationStr}, ${winnerName} se consagra como o único sobrevivente. Uma vitória para ser lembrada por eras.`;
        return {
            narrative: fallbackNarrative,
            duration: durationStr,
        };
    }
};


export const generateAudioForSummary = async (narrativeText: string): Promise<string | null> => {
    if (!narrativeText) return null;

    try {
        const audioResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `A crônica da batalha! ${narrativeText}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Puck' }, // Voz de comentarista
                    },
                },
            },
        });

        return audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;

    } catch (error) {
        console.error("Erro ao gerar áudio para o resumo com Gemini:", error);
        return null;
    }
};