
import { BattleEvent, Player } from '../types';

const ATTACK_PHRASES = [
  "Olha a pressão!",
  "Que jogada!",
  "Vai pra cima com tudo!",
  "Não dá nem tempo de respirar!",
  "Drible desconcertante!",
  "Ataque fulminante!",
  "Tentativa perigosa!",
  "Espaço no campo!",
  "Pressão total na arena!",
];

const ELIMINATION_PHRASES = [
  "Está fora! {name} se despede da arena!",
  "Acabou o sonho para {name}!",
  "Eliminação confirmada! {name} caiu!",
  "Mandou pro chuveiro mais cedo!",
  "Ninguém segura! {name} foi pro ralo!",
  "Cartão vermelho direto! {name} está fora!",
  "O último a sair apaga a luz! Tchau, {name}!",
];

const AOE_PHRASES = [
  "DESTRUIÇÃO EM MASSA!",
  "A terra tremeu agora!",
  "Ninguém escapa desse impacto!",
  "É um verdadeiro massacre!",
  "O caos tomou conta da arena!",
  "Explosão de poder absurda!",
];

const WINNER_PHRASES = [
  "É CAMPEÃO! {name} levanta a taça!",
  "A ARENA É DELE! {name} vence a batalha royale!",
  "VITÓRIA ÉPICA! {name} é o único sobrevivente!",
  "PODE COMEMORAR! {name} se consagra o grande vencedor!",
  "HISTÓRICO! {name} supera todos os obstáculos!",
];

const GENERAL_INFO = [
  "A tensão é palpável na arena!",
  "Quem será que vai levar essa?",
  "Os nervos estão à flor da pele!",
  "A torcida vai à loucura!",
  "Que espetáculo estamos presenciando!",
  "Cena digna de um grande clássico!",
  "A adrenalina corre nas veias!",
  "Cada movimento pode ser o último!",
  "Estamos vendo história ser escrita hoje!",
  "Inacreditável a determinação desses seguidores!",
];

const getRandomPhrase = (phrases: string[]): string => {
  if (phrases.length === 0) return "A batalha continua intensa!";
  return phrases[Math.floor(Math.random() * phrases.length)];
};

export const getLocalCommentary = (events: BattleEvent[], excludeList: string[] = []): string => {
  if (events.length === 0) return "";
  
  const isExcluded = (p: string) => excludeList.some(ex => p.includes(ex) || ex.includes(p));

  // Decidir qual evento narrar (preferência para eliminação > aoe > attack)
  const elimination = events.find(e => e.type === 'elimination');
  if (elimination) {
    const raw = getRandomPhrase(ELIMINATION_PHRASES.filter(p => !isExcluded(p)));
    // Tenta extrair o nome do evento se possível
    const nameMatch = elimination.text.match(/^([^ ]+)/);
    const name = nameMatch ? nameMatch[1] : "O competidor";
    return raw.replace("{name}", name);
  }

  const aoe = events.find(e => e.type === 'aoe');
  if (aoe) {
    return getRandomPhrase(AOE_PHRASES.filter(p => !isExcluded(p)));
  }

  const attack = events.find(e => e.type === 'attack');
  if (attack && Math.random() > 0.5) {
    return getRandomPhrase(ATTACK_PHRASES.filter(p => !isExcluded(p)));
  }

  return getRandomPhrase(GENERAL_INFO.filter(p => !isExcluded(p)));
};

export const getLocalSummary = (winner: Player | null, duration: string, excludeList: string[] = []): string => {
  if (!winner) return "";
  const isExcluded = (p: string) => excludeList.some(ex => p.includes(ex) || ex.includes(p));
  const raw = getRandomPhrase(WINNER_PHRASES.filter(p => !isExcluded(p)));
  return raw.replace("{name}", winner.name);
};
