# Phase II - Security
**This phase brings significant improvements over the previous one.
Please pay attention to the other folders for instructions and explanations of files that have not been changed, as this information has not been transferred here.**

This README contains **only the changes** compared to the previous version’s README .

## Project Identification

**Repository**: `tiagolemos02/PhaseII-Security/keyrock+orion+pep_v2`  
**Version**: `v1.0.0`  
**Author**: Tiago Lemos  
**Licence**: MIT

## What changed

### ✅ One public entrypoint for both Orion + IoT Agent

**Before** (old setup):

* Orion via PEP: `http://localhost:1027`
* IoT Agent via a second PEP: `http://localhost:4042` 

**Now** (new setup):

* **Single entrypoint (PEP/Wilma):** `http://localhost:1027`
* Nginx routes internally by path:

  * `/v2/*` → Orion (`orion-v2:1026`)
  * `/iot/*` → IoT Agent (`iot-agent:4041`)

So the UI/clients must call:

* Orion: `http://localhost:1027/v2/...`
* IoT Agent: `http://localhost:1027/iot/...`

**But why this changes?**

I simplified my security layer by replacing two redundant PEP proxies with a single PEP in front of an Nginx gateway - since a PEP proxy natively protects only one upstream service at a time, I now route to multiple backend services (and future ones) through Nginx while keeping everything securely behind one PEP, reducing complexity and duplication.


## Docker Compose changes

### Added: `api-gateway` (Nginx)

A new internal service routes requests to Orion/IoT Agent.

**New file**

* `docker_compose/gateway/default.conf`

```nginx
server {
  listen 80;

  location /v2/ { proxy_pass http://orion-v2:1026; }
  location = /version { proxy_pass http://orion-v2:1026/version; }

  location /iot/ { proxy_pass http://iot-agent:4041; }

  location = / { return 404; }
}
```

**Compose snippet**

```yaml
api-gateway:
  image: nginx:alpine
  depends_on:
    - orion-v2
    - iot-agent
  expose:
    - "80"
  volumes:
    - ./gateway:/etc/nginx/conf.d:ro
```

> **Windows note (Docker Desktop):** mount the **folder** (`./gateway:/etc/nginx/conf.d:ro`) instead of mounting the file directly to avoid “default.conf is a directory” issues.


### Removed: second PEP proxy (`iotagent-proxy`)

* Delete the entire `iotagent-proxy` service.
* Port `4042` is no longer used.

This replaces the old “recreate both proxies” step in the previous version 1. 

### Edited: keyrock

- This version includes improvements to **Keyrock**.

The image used is now a **custom Keyrock image**, with **CORS** rules already correctly configured. This means it is no longer necessary to manually edit the configuration file every time `docker compose` starts up, making the environment much more **plug-and-play** and fully functional immediately after a `docker compose up`.


## Architecture

- With the changes, the architecture now looks like the following image:

<img width="1593" height="564" alt="Untitled Diagram" src="https://github.com/user-attachments/assets/491ef001-55cc-4d90-ba5d-e118bd5b478a" />

## Web App

In order for the new changes to be easily integrated, some changes were made to the Digital Twin Portal:



- **web/digital-twin-portal/js/config.js:** Replaced the split Orion/IoT base URLs with a single `FIWARE_API_BASE=http://localhost:1027`, deriving Orion as `${FIWARE_API_BASE}/v2` and IoT Agent as `${FIWARE_API_BASE}/iot`. This removes any hardcoded `:4042` usage and aligns with the single PEP + Nginx routing setup.

- **web/digital-twin-portal/js/api-client.js:** Added a shared HTTP helper. `apiFetch(path, ...)` joins paths onto the unified base, and `buildFiwareHeaders()` always adds FIWARE `service/servicePath` plus both `Authorization: Bearer <token>` and `X-Auth-Token` when a session token exists. This centralizes auth/header logic for every Orion/IoT call.

- **web/digital-twin-portal/js/orion-logs.js** and **web/digital-twin-portal/js/device-activity.js:** Orion reads now use `apiFetch("/v2/entities?...")`, so they hit the unified base and automatically include auth + FIWARE headers (reducing 401 risk due to missing token).

- **web/digital-twin-portal/js/inventory.js:** All IoT Agent calls now go through `apiFetch()` (`/iot/services`, `/iot/devices`, etc.) with `buildFiwareHeaders()`, eliminating the old `http://localhost:4042` dependency and ensuring every IoT request carries the same token and FIWARE headers.

#### How this improves the portal

- **Endpoint consistency:** Every Orion and IoT call now targets the single PEP (`http://localhost:1027`), matching the new topology and preventing the previous `ERR_CONNECTION_REFUSED` errors on `:4042`.

- **Authentication correctness:** A single wrapper guarantees both `Authorization` and `X-Auth-Token` are sent on all protected endpoints, avoiding Wilma 401s when calling Orion/IoT.

- **Maintainability:** Base URL and header logic are centralized; future URL or header changes require editing one place instead of multiple files. This also reduces duplicate fetch boilerplate and header drift.

- **Tenant safety:** FIWARE `service/servicePath` headers are set consistently via the wrapper, reducing accidental cross-tenant issues.



## How to Run

These are the new steps to set up and launch the full FIWARE security workflow, including Keyrock, Orion, Wilma PEP proxy, and the front-end Digital Twin Portal.

***

### 1. Start the FIWARE Docker Stack

Navigate to the `docker_compose` directory and run the following command:

```bash
docker compose up -d
```

***


### 2. Register and Configure the Application in Keyrock

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

Run the following command to force recreation of PEP Proxy container and API Gateway and ensure new config is applied:

```bash
docker compose up -d --force-recreate api-gateway pep-proxy
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
