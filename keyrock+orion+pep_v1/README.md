# Phase II - Security
**This phase brings significant improvements over the previous one.
Please pay attention to the other folders for instructions and explanations of files that have not been changed, as this information has not been transferred here.**

## Identificação do Projeto

**Repositório**: `tiagolemos02/PhaseII-Security/keyrock+orion+pep_v1`  
**Versão**: `v3.0.0`  
**Autor**: Tiago Lemos  
**Licença**: MIT
## Docker Setup

- The deployment adds **Wilma PEP Proxy** as an API gateway positioned in front of Orion Context Broker, serving as a **Policy Enforcement Point (PEP)**.
- Orion exposes internal API only on Docker internal network (port 1026), and its public API is disabled.
- Wilma listens on port 1027 publicly and validates all incoming requests using OAuth2 tokens issued by **Keyrock** Identity Management.
- Keyrock is configured with CORS to allow frontend UI origin (`http://localhost:8000`).
- Wilma PEP Proxy environment variables must specify:
  - `PEP_PROXY_APP_ID`, `PEP_PROXY_USERNAME`, `PEP_PROXY_PASSWORD` for authentication with Keyrock OAuth2.
  - `PEP_PROXY_AUTH_ENABLED` flag controls enforcing authentication (future-ready RBAC).
  - `PEP_PROXY_TENANT_HEADER` set to `Fiware-Service` ensures tenant scoping.
  - CORS headers configured for frontend headers including `authorization`, `x-auth-token`.
- Internal components such as MongoDB, IoT Agent, and Mosquitto communicate normally within the Docker network without PEP proxy intervention (IoT Agent talks directly to Orion).

## Architecture

- **Browser UI** first authenticates against Keyrock OAuth2 endpoint `/oauth2/token` using the **Password Grant** flow, sending username, password, client ID, and secret as URL-encoded form data.
- Keyrock returns an **OAuth2 access token** which the UI stores as `sessionToken` and uses as a **Bearer token** in Authorization headers for all requests.
- For Keyrock admin API interactions (e.g., user management `/v1/users`), the UI must additionally fetch a Keystone admin token by an explicit POST to `/v1/auth/tokens`. This token is sent via `X-Auth-Token` header.
- Wilma PEP Proxy enforces all requests to Orion and IoT Agent by validating the presented OAuth2 token with Keyrock before forwarding the request internally.
- The UI and API clients must also provide multi-tenancy headers: `Fiware-Service` and `Fiware-ServicePath` to scope requests to the desired tenant database.
- This separation of concerns preserves secure northbound access with OAuth2 enforcement, while enabling direct internal component communication.

<img width="1703" height="802" alt="github" src="https://github.com/user-attachments/assets/db6d9d7c-5646-4478-8342-7d74ab37d3f7" />

## Web App

- Authentication is fully transitioned to OAuth2 Password Grant, with token management handling `access_token` and `keystoneToken`.
- Tokens and user session details are safely persisted in browser localStorage enabling session restoration on refresh.
- UI modules implement automated token renewal and error handling for OAuth2 flows, including fallback username resolution for Keystone token retrieval.
- New major frontend components:
  - **inventory.js** manages IoT Agent service groups and machines, interacting with `/iot/services` and `/iot/devices` with session-auth headers.
  - **device-activity.js** derives real-time device "liveness" status by analyzing NGSI entity timestamps from Orion, using a time threshold to classify online/offline.
- UI components uniformly include OAuth2 Bearer and Keystone tokens in API requests.
- The users.js module exclusively uses the Keystone admin token for privileged Keyrock API admin endpoints.
- Log polling and UI tabs are optimized to reduce server load using visibility gating.
- The inventory tab integrates with device-activity events and enriches device info with operational and live status badges.

## Security Measures

- **Permission rules** configured in Keyrock define fine-grained authorization based on HTTP methods and request URL paths, many using regex for flexibility:
  - `DELETE ^/iot/services/?(\?.*)?$` - Delete service group on IoT Agent
  - `POST ^/iot/services/?$` - Create a service group
  - `POST /iot/devices` - Register new devices to IoT Agent
  - `GET /iot/services` - List IoT service groups
  - `GET /v2/entities` - Read Orion entities (keyValues or full)
  - `GET /iot/devices` - List devices registered on IoT Agent
  - `DELETE ^/iot/devices/[^/]+/?(\?.*)?$` - Delete device by ID
- Rules enforce method+path authorization with precise regex anchoring start-`^` and end-`$`, optional trailing slashes `/?`, and optional query parameters `(\?.*)?`.
- Regex covers path parameters like `device_id` to neatly authorize targeted device deletions.
- UI and application logic respect these permissions for necessary ordering: devices cannot be created without a service group; entities are only visible if permissions allow.
- Header enforcement mandates multi-tenancy headers in all API calls consistent with FIWARE conventions to isolate tenant data.
- Forward compatibility is designed for enabling RBAC at the PEP Proxy with `PEP_PROXY_AUTH_ENABLED=true` and potentially adding AuthzForce for policy control later.

## How to Run

Follow these steps to set up and launch the full FIWARE security workflow, including Keyrock, Orion, Wilma PEP proxy, and the front-end Digital Twin Portal.

***

### 1. Start the FIWARE Docker Stack

Navigate to the `docker_compose` directory and run the following command:

```bash
docker compose up -d
```

***

### 2. Configure CORS in Keyrock

Edit Keyrock's configuration file inside the Docker container at `/opt/fiware-idm/config.js` and add the following settings to enable CORS for the web application:

```js
const config = {};

// ... other configuration ...

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

This step is required because CORS defined in the Docker Compose file is insufficient for this version; it must also be set in Keyrock’s own config.js.

Restart Keyrock after editing:

```bash
docker restart fiware-keyrock
```

***

### 3. Register and Configure the Application in Keyrock

- Access Keyrock at [http://localhost:3005](http://localhost:3005) and log in using the admin credentials: `admin@test.com / fiware`.
- Register a new application using your web app URL, typically: `http://localhost:8000/`.
- <img width="978" height="637" alt="1" src="https://github.com/user-attachments/assets/ef10589d-8153-436a-8b37-f6658f2ab6d1" />
- <img width="823" height="738" alt="2" src="https://github.com/user-attachments/assets/9f621818-c19d-4c6e-8463-ab7118c535a4" />
- Set an image for the application (optional).

#### Create Application Roles and Permissions

- Go to the application’s "Roles" section and click "+" to create a role. Name it as you prefer.
- <img width="831" height="525" alt="3" src="https://github.com/user-attachments/assets/c75dbb3b-033c-4c04-a0b7-44ba258f82f2" />
- With the role selected, add the following permissions (select "Is a regular expression?" where noted):
- <img width="836" height="506" alt="4" src="https://github.com/user-attachments/assets/1c3fa38f-c31d-4d04-8ec5-b95c40391c34" />

| Permission name                           | Description                                                                      | HTTP Action | Resource                                           | Regex?          |
|-------------------------------------------|----------------------------------------------------------------------------------|-------------|----------------------------------------------------|-----------------|
| IoT Services — Delete (by path)           | Deleting a service group on the IoT Agent                                        | DELETE      | ^/iot/services/?(\?.*)?$                           | Yes             |
| IoT Services — Create                     | Creating a service group (/iot/services) on the IoT Agent                        | POST        | ^/iot/services/?$                                  | Yes             |
| IoT Devices— Create                       | Registering devices in a service group on the IoT Agent                          | POST        | /iot/devices/                                      | Yes             |
| IoT Services — List                       | Listing existing service groups on the IoT Agent                                 | GET         | /iot/services                                      | Yes             |
| Orion Entities — List/Read (keyValues or full) | Reading data from Orion Context Broker                                      | GET         | /v2/entities                                       | Yes             |
| IoT Devices — List                        | Listing devices the IoT Agent has registered                                     | GET         | /iot/devices                                       | Yes             |
| IoT Devices — Delete (by id)              | Deleting a single device by device_id on the IoT Agent                           | DELETE      | ^/iot/devices/[^/]+/?(\?.*)?$                      | Yes             |

- <img width="810" height="752" alt="5" src="https://github.com/user-attachments/assets/efb702a0-f4cd-4e9b-850a-e3551d40025b" />
***


### 4. Register the PEP Proxy and Set Environment Variables

- Register a new PEP Proxy in Keyrock; copy the Application Id, Pep Proxy Username, and Pep Proxy Password.
- <img width="859" height="394" alt="6" src="https://github.com/user-attachments/assets/53e2e4fd-8f7d-4946-aacf-9d3409db42e2" />
- Add these values to your `.env` file:

```env
# PEP → Keyrock app info (from the “PEP Proxy” box)
PEP_PROXY_APP_ID=
PEP_PROXY_USERNAME=
PEP_PROXY_PASSWORD=
```

- In Keyrock, click OAuth2 Credentials to get the Client ID and Client Secret. Add these to your app’s config.js:

```js
export const KEYROCK_CLIENT_ID = "";
export const KEYROCK_CLIENT_SECRET = "";
```

***

### 5. Assign Permissions to Users and Roles

- Assign the created permissions to the desired role.
- <img width="850" height="593" alt="7" src="https://github.com/user-attachments/assets/7b361b4e-43c3-4222-9de3-f98eca18032a" />
- Set the role for the `admin` user.
- Use Keyrock’s UI: assign the role and permissions visually as shown in the referenced image.
- <img width="601" height="400" alt="8" src="https://github.com/user-attachments/assets/18be747c-37fa-4c51-be12-ea8170d36ab3" />

***

### 6. Recreate Wilma (PEP Proxy) Containers to Apply Changes

Run the following command to force recreation of PEP Proxy containers and ensure new config is applied:

```bash
docker compose up -d --force-recreate orion-proxy iotagent-proxy
```

***

### 7. Start the Frontend Web Application

Open a terminal in the `digital-twin-portal` folder and run:

```bash
python3 -m http.server 8000
```

Access the portal via your browser at:

```
http://localhost:8000/
```

Log in with the admin credentials. You can now create new users, service groups, and machines, and view their states and logs in Orion. Make sure you have at least one device communicating and sending data (e.g., via an MQTT broker) for full visibility in the logs and status screens.

## Licença

MIT © Tiago Lemos

---

*Plataforma construída com FIWARE Generic Enablers e tecnologias web modernas*
