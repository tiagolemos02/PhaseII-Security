# FIWARE Digital Twin Security Platform

Plataforma completa FIWARE com gestão de identidade, monitorização IoT e visualização de gémeos digitais. Sistema integrado demonstrando segurança, contexto NGSI-v2 e comunicação MQTT em tempo real.

## Identificação do Projeto

**Repositório**: `tiagolemos02/PhaseII-Security/keyrock+orion`  
**Versão**: `v2.0.0`  
**Autor**: Tiago Lemos  
**Licença**: MIT

## 1. Prerequisitos

- **Docker** & **Docker Compose** 
- **Python 3** (para servir o front-end)
- **Browser moderno** (Chrome, Firefox, Safari, Edge)

## 2. Arquitetura

### Stack Backend (Docker)
| Componente | Imagem / Versão | Rede | Porta |
|------------|-----------------|------|-------|
| **Keyrock** | `quay.io/fiware/idm:8.4.0` | fiware_net | 3005 |
| **MySQL** | `mysql:8.0` | fiware_net | 3306 |
| **Orion** | `quay.io/fiware/orion:latest` | fiware_net | 1026 |
| **MongoDB** | `mongo:latest` | fiware_net | 27017 |
| **IoT Agent** | `lemostiago/custom-iotagent:latest` | fiware_net | 4041 |
| **Mosquitto** | `eclipse-mosquitto` | fiware_net | 1883, 9001 |

### Frontend Application
| Componente | Tecnologia | Função |
|------------|------------|---------|
| **Interface** | `index.html` (SPA) | Dashboard principal |
| **Estilos** | `styles.css` (Inter font) | UI moderna e responsiva |
| **JavaScript** | ES6 modular | 8 módulos especializados |
| **3D Models** | `.glb` files | Visualização de gémeos digitais |

### Networking & Security
- **Rede isolada**: `172.18.1.0/24` (Docker bridge)
- **Secrets management**: `secrets.txt`
- **CORS**: Restrito a `http://localhost:8000`
- **Health checks**: Monitorização automática de serviços

## 3. Docker Compose

Ficheiro completo dentro da pasta `/docker_compose`

```yaml
version: "3.9"

services:
  # Identity Management
  keyrock:
    image: quay.io/fiware/idm:${KEYROCK_VERSION}
    ports: ["3005:3005", "3443:3443"]
    environment:
      - IDM_ADMIN_EMAIL=admin@test.com
      - IDM_ADMIN_PASS=fiware
      - CORS_ENABLED=true
      - CORS_ALLOWED_ORIGINS=http://localhost:8000
    
  # Context Management  
  orion-v2:
    image: quay.io/fiware/orion:latest
    ports: ["1026:1026"]
    command: -dbURI mongodb://mongo-db -corsOrigin __ALL
    
  # IoT Communication
  iot-agent:
    image: lemostiago/custom-iotagent:latest
    ports: ["4041:4041"]
    environment:
      - IOTA_CB_HOST=orion
      - IOTA_MQTT_HOST=mosquitto
      
  # MQTT Broker
  mosquitto:
    image: eclipse-mosquitto
    ports: ["1883:1883", "9001:9001"]
```

**Configuração completa**: `docker-compose.yml` + `.env` + `secrets.txt`

## 4. Frontend Architecture

### Módulos JavaScript (ES6)

| Módulo | Responsabilidade |
|--------|------------------|
| `main.js` | Inicialização e coordenação de eventos |
| `auth.js` | Autenticação OAuth2 e gestão de sessão |
| `config.js` | Endpoints API e configuração FIWARE |
| `users.js` | Operações de gestão de utilizadores |
| `orion-logs.js` | Integração com Context Broker |
| `digital-twin.js` | Visualizador 3D de gémeos digitais |
| `ui-helpers.js` | Navegação por tabs e interações UI |
| `dom-elements.js` | Referências centralizadas de elementos DOM |

### Funcionalidades

#### **Login & Segurança**
- OAuth2 authentication com Keyrock
- Gestão automática de tokens (`X-Subject-Token`)
- Validação de sessão e logout seguro

#### **Gestão de Utilizadores**
- Listagem completa via API Keyrock
- Criação de novos utilizadores
- Estados visuais (ativo/inativo)
- Refresh automático

#### **Monitorização IoT**
- Dados em tempo real do Orion Context Broker
- Filtros por dispositivo e atributo
- Latência e timestamps
- Refresh automático (1s intervals)

#### **Gémeo Digital 3D**
- Visualizador `.glb` integrado
- Auto-rotação com pausa interativa
- Modelos em `models/` folder
- Loading states

#### **Interface Responsiva**
- Design moderno com Inter font
- Hover effects e transições
- Navegação por tabs
- Estados disabled/enabled

## 5. Fluxo de Uso

### **Inicialização**
```bash
# 1. Clone e setup
git clone https://github.com/tiagolemos02/PhaseII-Security/keyrock+orion.git
cd keyrock+orion

# 2. Levantar stack FIWARE
docker-compose up -d

# 3. Verificar serviços
docker-compose ps
docker logs fiware-keyrock --tail 20

# 4. Servir frontend
python3 -m http.server 8000

# 5. Aceder aplicação
# → http://localhost:8000
```

### **Interface Web**
1. **Login** → `admin@test.com` / `fiware`
2. **User Management** → Lista e criação de utilizadores
3. **Orion Logs** → Monitorização IoT em tempo real
4. **Digital Twin** → Visualização 3D de máquinas
5. **Security Dashboard** → Controlo de acesso (futuro)

### **Comportamento Dinâmico**
- Secções **bloqueadas** até login bem-sucedido
- **Auto-refresh** de dados IoT (1s)
- **Token management** automático
- **Estados visuais** para dispositivos
- **3D interaction** com pause/resume

## 6. Data simulation via ESP32

- Os dados e máquinas são simalados via ESP32. Esta abordagem já foi introduzida na versão 1.0.
- Nesta versão foram revistos os seguintes pontos:
    - Organização estrutural;
    - Simplificação de código;
    - Fácil e intuitiva integração de várias máquinas apenas copiando e seguindo as instruções no ficheiro `MQTTSimulator/config.h`

## 7. API Integration

### **Keyrock (Authentication)**
```javascript
// Login
POST http://localhost:3005/v1/auth/tokens
Headers: Content-Type: application/json
Body: {"name": "admin@test.com", "password": "fiware"}

// List Users  
GET http://localhost:3005/v1/users
Headers: X-Auth-Token: <session_token>

// Create User
POST http://localhost:3005/v1/users
Headers: X-Auth-Token: <session_token>
```

### **Orion Context Broker (IoT)**
```javascript
// Get Entities
GET http://localhost:1026/v2/entities
Headers: 
  fiware-service: openiot
  fiware-servicepath: /

// Entity Configuration
Entity Type: "Machine"
Attributes: temperature, pressure, status, etc.
```

### **IoT Agent (Device Provisioning)**
```javascript
// Provision Service
POST http://localhost:4041/iot/services
Headers: 
  fiware-service: openiot
  fiware-servicepath: /

// Register Device
POST http://localhost:4041/iot/devices
```

## 8. Exemplos cURL

### **Authentication Flow**
```bash
# Login e obter token
curl -i -X POST http://localhost:3005/v1/auth/tokens \
  -H "Content-Type: application/json" \
  -d '{"name":"admin@test.com","password":"fiware"}'

# Extrair X-Subject-Token do header de resposta
TOKEN="gAAAAABh..."

# Listar utilizadores
curl -X GET http://localhost:3005/v1/users \
  -H "X-Auth-Token: $TOKEN"
```

### **IoT Data Flow**
```bash
# Enviar dados via MQTT
mosquitto_pub -h localhost -p 1883 \
  -t "/ul/4jggokgpepnvsb2uv4s40d59ov/machine001/attrs" \
  -m "t|23.5|p|1013.2|s|running"

# Consultar contexto
curl -X GET http://localhost:1026/v2/entities \
  -H "fiware-service: openiot" \
  -H "fiware-servicepath: /"
```

## 9. File Structure

```
keyrock+orion/
├── docker_compose/
│    ├── docker-compose.yml                # Orchestração FIWARE
│    ├── .env                              # Variáveis ambiente
│    ├── secrets.txt                       # Credenciais seguras
│    └── mosquitto/
│         └── mosquitto.conf               # Config MQTT broker
├── web/                                   # Frontend application
│    └── digital-twin-portal/
│         ├── index.html                   # Interface principal
│         ├── css/
│         │    └── styles.css              # Estilos modernos
│         ├── js/
│         │    ├── main.js                 # App initialization
│         │    ├── auth.js                 # Authentication
│         │    ├── config.js               # API endpoints
│         │    ├── users.js                # User management
│         │    ├── orion-logs.js           # IoT monitoring
│         │    ├── digital-twin.js         # 3D viewer
│         │    ├── ui-helpers.js           # UI utilities
│         │    └── dom-elements.js         # DOM references
│         └── models/                      # 3D Digital Twin assets
│              ├── base_basic_pbr.glb      # Modelo principal
│              └── base_basic_shaded.glb   # Componentes visuais
├── MQTTSimulator/
│    ├──src/
│    │    ├── connectivity/
│    │    │    ├── mqtt_manager.cpp        # MQTT communication logic
│    │    │    ├── mqtt_manager.h          # MQTT connect interface
│    │    │    ├── wifi_manager.cpp        # Wifi connection code  
│    │    │    └── wifi_manager.h          # wifi connect interface
│    │    ├── sensors/
│    │    │    ├── machine_config.cpp      # Data publishing logic
│    │    │    ├── machine_config.h        # Machine IDs list 
│    │    │    ├── sensor_generators.cpp   # Sensor value logic
│    │    │    └── sensor_generators.h     # Sensor types, interface
│    │    └── utils/
│    │         ├── helpers.cpp             # Random float implementation
│    │         └── helpers.h               # Random float helper 
│    ├── config.h                          # Configuration wifi/mqtt
│    └── MQTTSimulator.ino                 # Main simulation logic
└── README.md                              # Esta documentação
```

## 10. Desenvolvimento & Customização

### **Adicionar Dispositivos IoT**
1. **Provisionar** via IoT Agent API
2. **Configurar** tipo de entidade no Orion
3. **Atualizar** filtros no frontend (`orion-logs.js`)

### **Novos Modelos 3D**
1. **Adicionar** ficheiros `.glb` em `models/`
2. **Configurar** em `digital-twin.js`
3. **Testar** loading e interações

### **Extensões Frontend**
1. **Novos módulos** → seguir padrão ES6
2. **UI components** → usar classes CSS existentes  
3. **API calls** → centralizar em módulos específicos

## 11. Troubleshooting

### **Serviços não iniciam**
```bash
# Verificar portas livres
netstat -tlnp | grep -E "(3005|1026|4041|1883)"

# Logs detalhados
docker-compose logs -f keyrock
docker-compose logs -f orion-v2

# Reset completo
docker-compose down -v
docker-compose up -d
```

### **Frontend não carrega dados**
```bash
# Testar APIs diretamente
curl http://localhost:3005/version     # Keyrock
curl http://localhost:1026/version     # Orion
curl http://localhost:4041/iot/about   # IoT Agent

# Verificar CORS
curl -H "Origin: http://localhost:8000" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS http://localhost:3005/v1/auth/tokens
```

### **Modelos 3D não carregam**
- Verificar ficheiros `.glb` em `models/`
- Confirmar path correto em `digital-twin.js`
- Testar loading no browser DevTools

## 12. Licença

MIT © Tiago Lemos

---

*Plataforma construída com FIWARE Generic Enablers e tecnologias web modernas*
