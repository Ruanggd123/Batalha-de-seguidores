# ⚔️ Batalha Royale de Seguidores (50.000+ Players)

![Premium Design](https://img.shields.io/badge/Design-Premium-ff69b4?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Vite%20%7C%20Python-blueviolet?style=for-the-badge)
![Security](https://img.shields.io/badge/Security-License%20System-yellow?style=for-the-badge)

Uma plataforma de simulação de alta performance capaz de renderizar mais de **50.000 jogadores simultâneos** em uma arena de combate épica. Totalmente integrada com Instagram e TikTok para extração automática de seguidores.

---

## 🚀 Principais Funcionalidades

- **🔥 Performance Extrema**: Motor de física otimizado para milhares de entidades via Canvas 2D.
- **🤖 Robô de Extração (V10)**: Script Python minimalista integrado para coletar seguidores reais em segundos.
- **🎙️ Narrador IA**: Narração dinâmica dos eventos da batalha com suporte a múltiplas vozes.
- **🔐 Sistema de Licenciamento**: Controle total de acesso via Chave Mestra e Chaves de Uso Único.
- **📥 Auto-Download**: Geração e download automático de resultados em `followers.json`.
- **🌐 Cloud Sync**: Sincronização automática via GitHub Actions para deploy estático.

---

## 🔐 Sistema de Licenciamento (Admin)

O projeto conta com uma camada de segurança para monetização e controle:

1.  **Chave Mestra**: Defina sua senha de administrador no arquivo `keys.json`.
2.  **Painel do Dono**: Ao inserir a Chave Mestra no site, um painel exclusivo é liberado para **Gerar Novas Chaves**.
3.  **Chaves de Uso Único**: Entregue essas chaves aos seus clientes. Elas são invalidadas automaticamente após o primeiro uso do robô.

---

## 🛠️ Como Instalar e Rodar

### Pré-requisitos
- **Node.js**: Para rodar a interface web.
- **Python 3.10+**: Para o robô de extração.

### Passo a Passo

1. **Instalação de Dependências**:
   ```bash
   npm install
   pip install requests beautifulsoup4
   ```

2. **Configuração de Cookies**:
   Crie um arquivo `cookies.json` na raiz com seus cookies do Instagram para o robô funcionar sem bloqueios.

3. **Rodar o Projeto**:
   ```bash
   npm run dev
   ```
   Acesse `http://localhost:3000`.

---

## 📂 Estrutura do Projeto

- `/components`: Componentes visuais (Arena, Setup, UI).
- `/hooks`: Lógica de motor de batalha e gerenciamento de jogadores.
- `/constants`: Configurações de física, áudio e temas.
- `instagram_v10_minimalista.py`: O robô de extração.
- `vite.config.ts`: A ponte inteligente (API Bridge) entre o Web e o Python.

---

## 🎨 Temas Disponíveis
- **Clássico**: Púrpura Neon.
- **Abismo Gravitacional**: Azul Indigo e Cyan.
- **Vórtice Aniquilador**: Laranja e Vermelho Intenso.

---

## ⚖️ Licença
Este projeto é de uso restrito conforme configurado em `keys.json`.

---
*Desenvolvido com foco em alta performance e experiência premium.*
