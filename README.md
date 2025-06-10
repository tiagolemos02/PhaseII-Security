
# Keyrock User Management Demo

[![GitHub Release](https://img.shields.io/github/v/release/tiagolemos02/PhaseII-Security)](https://github.com/tiagolemos02/PhaseII-Security/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Issues](https://img.shields.io/github/issues/tiagolemos02/PhaseII-Security)](https://github.com/tiagolemos02/PhaseII-Security/issues)

> **Demo** de gestão de utilizadores FIWARE Keyrock (login, listagem e criação via API REST).

---

## Identificação do Projeto

- **Repositório**: `tiagolemos02/PhaseII-Security`  
- **Versão**: `v1.0.0`  
- **Autor**: Tiago Lemos
- **Licença**: MIT  

---

## 1. Prerequisitos

- **Docker** & **Docker Compose**  
- **Python 3** (para servir o front-end estático)  
- Browser moderno (Chrome, Firefox…)

---

## 2. Arquitetura

| Componente    | Imagem / Versão            | IP fixo      | Porta |
| ------------- | -------------------------- | ------------ | ----- |
| **MySQL**     | `mysql:8.0`                | `172.18.1.6` | 3306  |
| **Keyrock**   | `quay.io/fiware/idm:8.4.0` | `172.18.1.5` | 3005  |
| **Front-end** | `login.html` (vanilla JS)  | localhost    | 8000  |

---

## 3. `docker-compose.yml`

```yaml
services:
  mysql-db:
    restart: always
    image: mysql:${MYSQL_DB_VERSION}
    container_name: db-mysql
    hostname: mysql-db
    expose:
      - "${MYSQL_DB_PORT}"
    ports:
      - "${MYSQL_DB_PORT}:${MYSQL_DB_PORT}"
    networks:
      default:
        ipv4_address: 172.18.1.6
    environment:
      - "MYSQL_ROOT_PASSWORD_FILE=/run/secrets/my_secret_data"
      - "MYSQL_ROOT_HOST:=172.18.1.5"    
    volumes:
      - mysql-db:/var/lib/mysql
    secrets:
      - my_secret_data

  keyrock:
    image: quay.io/fiware/idm:${KEYROCK_VERSION}
    container_name: fiware-keyrock
    hostname: keyrock
    networks:
      default:
        ipv4_address: 172.18.1.5
    depends_on:
      - mysql-db
    ports:
      - "${KEYROCK_PORT}:${KEYROCK_PORT}" # localhost:3005
      - "${KEYROCK_HTTPS_PORT}:${KEYROCK_HTTPS_PORT}" # localhost:3443
    environment:
      - "DEBUG=idm:*"
      # ── DB ──────────────────────────────
      - "IDM_DB_HOST=mysql-db"
      - "IDM_DB_USER=root"
      - "IDM_DB_PASS_FILE=/run/secrets/my_secret_data"
      - "IDM_DB_NAME=keyrock"
      # ── Core settings ───────────────────
      - "IDM_PORT=${KEYROCK_PORT}"
      - "IDM_HOST=http://localhost:${KEYROCK_PORT}"
      - "IDM_HTTPS_ENABLED=${IDM_HTTPS_ENABLED}"
      - "IDM_HTTPS_PORT=${KEYROCK_HTTPS_PORT}"
      # ── Admin user ──────────────────────
      - "IDM_ADMIN_USER=admin"
      - "IDM_ADMIN_EMAIL=admin@test.com"
      - "IDM_ADMIN_PASS=fiware"
      - "IDM_CSP_FORM_ACTION=*"
      # ── CORS ────────────────────────────
      - "CORS_ENABLED=true"
      - "CORS_ALLOWED_ORIGINS=http://localhost:8000"
      - "CORS_ALLOWED_HEADERS=Authorization,Content-Type,X-Auth-Token"
      - "CORS_ALLOWED_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS"
    secrets:
      - my_secret_data
    healthcheck:
      interval: 5s

########################
#  VOLUMES & NETWORKS   #
########################
volumes:
  mysql-db: ~

networks:
  default:
    ipam:
      config:
        - subnet: 172.18.1.0/24

#################
#     SECRETS   #
#################
secrets:
  my_secret_data:
    file: ./secrets.txt
````

- **Rede isolada** com IPs fixos.
    
- **CORS** restrito a `http://localhost:8000`.
    

---

## 4. `/opt/fiware-idm/config.js` (Keyrock)

```js
const config = {};

// … outras configurações …

config.cors = {
  enabled: true,
  options: {
    origin: 'http://localhost:8000',
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: 'Content-Type,X-Auth-Token',
    exposedHeaders: 'X-Subject-Token',
    credentials: undefined,
    maxAge: undefined,
    preflightContinue: false,
    optionsSuccessStatus: 204
  }
};
```

- **allowedHeaders** + **exposedHeaders** para tráfego AJAX e leitura de `X-Subject-Token`.
    
- Após a edição, reinicie:
    
    ```bash
    docker restart fiware-keyrock
    ```
    

---

## 5. Front-end de Testes (`login.html`)

```bash
cd idm-demo
python3 -m http.server 8000
```

### Estrutura

1. **Login** (email+password → `POST /v1/auth/tokens`)
    
2. **Listar Utilizadores** (`GET /v1/users`)
    
3. **Criar Utilizador** (`POST /v1/users`)
    

### Comportamento

- Secções 2 & 3 estão **cinzentas** e **desativadas** até login.
    
- Após login bem-sucedido, removem-se `disabled` e `.disabled` em JS.
    

---

## 6. Fluxo de Uso

1. **Levantar** stack:
    
    ```bash
    docker-compose up -d
    ```
    
2. **Verificar** logs do Keyrock:
    
    ```bash
    docker logs fiware-keyrock --tail 20
    ```
    
3. **Servir** front-end:
    
    ```bash
    cd idm-demo
    python3 -m http.server 8000
    ```
    
4. **Navegar** em `http://localhost:8000`
    
    - Fazer **Login** → esconde form e ativa secções
        
    - **Listar Utilizadores** → tabela com `id`, `username`, `email`, `active`
        
    - **Criar Utilizador** → novo user + recarrega lista
        

---

## 7. Exemplos cURL

- **Login**:
    
    ```bash
    curl -i -X POST \
      -H "Content-Type: application/json" \
      -d '{"name":"admin@test.com","password":"fiware"}' \
      http://localhost:3005/v1/auth/tokens
    ```
    
- **Listar**:
    
    ```bash
    curl -i -X GET \
      -H "Accept: application/json" \
      -H "X-Auth-Token: <session_token>" \
      http://localhost:3005/v1/users
    ```
    
- **Criar**:
    
    ```bash
    curl -i -X POST \
      -H "Content-Type: application/json" \
      -H "X-Auth-Token: <session_token>" \
      -d '{
        "user": {
          "username":"novo",
          "email":"novo@example.com",
          "password":"senha123",
          "description":"desc",
          "website":"https://ex.com",
          "enabled":true
        }
      }' \
      http://localhost:3005/v1/users
    ```
    

---

## 8. Licença

MIT © Tiago Lemos
