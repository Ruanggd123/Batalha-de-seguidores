// A lista de poderes foi expandida e a geração agora é local e síncrona.
const LOCAL_POWER_NAMES = [
  "Soco de Píxel", "Fúria do Algoritmo", "Tempestade de Likes", "Canhão de Spam", "Escudo de Firewall", "Giga-Impacto", "Onda Psíquica Digital", "Lâmina de Plasma", "Feixe de Fótons", "Meteoro de Emojis", "Vórtice de Gifs", "Tsunami de Memes", "Rajada de Notificações", "Invocação de Bots", "Lag Obscuro", "Força Bruta", "Olhar 404", "DDOS do Destino", "Vírus Corrosivo", "Barreira de Captcha",
  "Grito Sônico", "Hiperlink da Perdição", "Buffer Overflow", "Zero-Day Exploit", "Malware Magnético", "Rage Quit Final", "Comentário Tóxico", "Bomba Lógica", "Cripto-Tornado", "Escudo de Ads", "Corrente de Blockchain", "Doxxing Divino", "Espada de Phishing", "Modo Avião Supremo", "Terraformação Digital", "Cancelamento em Massa", "Flecha de Fakenews", "Muralha de Paywall", "Anel de Rootkit", "Fantasma da VPN", "Eco da Câmara", "Clickbait Cármico", "Fogo-fátuo de Fomo", "Shuriken de Hashtag", "Chicote de Cookies", "Míssil de Marketing", "Sombra do Stalker", "Armadilha de Typosquatting", "Selo de Autenticação", "Punho do PING", "Canção de Ninar do Dial-up", "Vulnerabilidade do Coração", "Nuvem de Nanites", "Martelo do Ban", "Clarão de Pop-up", "Onda de Unfollow", "Corte de Conexão", "Meteoro de Hardware", "Ciclone de Código", "Prisão de Procrastinação", "Espiral de Dívida Técnica", "Legado do Código Espaguete", "Onda de Refatoração", "Abraço do Open Source", "Sussurro do Subreddit", "Chamado do Discord", "Fúria do F5", "Dança dos Drones", "Feitiço de Formatação", "Miragem de Machine Learning", "Oráculo de API", "Santuário de Sandbox", "Vingança do V-Sync", "Armadura de Adamantium-Wifi", "Lamento da Latência", "Olhar de Debugging", "Passos de Proxy", "Rugido do Render", "Sopro de Servidor", "Toque do Touchscreen", "Valsa da Virtualização", "Zumbido do Cooler", "Chuva Ácida de Clippy", "Fogo Cruzado de Fóruns", "Trovão do Trello", "Terremoto do Teams", "Avalanche do Asana", "Furacão do Figma", "Maremoto do Miro", "Vulcão do VS Code", "Tornado do Terminal", "Nevasca do Notion", "Tempestade do Slack", "Dilúvio de DMs", "Névoa de Notificações", "Raio Rastreador", "Praga de Pixels Mortos", "Maldição da Bateria Fraca", "Assombração do Autocorretor", "Pesadelo da Senha Esquecida", "Vertigem da Verificação em Duas Etapas",
  "Paradoxo do Ponto-e-Vírgula", "Singularidade da String Vazia", "Recursão Infinita da Realidade", "Arco do Array", "Lança da Lista Ligada", "Escudo do Sistema de Tipos", "Adaga da Desestruturação", "Bomba de Descompressão", "Feitiço de Fetch", "Promessa Quebrada", "Ataque do Async/Await", "Canção do Compilador", "Grito do Garbage Collector", "Redemoinho de RegEx", "Selo da Serialização", "Túmulo do Timeout", "Unção da UI/UX", "Veredito do Validador", "Muralha de WebAssembly", "Zênite do Z-Index", "Fragmentação de Frames", "Pulso do Pixel-Perfect", "Harmonia do Hexadecimal", "Coro do CSS", "Balada do Backend", "Fado do Frontend", "Sinfonia do Servidor", "Réquiem da Requisição", "Sonata da Sintaxe", "Ópera da Otimização", "Aria da Acessibilidade", "Interlúdio da Interface", "Marcha do Middleware", "Prece do Pré-processador", "Lamento do Legado", "Hino do Hot-Reload", "Cantiga da CDN", "Fuga da Função Pura", "Glória do Git", "Mantra do Merge", "Voto do Versionamento", "Destino do Deploy", "Ciclo de CI/CD", "Ritual do Rollback", "Profecia do Pós-produção", "Augúrio da Automação",
  "Onda de Choque de 1-bit", "Canhão de 8-bits", "Lâmina de 16-bits", "Fúria de 32-bits", "Universo de 64-bits", "Rajada de Ray Tracing", "Escudo de Shader", "Vórtice de VRAM", "Tempestade de Tesselação", "Impacto da Inteligência Artificial", "Canto da Concorrência", "Paralisia do Padrão de Projeto", "Abismo da Abstração", "Encapsulamento Etéreo", "Herança Harmônica", "Polimorfismo Profético", "Injeção de Independência", "Decreto do desacoplamento", "Solidão do SOLID", "Beijo do KISS", "Secura do DRY", "Grito do YAGNI",
  "Ruptura da Realidade Aumentada", "Colapso da Consciência Coletiva", "Singularidade Simulada", "Eco da Eternidade Digital", "Fragmento de Firewall Celestial", "Lágrima de I.A.", "Pulso do Metaverso", "Sopro do Silício", "Vazio Virtual", "Sonho do Supercomputador"
];

// Algoritmo de Fisher-Yates para embaralhar o array
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Esta função agora gera poderes localmente de forma síncrona.
export const generatePowersForPlayers = (playerNames: string[]): string[] => {
  const count = playerNames.length;
  const shuffledPowers = shuffleArray(LOCAL_POWER_NAMES);
  const generatedPowers: string[] = [];

  for (let i = 0; i < count; i++) {
    // Se precisarmos de mais poderes do que os disponíveis, começamos a reutilizá-los
    generatedPowers.push(shuffledPowers[i % shuffledPowers.length]);
  }

  return generatedPowers;
};
