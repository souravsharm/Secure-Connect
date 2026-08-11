# Secure Connect

**Secure Connect** is a Node.js/Express middleware API that automates physical access control by integrating with the **Gallagher** security and monitoring platform. It exposes simplified, versioned, **JWT-protected** REST endpoints for managing cardholders — onboarding, credential (Access/MSIC card) issuance, access-group assignment, updates, and offboarding — instead of provisioning each one by hand in Gallagher's admin console.

The integration itself is built behind a **Service + Adapter pattern**, so Gallagher is treated as one pluggable backend rather than a hardcoded dependency — additional access-control vendors could be added without touching the core cardholder logic.

## Why this exists

Manually provisioning physical access (creating a cardholder, issuing a card, assigning them to the correct access group, later revoking a lost card) in a vendor console doesn't scale and isn't auditable. Secure Connect turns that workflow into a small set of authenticated REST calls, with structured, PII-redacted logging for every request so actions are traceable after the fact.

## Key Features

- **JWT authentication** — every cardholder/cache-management endpoint requires a valid `Authorization: Bearer <token>` issued by `POST /api/v1/auth/login`. Passwords are stored as bcrypt hashes; login attempts are rate-limited per IP to slow brute-force attempts. This is Secure Connect's own gate — Gallagher itself has no concept of JWT; it only ever sees the separate Gallagher API key described below.
- **Gallagher integration** — mutual-TLS (client certificate, optional if Gallagher CC is configured to accept clients with none) plus API-key authentication to Gallagher's REST API, with an in-memory cache of resource hrefs (cardholders, divisions, access groups, operator groups) to minimize discovery calls.
- **Per-operator Gallagher attribution** — `create_cardholder`/`update_cardholder`/`delete_cardholder` accept an optional `X-Gallagher-Api-Key` header. When present, that request's Gallagher-side action is attributed to that specific Gallagher REST Client identity instead of the shared server-configured key — useful when multiple operators use the same Secure Connect deployment but should show up distinctly in Gallagher's own audit trail. Falls back to the server's `GALLAGHER_API_KEY` when omitted. This is a separate, independent credential from the JWT bearer token — do not confuse the two headers.
- **Service + Adapter architecture** — business logic (`services/CardholderService.js`) is decoupled from the vendor-specific client (`api/gallagher/GallagherAdapter.js`), so new integrations can be added by implementing the same adapter interface.
- **Request validation** — Zod schemas validate every incoming payload (card types, card-number format, ISO date ordering, required fields) and return structured 400 errors.
- **Structured, audit-ready logging** — Winston with daily-rotating file transports, correlation IDs propagated across a request's lifecycle, and automatic redaction/masking of names, emails, and card numbers in logs.
- **API versioning** — all routes are namespaced under `/api/v1` to allow non-breaking evolution.
- **Dockerized** — ships with a `Dockerfile` for containerized deployment.
- **API console** — a React + Material UI + Vite front end (with a Monaco JSON editor) for exercising every endpoint, including the login flow.

## Architecture

```mermaid
graph TD
    subgraph Client
        A[Express Routes] --> AUTH{JWT Auth Middleware};
        AUTH --> B{Cardholder Service};
    end

    subgraph Service Layer
        B --> C{Select Adapter};
    end

    subgraph Adapters
        C --> D[Gallagher API Adapter];
        C --> E[Future API 1 Adapter];
        C --> F[Future API 2 Adapter];
    end

    subgraph External Services
        D --> G([Gallagher API]);
        E --> H([Some Other API]);
        F --> I([Another API]);
    end

    style AUTH fill:#DC2626,stroke:#333,stroke-width:2px,color:#fff
    style B fill:#4169E1,stroke:#333,stroke-width:2px
    style C fill:#FF00FF,stroke:#333,stroke-width:2px
```

### Data Flow — creating a cardholder

```mermaid
graph TD
    A["Client sends POST /api/v1/create_cardholder\nwith Authorization: Bearer <JWT>"] --> AUTH["requireAuth middleware verifies JWT"];
    AUTH --> B["routes/v1/cardholderRoutes.js"];
    B --> C["Instantiates GallagherAdapter"];
    B --> D["Instantiates CardholderService with Adapter"];
    D --> E["Calls CardholderService.createCardholder()"];
    E --> F["Builds API-agnostic cardholder data"];
    E --> G["Calls GallagherAdapter.createCardholder()"];
    G --> H["gallagherCache makes the authenticated Gallagher API request (mTLS + API key)"];
    H --> I([Gallagher API]);
    I --> J["Response from Gallagher"];
    J --> H --> G --> E --> D --> B;
    B --> K["Sends response to Client"];
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant SecureConnect as Secure Connect API
    participant Gallagher

    Client->>SecureConnect: POST /api/v1/auth/login {username, password}
    SecureConnect->>SecureConnect: bcrypt.compare(password, storedHash)
    SecureConnect-->>Client: 200 { token, expiresIn }

    Client->>SecureConnect: POST /api/v1/create_cardholder\nAuthorization: Bearer <token>
    SecureConnect->>SecureConnect: jwt.verify(token)
    SecureConnect->>Gallagher: POST cardholder (mTLS client cert + GGL-API-KEY)
    Gallagher-->>SecureConnect: 200 cardholder created
    SecureConnect-->>Client: 200 { message, data }
```

## How to Integrate a New Access-Control API

The Adapter Pattern makes it straightforward to add another vendor alongside Gallagher:

1. **Create a new adapter** in `api/<vendorName>/<VendorName>Adapter.js`, implementing the same public methods as `GallagherAdapter.js` (`createCardholder`, `updateCardholder`, `deleteCardholder`, `findCardholderHrefByFirstName`, `findDivisionHrefByName`, `findCardNumberHref`).
2. **Implement the adapter's HTTP/auth logic** for that vendor's API.
3. **Wire it into the routes** in `routes/v1/cardholderRoutes.js`, selecting an adapter based on a header, query parameter, or body field.

## Project Structure

```
server.js                        Express app setup, middleware, versioned routing
middlewares/
  auth.js                        JWT signing (signToken) and verification (requireAuth)
  validation.js                  Zod schemas for cardholder, delete, and login payloads
services/
  CardholderService.js           API-agnostic cardholder business logic
api/
  gallagher/GallagherAdapter.js  Gallagher-specific implementation of the adapter interface
routes/v1/
  authRoutes.js                  POST /login — issues JWTs, rate-limited
  cardholderRoutes.js            Create/update/delete cardholder (JWT-protected)
  cacheRoutes.js                 Cache status/clear/inspect (JWT-protected)
utils/
  gallagherCache.js              Caches Gallagher hrefs and makes authenticated requests
  certificateLoader.js           Builds the mTLS-enabled axios client for Gallagher
  cardBuilder.js                 Builds card payloads for Access/MSIC card types
  logger.js                      Winston logging, correlation IDs, PII redaction
  errorHandler.js                asyncHandler wrapper for route handlers
config/
  gallagher.js                   Gallagher card-type IDs and base URL
  secrets.env.example            Documented env var template (copy to secrets.env)
  secrets.env                    (gitignored) actual local secrets
certificates/                    (gitignored) Gallagher mTLS client certificate files
ui/                              React/Vite/MUI API console for exercising the endpoints
```

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/souravsharm/Secure-Connect.git
   cd Secure-Connect
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd ui && npm install && cd ..
   ```

3. **Configure environment variables**

   Copy the template and fill in real values:
   ```bash
   cp config/secrets.env.example config/secrets.env
   ```

   At minimum you'll need:
   ```
   PORT=3000

   # JWT auth (this app's own auth layer)
   JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   JWT_EXPIRES_IN=1h
   AUTH_USERNAME=admin
   AUTH_PASSWORD_HASH=<generate with: node -e "console.log(require('bcryptjs').hashSync('yourPassword', 10))">

   # Gallagher API
   GALLAGHER_API_URL=https://your-gallagher-server:8904
   GALLAGHER_API_KEY=your_gallagher_api_key
   DEFAULT_ACCESS_GROUP_ID=your_default_access_group_id
   DEFAULT_DIVISION_NAME=your_default_division_name
   GALLAGHER_ACCESS_CARD_TYPE_ID=your_access_card_type_id
   GALLAGHER_MSIC_CARD_TYPE_ID=your_msic_card_type_id

   # Only needed if Gallagher CC requires a client certificate (Command Centre has a
   # server property to accept REST Clients with no certificate — if that's checked,
   # omit these two entirely):
   CLIENT_CERT_PATH=../certificates/GallagherRestClientCert.pfx
   CERT_PASSPHRASE=your_certificate_passphrase
   ```

   If Gallagher Command Centre runs on the same machine as this app, use its **LAN IP** (from `ipconfig`/`ifconfig`) for `GALLAGHER_API_URL`, not `127.0.0.1`/`localhost` — Command Centre's REST Client IP allowlist matches on the interface address, and loopback connections get rejected with a bare `401`.

   `DEFAULT_DIVISION_NAME`, `DEFAULT_ACCESS_GROUP_ID`, `GALLAGHER_ACCESS_CARD_TYPE_ID`, and `GALLAGHER_MSIC_CARD_TYPE_ID` must exactly match resources that already exist in your Gallagher instance (Configure > Divisions / Access Groups / Card Types in the Gallagher Configuration Client) — every one of these is instance-specific and `create_cardholder` will fail with Gallagher's own validation message if any of them don't match. Fetch your instance's real IDs with:
   ```bash
   curl -k "https://<GALLAGHER_API_URL>/api/card_types" -H "Authorization: GGL-API-KEY <your key>"
   curl -k "https://<GALLAGHER_API_URL>/api/divisions" -H "Authorization: GGL-API-KEY <your key>"
   ```

   Card number format is also enforced by Gallagher itself, on top of this app's own `6-9 alphanumeric` validation — some instances only accept numeric card numbers for `Access` cards. If `create_cardholder` returns `Invalid card number '...'`, try a numeric-only value.

4. **Certificates folder (optional)**

   Only needed if Gallagher CC requires client certificates. Create a `certificates/` folder at the project root and place your Gallagher mTLS client certificate (`.pfx`) inside. This folder is gitignored — never commit certificate files.

5. **Run the server**
   ```bash
   npm run dev
   ```
   `nodemon.json` restricts the dev auto-reload watcher to the actual source directories (`server.js`, `routes/`, `middlewares/`, `services/`, `utils/`, `api/`, `config/gallagher.js`) so unrelated file activity elsewhere in the repo doesn't trigger restarts and silently reset the in-memory Gallagher cache.

6. **Run the API console (optional)**
   ```bash
   cd ui
   npm run dev
   ```

## API Reference (`/api/v1`)

### Authentication

#### Login
- `POST /api/v1/auth/login` — **public**, rate-limited (5 attempts / 15 min / IP)
- Body:
  ```json
  { "username": "admin", "password": "yourPassword" }
  ```
- Response:
  ```json
  { "token": "<jwt>", "tokenType": "Bearer", "expiresIn": "1h" }
  ```
- All routes below require `Authorization: Bearer <token>` from this response.

### Cardholder Management

Validation rules are unified across create/update/delete via `validatePersonBody` in [routes/v1/cardholderRoutes.js](routes/v1/cardholderRoutes.js). The request body must be an object with a top-level `person` key.

**Cardholder schema (`person`)**
- Required: `firstName` (non-empty), `cards` (array, min 1)
- Optional: `lastName`, `email` (valid email), `divisionName`, `employmentCategory`, `photo` (base64 JPEG, raw or data URI)

**Card schema (each item in `cards`)**
- `cardType`: `"Access"` or `"MSIC"`
- `cardNumber`: `^[A-Z0-9]{6,9}$` (case-insensitive input, normalized to uppercase), unique per request
- `activationDate` / `expiryDate`: ISO 8601 datetime, `expiryDate` strictly after `activationDate`

#### Create Cardholder
`POST /api/v1/create_cardholder`
```json
{
  "person": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "divisionName": "CreateCardholder",
    "cards": [
      { "cardType": "Access", "cardNumber": "ABC123", "activationDate": "2025-08-04T12:00:00", "expiryDate": "2026-08-04T12:00:00" }
    ]
  }
}
```

#### Update Cardholder
`PATCH /api/v1/update_cardholder`
```json
{
  "person": { "firstName": "John", "cards": [ { "cardType": "Access", "cardNumber": "ABC123", "activationDate": "2025-08-04T12:00:00", "expiryDate": "2026-08-04T12:00:00" } ] },
  "type": "Lost"
}
```
- `type` (optional) updates the Access card's status via a JSON Patch–style update to Gallagher.
- The cardholder is located by `person.firstName`.

#### Delete Cardholder
`DELETE /api/v1/delete_cardholder`
```json
{ "person": { "firstName": "John" } }
```
- Locates the cardholder by `firstName` and deletes the first match — if multiple cardholders share a first name, disambiguate upstream in Gallagher before deleting.

### Cache Management

- `GET /api/v1/cache_status` — cache initialization state and cached hrefs. Self-warms the cache on a fresh process if it isn't initialized yet, so it doesn't just report an empty cache.
- `POST /api/v1/clear_cache` — clears the in-memory href cache
- `GET /api/v1/cached_hrefs` — returns cached Gallagher endpoint hrefs (also self-warms)

The href cache is in-memory per process — it resets on every restart, which is expected; the routes above re-populate it automatically on next use.

### Error Responses

Validation failures (caught before any Gallagher call) return `400`:
```json
{ "error": "ValidationError", "issues": [ { "path": "person.cards", "message": "...", "code": "..." } ] }
```
Errors from Gallagher itself (e.g. an invalid division, card type, or duplicate card number) also return the upstream status code, with Gallagher's own message surfaced directly rather than a generic axios error:
```json
{ "message": "Invalid card number 'ABC123'", "details": ["Invalid card number 'ABC123'"] }
```
Missing/invalid/expired tokens return `401`. Exceeding the login rate limit returns `429`. Unhandled server errors return `500`.

### Known Limitations

- `update_cardholder` currently requires a non-empty `cards` array in every request, even if you only want to change `lastName`/`description`/etc. and aren't touching cards. This is a validation gap (the schema is shared with `create_cardholder`), not a Gallagher limitation.
- `delete_cardholder` matches by `firstName` only and deletes the first result — if more than one cardholder shares a first name, disambiguate in Gallagher first.
- There's no way to change an existing card's *type* (Access ↔ MSIC) — Gallagher models that as issuing a new card, not editing one. `update_cardholder`'s `type` field only changes an Access card's *status* (e.g. `Lost`/`Active`).

## Security Notes

- Gallagher credentials (API key + client certificate passphrase) live only in `config/secrets.env`, which is gitignored — they are never sent from the browser.
- All names, emails, and card numbers are redacted or masked before being written to logs (`utils/logger.js`).
- The bundled login is a single configured account intended for a demo/portfolio deployment; swap `AUTH_USERNAME`/`AUTH_PASSWORD_HASH` for a real user store before using this in production with multiple operators.

---

Contributions and suggestions are welcome — open an issue or a pull request.
