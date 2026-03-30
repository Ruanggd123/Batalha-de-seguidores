import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const KEYS_FILE = path.resolve(__dirname, 'keys.json');

    const getKeys = () => {
        try {
            return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8'));
        } catch (e) {
            return { masterKey: 'MEU_ROBO_ADMIN', validKeys: [] };
        }
    };

    return {
      base: './',
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'terser',
      },

      server: {
        port: 3000,
        host: '0.0.0.0',
        headers: {
          'Cross-Origin-Embedder-Policy': 'unsafe-none',
          'Cross-Origin-Opener-Policy': 'unsafe-none',
        }
      },
      plugins: [
        react(),
        {
          name: 'license-bridge',
          configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
              try {
                // 1. Validar Chave
                if (req.url && req.url.startsWith('/api/keys/validate')) {
                  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                  const key = url.searchParams.get('key');
                  const data = getKeys();
                  
                  console.log(`[API] Validando chave: ${key}`);
                  res.setHeader('Content-Type', 'application/json');
                  
                  if (key === data.masterKey) return res.end(JSON.stringify({ status: 'admin' }));
                  const keyObj = data.validKeys.find(k => k.id === key && !k.used);
                  return res.end(JSON.stringify({ status: keyObj ? 'valid' : 'invalid' }));
                }

                // 2. Gerar Chave (Admin Only)
                if (req.url && req.url.startsWith('/api/keys/generate')) {
                  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                  const adminKey = url.searchParams.get('adminKey');
                  const data = getKeys();

                  console.log(`[API] Tentativa de gerar chave com adminKey: ${adminKey}`);
                  res.setHeader('Content-Type', 'application/json');

                  if (adminKey !== data.masterKey) {
                      res.statusCode = 403;
                      return res.end(JSON.stringify({ error: 'Apenas o dono pode fazer isso!' }));
                  }

                  const newKey = crypto.randomBytes(4).toString('hex').toUpperCase();
                  data.validKeys.push({ id: newKey, used: false, created: new Date() });
                  fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
                  console.log(`[API] Nova chave gerada: ${newKey}`);
                  return res.end(JSON.stringify({ key: newKey }));
                }

                // 3. Scraper (Validar e Queimar Chave)
                if (req.url && req.url.startsWith('/api/scrape')) {
                  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                  const username = url.searchParams.get('username');
                  const key = url.searchParams.get('key');
                  const data = getKeys();
                  
                  let isAuthorized = (key === data.masterKey);
                  
                  // Se não for a master key, tenta validar no Firebase (via REST API para ser mais leve)
                  if (!isAuthorized && key) {
                      try {
                          const firebaseResponse = await fetch(`https://keys-6d05b-default-rtdb.firebaseio.com/licenses/${key}.json`);
                          const firebaseData = await firebaseResponse.json();
                          
                          if (firebaseData && !firebaseData.used) {
                              isAuthorized = true;
                              console.log(`[API] Chave validada via Firebase Cloud: ${key}`);
                          }
                      } catch (err) {
                          console.error("[API] Falha ao consultar Firebase para o Robô:", err);
                      }
                  }

                  if (!isAuthorized) {
                     console.log(`[API] Acesso Negado: Chave ${key} não encontrada ou já utilizada.`);
                     res.statusCode = 401;
                     res.end(JSON.stringify({ error: 'Chave inválida ou já utilizada!' }));
                     return;
                  }

                  // Iniciar Robô
                  if (!username) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Username is required' }));
                    return;
                  }

                  // Notifica o início
                  console.log(`[API] Iniciando Robô para @${username} (Autorizado por ${key})`);
                  
                  res.setHeader('Content-Type', 'text/event-stream');
                  res.setHeader('Cache-Control', 'no-cache');
                  res.setHeader('Connection', 'keep-alive');

                  const commands = ['python', 'python3', 'py'];
                  let cmdIndex = 0;

                  const tryNextCommand = () => {
                      const currentCmd = commands[cmdIndex++];
                      if (!currentCmd) {
                          res.write(`data: ERROR: Não foi possível encontrar um interpretador Python\n\n`);
                          res.end();
                          return;
                      }

                      const bot = spawn(currentCmd, ['instagram_v10_minimalista.py', username, '100000'], {
                          env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
                      });

                      bot.on('error', () => { tryNextCommand(); });
                      bot.stdout.on('data', (d) => res.write(`data: ${d.toString()}\n\n`));
                      bot.stderr.on('data', (d) => res.write(`data: ${d.toString()}\n\n`));
                      bot.on('close', (c) => { res.write(`data: DONE: ${c}\n\n`); res.end(); });
                  };

                  tryNextCommand();
                  return;
                }
              } catch (e) {
                console.error("ERRO NO MIDDLEWARE VITE:", e);
              }
              next();
            });
          }
        }
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
    };
});
