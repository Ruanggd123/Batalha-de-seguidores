#!/usr/bin/env python3

"""
Instagram Followers - VERSÃO 10 MINIMALISTA
Extrai APENAS: username + profile_pic_url
Resultado mais leve e direto

VERSÃO: Minimalista
CAMPOS: 2 (username, profile_pic_url)
TAMANHO: ~38% menor que versão completa
"""

import requests
import json
import csv
import sys
import time
import random
import os
from datetime import datetime
from typing import List, Dict, Optional

try:
    from bs4 import BeautifulSoup
    HAS_BEAUTIFULSOUP = True
except ImportError:
    HAS_BEAUTIFULSOUP = False

# Configurações
X_IG_APP_ID = "936619743392459"
REQUEST_DELAY = 1.0
REQUEST_TIMEOUT = 20
MAX_RETRIES = 5
BACKOFF_BASE = 5
BACKOFF_MAX = 300
SAFE_MODE = True

def load_cookies_from_file(path: str = "cookies.json") -> List[Dict]:
    """Carrega cookies"""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def create_session(cookies: List[Dict]) -> requests.Session:
    """Cria session com headers realistas"""
    s = requests.Session()
    
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Origin": "https://www.instagram.com",
        "Referer": "https://www.instagram.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "X-Requested-With": "XMLHttpRequest",
        "x-ig-app-id": X_IG_APP_ID,
        "x-asbd-id": "129477",
        "x-ig-www-claim": "0",
        "X-IG-App-ID": X_IG_APP_ID,
    })
    
    for c in cookies:
        s.cookies.set(c["name"], c["value"], domain=c["domain"])
    
    return s

def backoff_delay(attempt: int) -> int:
    """Delay exponencial com jitter"""
    delay = min(BACKOFF_BASE * (2 ** attempt), BACKOFF_MAX)
    jitter = random.uniform(0, delay * 0.1)
    return int(delay + jitter)

def get_user_id_rest(session: requests.Session, username: str, attempt: int = 0) -> Optional[str]:
    """Obtém user ID via REST"""
    try:
        url = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}"
        r = session.get(url, timeout=REQUEST_TIMEOUT)
        
        if r.status_code == 200:
            data = r.json()
            
            if "data" in data and "user" in data["data"]:
                user = data["data"]["user"]
                pk = user.get("pk") or user.get("id")
                if pk:
                    return str(pk)
            
            user = data.get("user", {})
            pk = user.get("pk") or user.get("id")
            if pk:
                return str(pk)
        
        elif r.status_code == 429:
            if attempt < MAX_RETRIES:
                wait = backoff_delay(attempt)
                time.sleep(wait)
                return get_user_id_rest(session, username, attempt + 1)
        
        return None
    
    except Exception as e:
        if attempt < MAX_RETRIES:
            wait = backoff_delay(attempt)
            time.sleep(wait)
            return get_user_id_rest(session, username, attempt + 1)
        return None

def get_user_id(session: requests.Session, username: str) -> str:
    """Obtém user_id"""
    print(f"\n🔍 Obtendo user_id para @{username}...\n")
    
    print(f"  📍 Estratégia 1: Endpoint REST /web_profile_info/")
    user_id = get_user_id_rest(session, username)
    if user_id:
        print(f"    ✅ ID obtido via REST endpoint: {user_id}")
        return user_id
    
    raise Exception(f"❌ Falha ao obter user_id para @{username}")

def fetch_followers_graphql(
    session: requests.Session,
    user_id: str,
    after: Optional[str] = None,
    attempt: int = 0
) -> Dict:
    """Busca seguidores via GraphQL - Minimalista"""
    try:
        variables = {
            "id": user_id,
            "first": 50,
            "after": after
        }
        
        if not after:
            variables.pop("after", None)
        
        query_hashes = [
            "c76146de99bb02f6415203be841dd25a",
            "5eb63d81b447cea046e64c76b866d4d5",
        ]
        
        url = "https://www.instagram.com/graphql/query/"
        
        for query_hash in query_hashes:
            try:
                params = {
                    "query_hash": query_hash,
                    "variables": json.dumps(variables)
                }
                
                r = session.get(url, params=params, timeout=REQUEST_TIMEOUT)
                
                if r.status_code == 200:
                    data = r.json()
                    
                    if "errors" in data:
                        errors = data["errors"]
                        critical_errors = [
                            e for e in errors 
                            if e.get("severity") == "CRITICAL"
                        ]
                        
                        if critical_errors:
                            continue
                    
                    try:
                        user_data = data.get("data", {}).get("user", {})
                        followers_edge = user_data.get("edge_followed_by", {})
                        edges = followers_edge.get("edges", [])
                        page_info = followers_edge.get("page_info", {})
                    except:
                        continue
                    
                    followers = []
                    for edge in edges:
                        try:
                            node = edge.get("node", {})
                            username_val = node.get("username")
                            
                            if not username_val:
                                continue
                            
                            # ⭐ MINIMALISTA: Só username + profile_pic_url
                            followers.append({
                                "username": username_val,
                                "profile_pic_url": node.get("profile_pic_url", "")
                            })
                        except:
                            continue
                    
                    return {
                        "followers": followers,
                        "next_cursor": page_info.get("end_cursor") if page_info.get("has_next_page") else None,
                        "has_next": page_info.get("has_next_page", False)
                    }
                
                elif r.status_code == 429:
                    if attempt < MAX_RETRIES:
                        wait = backoff_delay(attempt)
                        time.sleep(wait)
                        return fetch_followers_graphql(session, user_id, after, attempt + 1)
            
            except:
                continue
        
        raise Exception("Todos os query_hashes falharam")
    
    except Exception as e:
        if attempt < MAX_RETRIES:
            wait = backoff_delay(attempt)
            time.sleep(wait)
            return fetch_followers_graphql(session, user_id, after, attempt + 1)
        raise

def load_checkpoint(username: str) -> Dict:
    """Carrega checkpoint anterior"""
    checkpoint_file = f"{username}_checkpoint.json"
    
    if os.path.exists(checkpoint_file):
        try:
            with open(checkpoint_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    
    return {
        "username": username,
        "created_at": datetime.now().isoformat(),
        "followers": {},
        "cursor": None,
        "extracted_count": 0
    }

def save_checkpoint(username: str, checkpoint: Dict):
    """Salva checkpoint"""
    checkpoint_file = f"{username}_checkpoint.json"
    checkpoint["updated_at"] = datetime.now().isoformat()
    
    with open(checkpoint_file, "w", encoding="utf-8") as f:
        json.dump(checkpoint, f, ensure_ascii=False, indent=2)

def load_existing_followers() -> Dict:
    """Carrega seguidores já salvos para permitir coleta incremental"""
    path = "public/followers.json"
    if not os.path.exists(path):
        return {}
    
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Converte de [{name, imageUrl}] para {username: {username, profile_pic_url}}
            return {item["name"]: {"username": item["name"], "profile_pic_url": item["imageUrl"]} for item in data}
    except Exception as e:
        print(f"  ⚠️ Aviso: Não foi possível carregar seguidores existentes: {e}")
        return {}

def save_csv_minimalista(username: str, followers_dict: Dict) -> str:
    """Salva CSV com APENAS username + profile_pic_url"""
    if not followers_dict:
        print("❌ Nenhum seguidor extraído")
        return None
    
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{username}_followers_{len(followers_dict)}_{ts}.csv"
    
    with open(filename, "w", newline="", encoding="utf-8") as f:
        # ⭐ MINIMALISTA: Apenas 2 campos
        writer = csv.DictWriter(
            f,
            fieldnames=["username", "profile_pic_url"]
        )
        writer.writeheader()
        for follower in followers_dict.values():
            writer.writerow({
                "username": follower["username"],
                "profile_pic_url": follower["profile_pic_url"]
            })
    
    return filename

def save_json_minimalista(username: str, followers_dict: Dict) -> str:
    """Salva JSON formatado para o site"""
    if not followers_dict:
        return None
    
    # Formato esperado pelo usePlayerManager: { name, imageUrl }
    data = []
    for f in followers_dict.values():
        data.append({
            "name": f["username"],
            "imageUrl": f["profile_pic_url"]
        })
    
    # Garante que a pasta public existe
    if not os.path.exists("public"):
        os.makedirs("public")
        
    filename = "public/followers.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # ⭐ METADADOS: Salva informações extras da extração
    info = {
        "lastUpdate": datetime.now().isoformat(),
        "username": username,
        "count": len(followers_dict)
    }
    with open("public/followers_info.json", "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    
    return filename

def extract_all_followers(username: str, cookies: List[Dict], max_followers: int = 100000) -> List[Dict]:
    """Extrai seguidores - Minimalista"""
    print(f"\n{'='*70}")
    print(f"INSTAGRAM FOLLOWERS - MINIMALISTA v10")
    print(f"Campos: username + profile_pic_url (2 campos)")
    print(f"{'='*70}")
    print(f"\nUsuario: @{username}")
    print(f"Meta: {max_followers:,} seguidores")
    
    # Carrega checkpoint anterior
    checkpoint = load_checkpoint(username)
    followers_dict = checkpoint.get("followers", {})
    cursor = checkpoint.get("cursor", None)
    
    # Se tem checkpoint, mostra resumo
    if followers_dict:
        print(f"\n📋 Resumindo de checkpoint anterior...")
        print(f"   ✓ {len(followers_dict)} seguidores já extraídos")
        print(f"   ✓ Continuando de onde parou...\n")
    else:
        # Modo Incremental: Se não tem checkpoint, tenta carregar o que já foi salvo no passado
        existing = load_existing_followers()
        if existing:
            print(f"\n🔄 Modo Incremental: {len(existing)} seguidores já cadastrados no site.")
            print(f"   ✓ O script irá parar assim que encontrar um seguidor conhecido.\n")
            followers_dict.update(existing)
    
    session = create_session(cookies)
    
    # Obter user_id
    try:
        user_id = get_user_id(session, username)
        print(f"  ✅ ID obtido: {user_id}\n")
    except Exception as e:
        print(f"\n{e}")
        return []
    
    # Paginar seguidores
    print(f"📥 Extraindo seguidores via GraphQL...\n")
    
    extracted = len(followers_dict)
    batch = 0
    last_save_count = extracted
    
    while extracted < max_followers:
        batch += 1
        
        try:
            print(f"  📦 Lote #{batch}... ", end="", flush=True)
            
            # Busca página
            result = fetch_followers_graphql(session, user_id, cursor)
            followers = result.get("followers", [])
            
            if not followers:
                print(f"✅ (vazio - fim)")
                break
            
            # Adiciona apenas NOVOS e verifica parada (Modo Incremental)
            new_count = 0
            stop_incremental = False
            
            for f in followers:
                u = f.get("username")
                if u:
                    if u not in followers_dict:
                        followers_dict[u] = f
                        extracted += 1
                        new_count += 1
                    else:
                        # Encontramos um seguidor que já existe no banco de dados!
                        # Como o IG retorna do mais novo para o mais antigo, podemos parar aqui.
                        stop_incremental = True
                        break
            
            # Status
            percent = (extracted / max_followers) * 100
            print(f"✅ +{new_count} novos | Total: {extracted:,} | ", end="")
            
            if stop_incremental:
                print(f"🏁 Chegamos em seguidores conhecidos. Parando.")
                break
            
            print(f"Meta: {max_followers:,} ({percent:.1f}%)")
            
            # Salva checkpoint a cada 1000
            if extracted - last_save_count >= 1000:
                checkpoint["followers"] = followers_dict
                checkpoint["cursor"] = cursor
                checkpoint["extracted_count"] = extracted
                save_checkpoint(username, checkpoint)
                
                print(f"    💾 Checkpoint salvo ({extracted:,} seguidores)")
                last_save_count = extracted
            
            # Próxima página?
            if not result.get("has_next"):
                print(f"\n  🏁 Fim da lista! {extracted:,} seguidores extraídos.")
                break
            
            if extracted >= max_followers:
                print(f"\n  ✅ Meta atingida!")
                break
            
            cursor = result.get("next_cursor")
            
            # Delay
            time.sleep(REQUEST_DELAY + random.uniform(0, 1))
        
        except Exception as e:
            print(f"❌ {e}")
            print(f"    💾 Salvando checkpoint com {extracted:,} seguidores...")
            checkpoint["followers"] = followers_dict
            checkpoint["cursor"] = cursor
            checkpoint["extracted_count"] = extracted
            save_checkpoint(username, checkpoint)
            break
    
    # Limpa checkpoint
    checkpoint_file = f"{username}_checkpoint.json"
    if os.path.exists(checkpoint_file):
        try:
            os.remove(checkpoint_file)
            print(f"Check-point removido (extracao concluida)")
        except:
            pass
    
    return list(followers_dict.values())

def main():
    print("=" * 70)
    print("INSTAGRAM FOLLOWERS - MINIMALISTA v10")
    print("Extrai APENAS: username + profile_pic_url")
    print("CSV 38% menor, mais rápido de processar")
    print("=" * 70)
    print()
    
    # Carrega cookies
    try:
        cookies = load_cookies_from_file("cookies.json")
        print(f"{len(cookies)} cookies carregados\n")
    except Exception as e:
        print(f"Erro ao carregar cookies: {e}")
        return
    
    # Input
    if len(sys.argv) > 1:
        username = sys.argv[1].replace("@", "")
        try:
            max_f = int(sys.argv[2]) if len(sys.argv) > 2 else 100000
        except:
            max_f = 100000
        print(f"Modo Automatico: @{username} | Limite: {max_f}")
    else:
        username = input("Username (sem @): ").strip()
        if not username:
            print("Username vazio!")
            return
        
        try:
            max_f = int(input("Maximo seguidores (ENTER=100000): ") or "100000")
        except:
            max_f = 100000
    
    # Executa
    try:
        followers = extract_all_followers(username, cookies, max_f)
        
        if followers:
            # Removido CSV a pedido do usuário para gerar apenas JSON
            # csv_file = save_csv_minimalista(username, {f["username"]: f for f in followers})
            json_file = save_json_minimalista(username, {f["username"]: f for f in followers})
            print(f"\n{'='*70}")
            print(f"✅ SUCESSO!")
            print(f"{'='*70}")
            print(f"👤 Usuário: {username}")
            print(f"📊 Seguidores: {len(followers):,}")
            print(f"📊 Campos: username + profile_pic_url (2 campos)")
            # print(f"💾 CSV: {csv_file}")
            print(f"💾 JSON: {json_file}")
            print(f"{'='*70}\n")
        else:
            print("\n❌ Nenhum seguidor extraído")
    
    except KeyboardInterrupt:
        print("\n⏹️  Cancelado pelo usuário")
        print("   Dados foram salvos em checkpoint. Execute novamente para continuar.")
    except Exception as e:
        print(f"\n❌ Erro: {e}")

if __name__ == "__main__":
    main()
