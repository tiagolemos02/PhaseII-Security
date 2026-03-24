# Phase II - Security

**This phase introduces a major security and architecture upgrade over the previous version.**
Please contact the developer for the previous folders/versions for instructions and explanations of files that were not changed, as unchanged details are not duplicated here.

This README contains the **main changes introduced in this version**, including the new authentication flow, authorization improvements, and updated portal/admin behavior.

## Project Identification

**Repository**: `tiagolemos02/PhaseII-Security/DT_V2.3`

**Version**: `1.1.0`

**Author**: Tiago Lemos

**Licence**: MIT

---

## New in v1.1.0

### ✅ Machine edit modal

Machines in the **Machine & Services** tab now have an **Edit** button that opens a modal overlay pre-populated with all the machine's current settings.

**What was added:**

* Edit button next to the existing Delete button in the Machines table
* Full-featured modal with the same fields as the Add Machine form:
  * Device ID (read-only)
  * Service group selector
  * Name, model, description, operational status
  * Telemetry attributes section with Manual/Automatic toggle
  * Static attributes section with Manual/Automatic toggle
* Changes are submitted via `PUT /iot/devices/{deviceId}`
* On success the table refreshes automatically

**Authorization:**

The IoT Agent's PUT endpoint was not covered by the original XACML policy. A new rule was added to both `keyrock-bootstrap.sh` and `existing-policy-v8.xml` granting the `admin` role PUT access to `/iot/devices/{id}`.

> After updating these files, re-run the bootstrap service to push the new permission into the live Keyrock/AuthzForce instance:
> ```bash
> docker compose up keyrock-bootstrap
> ```

---

### ✅ Attribute details modal

The **Attributes** count shown in the Details column of the Machines table is now accurate and interactive.

**What was fixed:**

* The count previously included system-generated static attributes (e.g. `friendlyName`, `model`, `operationalStatus`, `serviceGroupKey`, etc.), inflating the number. It now shows only user-defined telemetry and custom static attributes.

**What was added:**

* The count is now a clickable link that opens an **Attributes modal** showing:

  * **Left panel — Visual view**: two tables, one for telemetry attributes (Object ID / Name / Type) and one for custom static attributes (Name / Type / Value)
  * **Right panel — JSON view**: the raw attribute arrays formatted as JSON

* **Color coding** (consistent across both panels):

  | Color | Meaning |
  |-------|---------|
  | Indigo | User-defined attributes |
  | Amber | System-generated static attributes |

* **Eye toggle button** in the Static Attributes header: shows or hides the system-generated entries in both the visual table and the JSON panel simultaneously. Hidden by default to reduce noise.
* A **legend** below the section header identifies the two colors.

---

## What changed

 ### ✅ New Backend-for-Frontend (BFF) + Authorization Code flow

The biggest architectural change in this version is the introduction of a **backend-for-frontend (`portal-bff`)** for authentication.

**Before** (old behavior):

* Browser handled authentication more directly.
* OAuth configuration was inconsistent with the intended Authorization Code flow.
* Logout/session behavior could leave the user effectively logged into Keyrock SSO.

**Now** (new behavior):

* A new **`portal-bff`** service starts the **Authorization Code** flow with Keyrock.
* The BFF exchanges the authorization code for tokens **server-side**.
* Tokens are stored in a **server session backed by HttpOnly cookies**.
* The browser no longer needs to store OAuth secrets/tokens directly.
* The BFF proxies FIWARE and Keyrock admin API requests, so the front-end talks to the BFF instead of exposing secrets in the browser.

This aligns the portal with a safer authentication model and fixes the previous mismatch between the BFF’s use of `response_type=code` and the Keyrock application grant configuration. 

---

### ✅ OAuth flow and session fixes

Several authentication bugs were fixed as part of the BFF migration:

* Enforced **`authorization_code`** grant type during bootstrap.
* Added bootstrap logic to **repair/update existing Keyrock app settings** on every run.
* Removed invalid attempts to patch `response_type` directly.
* Added safer login behavior with:

  * `prompt=login`
  * `max_age=0`
* Added local session reset on login start, callback errors, and state mismatch.
* Fixed logout so it now clears the BFF session **and** redirects through Keyrock external logout, solving the SSO persistence issue.

These changes make login/logout behavior predictable and prevent stale sessions or accidental cross-user reuse. 

---

### ✅ One secure portal entrypoint

The portal is now meant to be accessed through the BFF entrypoint:

* **Portal URL:** `http://localhost:8001`

From there:

* Click **Sign In**
* You are redirected to Keyrock
* After authentication, you return to the portal already authenticated via the BFF session

This replaces the previous browser-token-style interaction model. The final normalized configuration keeps the portal on port `8001` across env files, templates, compose, and docs. 

---

### ✅ Authzforce-backed ABAC (working hours + viewer constraints)

This version also upgrades authorization from basic role-based behavior to a real **Authzforce-backed ABAC** flow for restricted users.

**What was added:**

* A **custom Authzforce request context injector** for the PEP:

  * injects `lisbon-weekday`
  * injects `lisbon-time`
* A **Keyrock Authzforce template override** to improve generated rule behavior
* A **persistent Keyrock runtime patch** to fix the Authzforce request path issue in the PEP → Keyrock → Authzforce chain
* A **working-hours XACML rule** for the `viewer` role:

  * Monday to Friday only
  * `09:00–13:00` or `14:00–18:00`
  * evaluated using Lisbon timezone values

**Why this matters:**
- Advanced XACML rules didn't exist in the previous stack. Now with AuthzForce is possible to create permissions with extra-granularity. This is possible updating an XACML rule for permissions (a button to help create this rules is provided in the XACML rule section).
- This **viewer** role was created as a *test* to implemeent AuthZForce and also to create this permission from the deplyment phase. Since is not a regular XACMl rule it has some dependent files related to that. But any XACMl rule is permitted in the portal (*using the rules and references for that*).
- Any other type of rule that goes behind the scope can be added like this **working-hours XACML rule**
---

### ✅ Bootstrap automation and reproducibility

This version adds more deterministic setup through dedicated bootstrap scripts.

**Added:**

* **MySQL bootstrap script flow**

  * Moves DB initialization logic out of inline compose commands
  * Keeps initialization more scripted and repeatable
* **Keyrock bootstrap automation**

  * Creates/synchronizes:

    * application
    * PEP credentials
    * roles
    * users
    * permissions
    * Authzforce-related policy sync behavior

This replaces more manual or ad-hoc setup steps and makes the stack easier to recreate consistently.  

---

### ✅ BFF proxy correctness fixes

The BFF now correctly forwards request bodies to proxied services.

**What changed:**

* Added raw-body-first middleware handling
* Added proper proxy body forwarding for:

  * buffer
  * string
  * object payloads
* Removed the fragile previous forwarding logic

**Why:**

Without this fix, some Keyrock admin operations (such as role/permission creation) could fail because the JSON body was being consumed or reshaped before proxying. 

---

### ✅ Full Roles & Permissions management in the portal

The portal now includes a much more complete **Roles & Permissions** administration experience.

**Implemented in the UI:**

1. Create roles
2. Delete roles
3. Create permissions
4. Edit permissions
5. Delete permissions globally
6. Assign permissions to a role
7. Remove permissions from a role
8. Assign roles to users
9. Remove roles from users
10. Delete users

**Also added:**

* Support for both basic permissions and advanced **XACML** permissions
* An **XACML help modal** with FIWARE/Authzforce guidance and example rules

This replaces the earlier placeholder-style Roles & Permissions area with a much more complete admin interface that mirrors Keyrock capabilities. 

---

### ✅ Improved Roles & Permissions UX

The Roles & Permissions screen was also redesigned for better usability.

**Changes:**

* Removed the old User Management “Actions” column
* Removed the global permissions table view
* Switched to **role-scoped permissions only**
* Reworked the layout into a **split-screen master-detail view**:

  * **Left:** roles list
  * **Right:** permissions for the selected role
* Added a cleaner empty state with an inline **“Create new permission”** action

**Why:**

- Permissions are now contextual to the selected role, reducing noise and making role administration clearer and safer. 

- This also removes the necessity to use keyrock for this operations

---

### ✅ Restricted-user UX improvements

For users without access to certain tabs or actions:

* Restricted tabs can now show a denied placeholder
* The UI can grey out unavailable sections
* Unauthorized sections are hidden more cleanly
* The portal avoids unnecessary restricted data refreshes/calls where possible

This complements backend authorization enforcement by making the front-end behavior cleaner and less confusing for limited users.  

---

## Technical summary of updated files

Below is a high-level summary of the main files and areas changed in this version.

### Docker / Bootstrap / Security

* `docker_compose/docker-compose.yml`

  * Updated to include the new `portal-bff`
  * Includes bootstrap/runtime patch wiring
  * Includes Authzforce custom policy integration

* `docker_compose/bootstrap/mysql-bootstrap.sh`

  * Dedicated MySQL initialization flow

* `docker_compose/bootstrap/keyrock-bootstrap.sh`

  * Automates Keyrock application, roles, users, permissions, PEP, and OAuth configuration
  * Handles idempotent re-runs and config convergence

* `docker_compose/bootstrap/pep-authzforce-custom-policy.js`

  * Injects Lisbon weekday/time into the PDP request context

* `docker_compose/bootstrap/keyrock-authzforce-rule.ejs`

  * Custom rule template override for Keyrock/Authzforce integration

* `docker_compose/bff/server.js`

  * Implements the BFF auth/session/proxy logic
  * Includes login, callback, logout, and body-forwarding fixes

These infrastructure and backend-auth changes are the core of the new security model.  

### Portal / Front-End

* `web/digital-twin-portal/index.html`
* `web/digital-twin-portal/js/roles-permissions.js`
* `web/digital-twin-portal/js/dom-elements.js`
* `web/digital-twin-portal/js/main.js`
* `web/digital-twin-portal/js/auth.js`
* `web/digital-twin-portal/js/users.js`
* `web/digital-twin-portal/js/ui-helpers.js`
* `web/digital-twin-portal/css/custom.css`

These changes implement:

* full Roles & Permissions management
* improved role/permission UX
* XACML help UI
* restricted-tab placeholders and cleaner denied states
* better role-scoped admin flows

All of these were part of the portal-focused technical changes in the uploaded summaries.  

---

## Validation highlights

This version was validated with the following expected behavior:

* `admin` can access Orion + IoT operations
* `viewer` can access Orion logs
* `viewer` is denied IoT operations
* Working-hours ABAC behaves as expected:

  * `Wed 10:00` → Permit
  * `Sat 10:00` → Deny
  * `Wed 13:30` → Deny

This confirms that both role restrictions and time-based ABAC rules are working correctly. 

---

## First-time setup

For Windows users, open **PowerShell** in `docker_compose` and run:

```powershell
./bootstrap/prepare-env.ps1
```

For Linux users run:

```terminal
pwsh-lts -File ./prepare-env.ps1
```

Then start the stack:

```powershell
docker compose up -d --build
```

After that, open the portal at:

`http://localhost:8001`

Open the .env file inside docker_compose folder to see the passwords generated.

Click **Sign In**. You will be redirected to Keyrock, and after authentication you will be returned to the portal. This setup flow is part of the new BFF-based security baseline you provided. 

---

## Secret rotation

To rotate generated secrets:

```powershell
./bootstrap/prepare-env.ps1 -RotateSecrets
```

Then recreate the stack.

---

## Licença

MIT © Tiago Lemos

---

*Plataforma construída com FIWARE Generic Enablers e tecnologias web modernas*
