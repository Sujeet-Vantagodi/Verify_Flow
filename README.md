# Phone OTP Verification System

A full-stack, real-time phone number OTP verification application with a simulated SMS gateway.

The goal of this project is to build a complete phone verification workflow without spending money on paid SMS gateways.

Instead of sending actual SMS messages through telecom networks, the application implements its own simulated SMS delivery system. Generated OTPs are delivered to a virtual SMS inbox that can be accessed independently from another device, including a mobile phone.

The application should be developed as a production-style learning project with a modern, colorful, responsive frontend, secure backend architecture, real-time communication, database persistence, and deployment support.

## Implementation status and local setup

The repository is organized as a frontend/backend monorepo. The current implementation includes the verification portal, mobile virtual inbox, PostgreSQL/Prisma persistence, secure OTP and pairing flows, REST APIs, Socket.IO updates, rate limiting, and focused security tests. Prisma is intentionally pinned to `6.19.0` because the backend uses the classic `@prisma/client` runtime and migration workflow.

### Requirements

- Node.js 22 or newer.
- npm 10 or newer.
- PostgreSQL 14 or newer.

The expected Node.js major version is also recorded in [.nvmrc](./.nvmrc) and the root [package.json](./package.json).

### Install and configure

From the repository root:

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Update `backend/.env` with a reachable PostgreSQL database and two different random secrets of at least 32 characters:

```env
DATABASE_URL=postgresql://verifyflow:replace-with-your-db-password@localhost:5432/verifyflow
OTP_HASH_SECRET=use-a-long-random-secret-for-otp-hashing
PAIRING_HASH_SECRET=use-a-different-long-random-secret-for-pairing
```

If Prisma reports `P1000: Authentication failed`, create or reset the dedicated local role and database. Run PostgreSQL’s interactive shell as the administrator:

```bash
sudo -u postgres psql
```

Then run the following SQL, choosing a password when prompted:

```sql
CREATE ROLE verifyflow WITH LOGIN;
\password verifyflow
CREATE DATABASE verifyflow OWNER verifyflow;
\q
```

If either the role or database already exists, run `ALTER ROLE verifyflow WITH LOGIN;` and `\password verifyflow` instead, then continue. Put the same password into `backend/.env` as the `verifyflow` password. URL-encode special characters in the password.

Run each `psql` command only after the previous command returns to the `postgres=#` prompt. In particular, `\password verifyflow` is interactive; do not paste the following `CREATE DATABASE` command until both password prompts have finished.

Finally, rerun:

```bash
npm run db:migrate --workspace backend
npm run dev --workspace backend
```

The normal `db:migrate` command applies committed migrations with `prisma migrate deploy`, so the application database user does not need permission to create databases. Use `db:migrate:dev` only when creating new migrations locally; that command requires the PostgreSQL role to have `CREATEDB` permission for Prisma’s shadow database.

Then generate Prisma Client and apply the database migration:

```bash
npm run db:generate --workspace backend
npm run db:migrate --workspace backend
```

Run the applications in separate terminals:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
```

The verification portal is available at `http://localhost:5173`. The virtual inbox is available at `http://localhost:5173/inbox`.

### Test from a real phone

`localhost` is only reachable from the computer running the app. For a quick remote test, expose the Vite frontend through an HTTPS tunnel. The Vite development proxy forwards `/api` and `/socket.io` to the local backend, so the phone needs only one public URL:

Install Cloudflare Tunnel on Ubuntu first:

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update
sudo apt-get install cloudflared
```

Then run:

```bash
cloudflared tunnel --url http://localhost:5173
```

Cloudflare will print a URL such as `https://random-name.trycloudflare.com`. Set that exact URL as `FRONTEND_URL` in `backend/.env`, restart the backend, and open this on the phone:

```text
https://random-name.trycloudflare.com/inbox
```

Keep the tunnel, backend, and frontend terminals running. On the computer, open the portal at the same public URL without `/inbox`; request an OTP, then enter the pairing code on the phone. The inbox logo now stays on `/inbox` instead of navigating to the phone-verification portal.

For a tunnel session, keep these three processes running:

**Terminal 1 — backend**

Set `FRONTEND_URL` in `backend/.env` to the current tunnel URL, then start the backend:

```env
FRONTEND_URL=https://your-current-tunnel.trycloudflare.com
```

```bash
npm run dev --workspace backend
```

**Terminal 2 — frontend**

Make sure `frontend/.env` uses the Vite proxy, not `localhost`:

```env
VITE_API_URL=/api
VITE_SOCKET_URL=
```

```bash
npm run dev --workspace frontend
```

**Terminal 3 — tunnel**

```bash
cloudflared tunnel --url http://localhost:5173
```

Open the printed URL on the laptop for the portal and append `/inbox` for the phone. Restart the backend whenever the quick-tunnel URL changes. Restart the frontend whenever `frontend/.env` changes.

For a permanent URL, deploy the Docker Compose stack behind HTTPS and use the resulting domain in `FRONTEND_URL`. The frontend container already proxies `/api` and `/socket.io` to the backend.

### Workflow and API summary

1. `POST /api/otp/request` validates the phone number, creates a five-minute OTP session, stores an HMAC hash, persists the simulated message, and returns a short-lived inbox pairing code. The OTP itself is never returned.
2. Pair the mobile browser with `POST /api/inbox/pair`. The response contains a one-time device token.
3. Send the device token as `x-device-token` or `Authorization: Bearer <token>` when calling `/api/inbox/messages`.
4. The inbox loads persisted messages and listens for authenticated, session-specific Socket.IO `inbox:message` events.
5. `POST /api/otp/verify` checks expiration, maximum attempts, and the HMAC using a timing-safe comparison.

The backend is implemented under [backend/src](./backend/src), the Prisma schema is at [backend/prisma/schema.prisma](./backend/prisma/schema.prisma), and the frontend is implemented under [frontend/src](./frontend/src).

### Tests and production build

Run backend unit/security tests and production builds with:

```bash
npm test --workspace backend
npm run build --workspace frontend
npm run build --workspace backend
```

For production, set `NODE_ENV=production`, use HTTPS URLs in `FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `VITE_API_URL`, and `VITE_SOCKET_URL`, run `npm run db:deploy --workspace backend`, and configure the host to support WebSocket upgrades. Do not commit either `.env` file or database credentials.

For a self-contained deployment, the repository also includes [docker-compose.yml](./docker-compose.yml). Set `POSTGRES_PASSWORD`, `OTP_HASH_SECRET`, and `PAIRING_HASH_SECRET` in the shell, then run:

```bash
docker compose build
docker compose run --rm backend npx prisma migrate deploy
docker compose up -d
```

The frontend container serves the SPA, proxies `/api` and `/socket.io` to the backend, and preserves `/inbox` deep links. Put TLS termination in front of the frontend container using the certificate management provided by the chosen hosting platform or reverse proxy.

The application deliberately uses a simulated SMS gateway. It demonstrates a complete multi-device verification workflow but does not prove ownership of a real phone number.

GitHub Actions CI is configured in [.github/workflows/ci.yml](./.github/workflows/ci.yml). It provisions PostgreSQL, applies migrations, runs backend security tests, and builds both applications on pushes and pull requests.

---

# 1. Project Overview

The application consists of two independent web interfaces:

### Interface 1: Phone Verification Portal

This interface is opened on a laptop or desktop.

The user:

1. Opens the deployed application URL.
2. Enters their mobile number.
3. Clicks the Send OTP button.
4. Receives a confirmation that the OTP has been generated.
5. Enters the OTP after retrieving it from the virtual inbox.
6. Clicks Verify.
7. Receives a successful or unsuccessful verification result.

### Interface 2: Virtual SMS Inbox

This interface is opened independently on a mobile phone or another device.

The user:

1. Opens the virtual inbox URL.
2. Pairs the inbox with the verification session using a secure pairing code displayed on the laptop.
3. Sees incoming OTP messages.
4. Opens the message.
5. Copies the OTP.
6. Returns to the laptop and enters the OTP.

The inbox must not depend on the verification page remaining open.

The backend and database handle message generation, delivery simulation, and persistence.

**Important:** This application simulates SMS delivery. It does not send actual SMS messages to the phone's native Messages application.

---

# 2. Main Project Objectives

The project should demonstrate practical knowledge of:

- Full-stack web development.
- Frontend and backend integration.
- REST API development.
- Real-time communication.
- Database management.
- OTP generation and verification.
- Cryptographic hashing.
- Authentication and authorization.
- Rate limiting.
- Input validation.
- Secure session management.
- Application deployment.
- Git and GitHub workflows.

The implementation should prioritize clean architecture, readable code, modular components, and security.

---

# 3. Technology Stack

Use the following technologies.

| Layer             | Technology     | Purpose                    |
| ----------------- | -------------- | -------------------------- |
| Frontend          | React          | User interface             |
| Language          | TypeScript     | Type safety                |
| Build Tool        | Vite           | Frontend development       |
| Styling           | Tailwind CSS   | Responsive styling         |
| Animations        | Framer Motion  | UI animations              |
| Icons             | Lucide React   | Interface icons            |
| Backend           | Node.js        | Server runtime             |
| Backend Framework | Express.js     | REST APIs                  |
| Language          | TypeScript     | Backend development        |
| Real-time         | Socket.IO      | Live inbox updates         |
| Database          | PostgreSQL     | Persistent storage         |
| ORM               | Prisma         | Database operations        |
| Validation        | Zod            | Input validation           |
| Security          | Node.js Crypto | OTP generation and hashing |
| Version Control   | Git and GitHub | Source control             |

Use stable, mutually compatible package versions.

Do not introduce unnecessary technologies or microservices.

---

# 4. System Architecture

The application must follow a modular client-server architecture.

```text
                  INTERNET
                     |
          -----------------------
          |                     |
     LAPTOP BROWSER        MOBILE BROWSER
          |                     |
          |                     |
    Verification Portal    Virtual SMS Inbox
          |                     |
          |                     |
          ----------- -----------
                     |
                BACKEND API
                     |
          -----------------------
          |          |          |
       OTP       SMS         Session
      Service   Simulator    Manager
          |          |          |
          -----------------------
                     |
                 PostgreSQL
                     |
             Persistent Storage
```

The backend is the central system.

Both frontend interfaces communicate independently with the backend.

The backend is responsible for:

- Generating OTPs.
- Hashing OTPs.
- Storing verification records.
- Simulating SMS delivery.
- Managing inbox access.
- Validating OTPs.
- Managing expiration.
- Handling resend requests.
- Enforcing security restrictions.

---

# 5. Complete User Workflow

This is the most important part of the project.

Implement the following workflow exactly.

## Step 1: Open the Verification Portal

The user opens:

`https://your-domain.com`

Display a modern phone verification interface.

The user enters a mobile number.

Example:

`+91 9876543210`

## Step 2: Request OTP

The user clicks:

`Send OTP`

The frontend sends a request to the backend.

The backend:

1. Validates the phone number.
2. Generates a cryptographically secure six-digit OTP.
3. Hashes the OTP using a secure server-side secret.
4. Stores the OTP hash in PostgreSQL.
5. Creates a verification session.
6. Creates a simulated SMS message containing the original OTP.
7. Stores the message in the virtual inbox.
8. Generates a secure inbox pairing code.
9. Returns the verification session details to the frontend.

The original OTP must never be returned in the normal verification API response.

The frontend displays:

- OTP successfully generated.
- Verification session started.
- Inbox URL.
- Secure inbox pairing code.

Provide a convenient copy button and a QR code linking to the inbox.

## Step 3: Open the Virtual Inbox on the Phone

The user takes their phone.

They open Chrome and navigate to:

`https://your-domain.com/inbox`

The inbox page asks for the pairing code displayed on the laptop.

The user enters the pairing code.

The backend validates it and grants access to the corresponding inbox.

The pairing code must be securely generated, short-lived, and single-use.

After successful pairing, the phone displays the corresponding virtual SMS inbox.

## Step 4: Receive the Simulated OTP

The inbox should display the newly generated message.

Example:

```text
---------------------------------
          VIRTUAL MESSAGES
---------------------------------

Sender: OTP Verification Service

Phone: +91 ******3210

Message:

Your verification OTP is 483921.

This OTP expires in 5 minutes.

Time: 12:30 PM

---------------------------------
```

The message should appear automatically without refreshing the page.

Use Socket.IO for real-time message delivery.

If the mobile browser is disconnected, the message must still be available when the user reconnects because it is stored in PostgreSQL.

## Step 5: Enter OTP on Laptop

The user returns to the verification portal.

They enter the OTP received in the virtual inbox.

The frontend sends the OTP and verification session ID to the backend.

## Step 6: Backend Verification

The backend:

1. Retrieves the corresponding verification record.
2. Checks whether the OTP exists.
3. Checks whether it has expired.
4. Checks whether the maximum attempt limit has been reached.
5. Hashes the submitted OTP using the same secure method.
6. Compares the hashes using a timing-safe comparison.
7. Marks the verification session as verified if successful.
8. Invalidates the OTP after successful verification.

The frontend displays the result.

Success:

```text
PHONE NUMBER VERIFIED!

Your phone number has been
successfully verified.

Verification Status: SUCCESS
```

Failure:

```text
INVALID OTP

The OTP you entered is incorrect.
Please try again.
```

Expired:

```text
OTP EXPIRED

Your OTP has expired.
Please request a new OTP.
```

---

# 6. Frontend Design Requirements

The frontend is a major part of this project.

Do not create a boring, plain white interface.

The entire application should have a colorful, modern, polished design with smooth animations.

The design should feel like a modern SaaS application.

## Overall Visual Direction

Use:

- Vibrant gradients.
- Modern typography.
- Rounded cards.
- Soft shadows.
- Glassmorphism where appropriate.
- Colorful backgrounds.
- Smooth transitions.
- Animated buttons.
- Attractive loading indicators.
- Responsive layouts.
- Beautiful success and error states.

Suggested color palette:

| Element    | Color                       |
| ---------- | --------------------------- |
| Primary    | Electric Indigo             |
| Secondary  | Purple                      |
| Accent     | Cyan                        |
| Success    | Emerald Green               |
| Error      | Coral Red                   |
| Background | Very Light Blue / Deep Navy |
| Cards      | White / Dark Surface        |

Use gradients such as:

`linear-gradient(135deg, #6366F1, #A855F7, #06B6D4)`

The application should support a consistent design system.

## Interface 1: Verification Portal

Create a visually attractive landing page.

### Header

Include:

- Project logo.
- Project name.
- Small navigation section.
- Connection status indicator.

Project name:

**VerifyFlow**

Tagline:

"Secure. Simple. Verified."

### Main Hero Section

Display a large heading:

"Verify Your Phone Number"

Subtitle:

"Experience secure phone verification powered by real-time OTP technology."

Add an attractive illustration or animated phone graphic.

### Phone Number Card

The card should contain:

1. Country selector.
2. Country calling code.
3. Phone number input.
4. Send OTP button.

The default country should be India (+91).

Validate phone number formatting.

Do not accept arbitrary invalid numbers.

### OTP Verification Section

After requesting an OTP, display an animated transition to the verification interface.

Include:

- Six individual OTP input boxes.
- Automatic focus movement.
- Backspace navigation.
- Paste support.
- Verify button.
- Resend OTP countdown.
- OTP expiration countdown.

Use a 5-minute expiration timer.

The OTP input should be attractive and easy to use.

### Status Messages

Create attractive animated states for:

- OTP generated.
- Waiting for verification.
- Invalid OTP.
- OTP expired.
- Successful verification.

The success screen should have a celebratory animation with a checkmark.

Use Framer Motion for animations.

---

# 7. Interface 2: Virtual SMS Inbox

The inbox must be a separate route:

`/inbox`

It should be optimized primarily for mobile phones.

The design should resemble a modern messaging application.

### Inbox Header

Display:

- Virtual SMS logo.
- Inbox title.
- Connection status.
- Device pairing status.

### Inbox Dashboard

Display:

- Number of received messages.
- Active verification sessions.
- Latest message timestamp.

### Message List

Each message should appear as an individual card.

Display:

- Sender name.
- Masked recipient phone number.
- Message preview.
- Timestamp.
- Unread indicator.

### Message Details

When the user opens a message, show:

- Sender.
- Recipient number.
- Complete OTP message.
- Six-digit OTP displayed prominently.
- Copy OTP button.
- Message timestamp.
- Expiration status.

The OTP should be easy to copy.

### Real-Time Updates

When a new OTP is generated:

- A new message should appear automatically.
- Play a subtle notification animation.
- Update the unread message count.
- Display a toast notification.

Do not require page refresh.

### Empty Inbox State

When there are no messages, show an attractive empty state:

"No messages yet"

"Your incoming verification messages will appear here."

Include a small animated inbox illustration.

---

# 8. Animation Requirements

Animations should improve the experience without making the application slow.

Use Framer Motion.

Implement:

1. Smooth page transitions.
2. Animated card entrance.
3. Button hover animations.
4. Button click feedback.
5. OTP input focus animations.
6. Loading spinner.
7. Success checkmark animation.
8. Error shake animation.
9. New message slide-in animation.
10. Toast notification animation.
11. Countdown timer transitions.
12. Smooth inbox message expansion.

Use subtle animations rather than excessive effects.

Respect reduced-motion accessibility preferences.

---

# 9. Backend Architecture

Use a modular Express.js architecture.

Suggested backend structure:

```text
backend/
│
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   └── environment.ts
│   │
│   ├── controllers/
│   │   ├── otp.controller.ts
│   │   ├── inbox.controller.ts
│   │   └── session.controller.ts
│   │
│   ├── routes/
│   │   ├── otp.routes.ts
│   │   ├── inbox.routes.ts
│   │   └── session.routes.ts
│   │
│   ├── services/
│   │   ├── otp.service.ts
│   │   ├── sms-simulator.service.ts
│   │   ├── inbox.service.ts
│   │   └── session.service.ts
│   │
│   ├── middleware/
│   │   ├── error.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   └── validation.middleware.ts
│   │
│   ├── utils/
│   │   ├── crypto.ts
│   │   ├── phone-validation.ts
│   │   └── response.ts
│   │
│   ├── sockets/
│   │   └── inbox.socket.ts
│   │
│   ├── app.ts
│   └── server.ts
│
├── prisma/
│   └── schema.prisma
│
├── package.json
└── tsconfig.json
```

Keep controllers, services, routes, and utilities separate.

Business logic must not be placed directly inside route handlers.

---

# 10. API Endpoints

Implement the following REST API endpoints.

| Method | Endpoint                 | Purpose                              |
| ------ | ------------------------ | ------------------------------------ |
| POST   | /api/otp/request         | Generate OTP and simulated message   |
| POST   | /api/otp/verify          | Verify submitted OTP                 |
| POST   | /api/otp/resend          | Generate a replacement OTP           |
| POST   | /api/inbox/pair          | Pair a device using the pairing code |
| GET    | /api/inbox/messages      | Retrieve authorized inbox messages   |
| GET    | /api/inbox/messages/:id  | Retrieve individual message          |
| GET    | /api/health              | Check backend availability           |

Use consistent JSON response structures.

Example OTP request:

```json
{
  "phoneNumber": "+919876543210"
}
```

Example response:

```json
{
  "success": true,
  "message": "OTP generated successfully",
  "data": {
    "sessionId": "verification-session-id",
    "inboxUrl": "/inbox",
    "pairingCode": "123456",
    "expiresIn": 300
  }
}
```

The pairing code must be delivered only to the requesting verification client.

Never return the actual OTP through the verification API.

Example OTP verification request:

```json
{
  "sessionId": "verification-session-id",
  "otp": "483921"
}
```

Example successful response:

```json
{
  "success": true,
  "message": "Phone number verified successfully",
  "data": {
    "verified": true
  }
}
```

Protect all inbox endpoints using the paired device's authentication token.

---

# 11. Database Design

Use PostgreSQL with Prisma ORM.

Create appropriate database models.

Suggested entities:

### VerificationSession

Fields:

- id
- phoneNumber
- otpHash
- expiresAt
- attempts
- status
- createdAt
- verifiedAt

### InboxMessage

Fields:

- id
- verificationSessionId
- sender
- recipient
- messageContent
- createdAt
- expiresAt
- readAt

### InboxPairing

Fields:

- id
- verificationSessionId
- pairingCodeHash
- expiresAt
- usedAt
- createdAt

### InboxDevice

Fields:

- id
- verificationSessionId
- deviceTokenHash
- createdAt
- lastActiveAt

Use proper database relationships and indexes.

Important:

- Never store OTP hashes as plain OTP values.
- Never store pairing codes in plaintext.
- Do not expose database credentials.
- Store secrets in environment variables.
- Implement appropriate retention and cleanup for expired records.
- Do not store unnecessary personal information.

---

# 12. OTP Security Requirements

Security is a critical part of this project.

Implement the following:

| Feature          | Requirement                                 |
| ---------------- | ------------------------------------------- |
| OTP length       | 6 digits                                    |
| OTP generation   | Cryptographically secure random generation |
| OTP expiration   | 5 minutes                                   |
| Maximum attempts | 5                                           |
| Resend cooldown  | 30 seconds                                  |
| OTP usage        | One-time use                                |
| OTP storage      | HMAC-based hash                             |
| Pairing code     | Secure, temporary, single-use               |
| Phone validation | Proper international number validation      |
| API protection   | Rate limiting                               |
| Database access  | Parameterized ORM queries                   |

Use Node.js crypto APIs.

Do not use Math.random() for OTP generation.

Use a keyed HMAC or another appropriate secure verification design for OTP storage.

Use timing-safe comparison when comparing fixed-length hashes.

Invalidate previous OTPs when a replacement OTP is generated.

The pairing code must have a different purpose from the actual OTP.

The pairing code authorizes access to the simulated inbox. The OTP verifies the phone number within the application's demonstration workflow.

---

# 13. Real-Time Communication

Use Socket.IO.

The mobile inbox should receive new messages immediately when the backend generates them.

Expected workflow:

```text
Laptop requests OTP
        |
        v
Backend generates OTP
        |
        v
Backend stores message
        |
        v
Backend emits Socket.IO event
        |
        v
Mobile inbox receives event
        |
        v
New message appears automatically
```

Important requirements:

- Authenticate socket connections.
- Authorize access to the correct inbox.
- Never broadcast OTP messages globally.
- Use session-specific or device-specific rooms.
- Reconnect automatically.
- Fetch missed messages from PostgreSQL after reconnecting.

Database persistence is mandatory.

Socket.IO is only responsible for live notifications, not permanent message storage.

---

# 14. Error Handling

Handle all important error cases.

Examples:

- Invalid phone number.
- Missing phone number.
- OTP generation failure.
- Incorrect OTP.
- Expired OTP.
- Maximum attempts reached.
- Resend requested too early.
- Invalid pairing code.
- Expired pairing code.
- Unauthorized inbox access.
- Database connection failure.
- Socket disconnection.
- Network failure.

Show user-friendly error messages in the frontend.

Do not expose internal server errors or sensitive information.

---

# 15. Deployment Requirements

The project must be designed for deployment.

It should not depend on localhost URLs or local-only communication.

Use environment variables.

Suggested environment configuration:

Backend:

```env
PORT=5000
NODE_ENV=development

DATABASE_URL=

OTP_HASH_SECRET=
PAIRING_HASH_SECRET=

FRONTEND_URL=
BACKEND_PUBLIC_URL=
```

Frontend:

```env
VITE_API_URL=
VITE_SOCKET_URL=
```

Never commit actual credentials or `.env` files to GitHub.

Create `.env.example` files.

### Deployment Architecture

Deploy the following components independently if needed:

```text
             INTERNET
                |
       -------------------
       |                 |
   Frontend           Backend
   Hosting             Hosting
       |                 |
       |                 |
       |             PostgreSQL
       |                 |
       -------------------
                |
         Mobile Browser
```

The frontend should be accessible from the laptop and phone.

The backend must have a public HTTPS URL.

PostgreSQL must be accessible by the backend.

Configure:

- CORS.
- HTTPS.
- Environment variables.
- Database migrations.
- WebSocket support.
- Production build.
- Error logging.
- Health checks.

Prefer free-tier hosting services.

Do not assume that free hosting provides unlimited resources or permanent availability. Verify current free-tier restrictions before deployment.

The complete project must remain usable without paid SMS services.

---

# 16. Testing Requirements

Test the complete workflow.

### Functional Tests

1. Request an OTP.
2. Verify that the OTP is generated.
3. Verify that a message is stored.
4. Open the inbox on another device.
5. Pair the device.
6. Confirm that the OTP appears.
7. Enter the correct OTP.
8. Confirm successful verification.
9. Try an incorrect OTP.
10. Try an expired OTP.
11. Try reusing an already verified OTP.
12. Test resend functionality.

### Security Tests

1. Try accessing an inbox without pairing.
2. Try using an invalid pairing code.
3. Try accessing another session's messages.
4. Try verifying after expiration.
5. Exceed the maximum verification attempts.
6. Try requesting OTPs repeatedly.
7. Check that OTPs are not returned in ordinary API responses.
8. Check that secrets are not exposed in frontend code.

### Multi-Device Tests

Test using:

- Laptop + mobile phone.
- Two different browsers.
- Two separate devices on different networks.
- Disconnected and reconnected mobile browser.

The inbox must retrieve persisted messages after reconnection.

---

# 17. GitHub Repository Structure

Use a monorepo structure.

```text
phone-otp-verification-system/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── context/
│   │   ├── types/
│   │   └── App.tsx
│   │
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── src/
│   ├── prisma/
│   └── package.json
│
├── README.md
├── .gitignore
└── package.json
```

The frontend and backend should remain independent applications.

Use a root-level package configuration if needed to simplify development.

---

# 18. Development Instructions for the AI Coding Agent

Follow these instructions carefully.

You are implementing a complete full-stack application, not just a UI prototype.

### General Rules

1. Understand the complete project requirements before implementation.
2. Follow the specified architecture.
3. Use TypeScript throughout the frontend and backend.
4. Write modular, maintainable code.
5. Keep frontend and backend responsibilities separate.
6. Use PostgreSQL for persistent storage.
7. Use Prisma for database operations.
8. Implement real-time communication using Socket.IO.
9. Do not use paid SMS APIs.
10. Do not simulate OTP verification by simply displaying a hardcoded OTP.
11. Implement actual cryptographic OTP generation and backend verification.
12. Ensure the mobile inbox is accessible independently.
13. Ensure that messages remain available after closing the inbox browser.
14. Implement secure inbox pairing.
15. Make the application deployment-ready.

### Frontend Rules

- Create a visually rich and colorful application.
- Use gradients, animations, attractive cards, and modern typography.
- Use Framer Motion.
- Make the verification portal responsive.
- Make the inbox mobile-first.
- Implement loading, success, error, and empty states.
- Maintain a consistent design system.
- Avoid generic, unfinished-looking interfaces.

### Backend Rules

- Implement proper REST APIs.
- Keep business logic inside service modules.
- Validate all incoming requests.
- Implement OTP expiration.
- Implement maximum verification attempts.
- Implement resend cooldown.
- Implement secure pairing.
- Protect inbox endpoints.
- Implement appropriate rate limiting.
- Persist all necessary records in PostgreSQL.

### Deployment Rules

- Use environment variables.
- Configure production CORS.
- Support HTTPS deployment.
- Support WebSocket connections in production.
- Provide database migrations.
- Never hardcode localhost URLs into production logic.
- Never expose secrets in frontend code.

### Working Method

Do not attempt to build everything in one uncontrolled operation.

Work in phases.

After completing each phase:

1. Explain what was implemented.
2. List the files created or modified.
3. Explain important technical decisions.
4. Run the relevant tests.
5. Fix errors before proceeding.
6. Wait for confirmation before starting the next major phase.

Do not silently skip requirements.

If a requirement cannot be implemented as specified, explain why and propose an alternative before changing the architecture.

---

# 19. Implementation Phases

Follow this development sequence.

| Phase | Work                                         |
| ----- | -------------------------------------------- |
| 1     | Project initialization and folder structure |
| 2     | Backend setup and database configuration    |
| 3     | OTP generation and hashing                  |
| 4     | Simulated SMS gateway                       |
| 5     | Verification session management             |
| 6     | Inbox pairing and authorization             |
| 7     | OTP verification and expiration             |
| 8     | REST API integration                        |
| 9     | Socket.IO real-time messaging               |
| 10    | Verification portal frontend                |
| 11    | Virtual inbox frontend                      |
| 12    | Animations and responsive design            |
| 13    | Security and error handling                 |
| 14    | Testing and debugging                       |
| 15    | GitHub documentation                        |
| 16    | Production deployment                       |

Do not move directly to deployment before completing functional and security testing.

---

# 20. Final Expected Result

The completed application should provide the following experience:

**On Laptop:**

Open the deployed verification website.

Enter a mobile number.

Request an OTP.

See the pairing instructions.

Enter the OTP received from the virtual inbox.

Verify the phone number.

See a successful verification screen.

**On Mobile Phone:**

Open the deployed virtual inbox URL in Chrome.

Enter the pairing code.

Access the corresponding inbox.

Receive the simulated OTP message automatically.

Copy the OTP.

The inbox must work independently of the laptop verification interface.

Both interfaces must communicate through the deployed backend over the internet.

---

# 21. Project Limitations

This project uses a simulated SMS gateway.

It does not send real SMS messages through mobile network operators.

The virtual inbox is a browser-based application, not the phone's native SMS application.

The OTP verification demonstrates the application's verification workflow, but it does not independently establish ownership of the actual mobile number.

To establish real mobile number ownership, a real SMS or another trusted phone-verification channel is required.

The project is intended as a full-stack engineering and authentication learning project.

---

# 22. Definition of Completion

The project is considered complete only when:

- [ ] Verification portal works.
- [ ] Phone number validation works.
- [ ] Secure six-digit OTP generation works.
- [ ] OTP hashing works.
- [ ] Simulated SMS delivery works.
- [ ] Inbox pairing works.
- [ ] Inbox works on another device.
- [ ] Messages persist in PostgreSQL.
- [ ] Live inbox updates work.
- [ ] OTP verification works.
- [ ] OTP expiration works.
- [ ] Resend functionality works.
- [ ] Maximum attempt restriction works.
- [ ] Inbox authorization works.
- [ ] Frontend animations work.
- [ ] Mobile responsiveness works.
- [ ] Security tests pass.
- [ ] Application is deployed.
- [ ] GitHub repository is documented.

**Final objective: Build a polished, secure, full-stack, multi-device OTP verification application that costs ₹0 to develop and test using simulated SMS delivery.**
