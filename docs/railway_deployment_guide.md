# Deploying ACES Backend to Railway

## Architecture on Railway

You'll create **2 services** inside one Railway **project**:

| Service | Type | Purpose |
|---------|------|---------|
| **Postgres** | Railway plugin | Database (with migrations & runtime role) |
| **API** | Docker deploy | Go backend from your [Dockerfile](file:///home/nodexxplorer/Desktop/Aces%20here/backend/Dockerfile) |

> [!TIP]
> Railway gives you a free PostgreSQL plugin with $5/month of free usage on the trial plan. For production, use the Pro plan ($5/month + usage).

---

## Step-by-Step

### 1. Create a Railway Project

1. Go to [railway.app](https://railway.app) and sign in (GitHub OAuth is easiest).
2. Click **"New Project"** → **"Empty Project"**.

### 2. Add PostgreSQL

1. Inside your project, click **"+ New"** → **"Database"** → **"Add PostgreSQL"**.
2. Railway provisions a Postgres instance immediately.
3. Go to the Postgres service → **"Variables"** tab. You'll see variables like:
   - `DATABASE_URL` — the full connection string
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

> [!IMPORTANT]
> Copy the `DATABASE_URL` value — you'll need it for migrations and the runtime role setup. It looks like:
> ```
> postgresql://postgres:xxxx@autorack.proxy.rlwy.net:12345/railway
> ```

### 3. Run Migrations (from your local machine)

Your backend uses [golang-migrate](file:///home/nodexxplorer/Desktop/Aces%20here/backend/Makefile#L21-L23). Run them locally against the Railway database:

```bash
# Install migrate if you haven't
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Run migrations using Railway's DATABASE_URL (the owner connection)
cd /home/nodexxplorer/Desktop/Aces\ here/backend

DB_SOURCE="postgresql://postgres:xxxx@autorack.proxy.rlwy.net:12345/railway?sslmode=require" make migrate-up
```

> [!WARNING]
> Use `sslmode=require` — Railway requires SSL for external connections.

### 4. Create the Runtime Role

Your app uses [row-level security](file:///home/nodexxplorer/Desktop/Aces%20here/backend/deploy/postgres/runtime-role.sql) with a restricted `aces_app` role. Create it on Railway's Postgres:

```bash
# Pick a strong password for the runtime role
export APP_DB_PASSWORD="$(openssl rand -base64 32)"
echo "Save this password: $APP_DB_PASSWORD"

# Run the runtime-role script as the owner (postgres user)
DB_SOURCE="postgresql://postgres:xxxx@autorack.proxy.rlwy.net:12345/railway?sslmode=require" \
APP_DB_PASSWORD="$APP_DB_PASSWORD" \
make runtime-role
```

This creates the `aces_app` role with the proper RLS-safe grants.

### 5. Seed Departments

Register your departments using `cmd/tenant`:

```bash
DB_SOURCE="postgresql://postgres:xxxx@autorack.proxy.rlwy.net:12345/railway?sslmode=require" \
go run ./cmd/tenant -import deploy/departments.json
```

### 6. Seed Admin

```bash
# Use the RUNTIME role's connection string this time
DB_SOURCE="postgresql://aces_app:$APP_DB_PASSWORD@autorack.proxy.rlwy.net:12345/railway?sslmode=require" \
ADMIN_EMAIL=admin@aces.zone \
go run ./cmd/seed_admin -tenant uniuyo-ce
```

> [!CAUTION]
> The password is printed **once** — save it immediately!

### 7. Deploy the API Service

1. In your Railway project, click **"+ New"** → **"GitHub Repo"** (or **"Deploy from local"**).
2. **If using GitHub**: connect your repo. Set the **Root Directory** to `backend` if your repo has both frontend and backend at the top level.
3. **If deploying from CLI**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login and link
   railway login
   cd /home/nodexxplorer/Desktop/Aces\ here/backend
   railway link   # select your project
   
   # Deploy
   railway up
   ```

Railway will detect the [Dockerfile](file:///home/nodexxplorer/Desktop/Aces%20here/backend/Dockerfile) and build automatically.

### 8. Set Environment Variables

In the API service → **"Variables"** tab, add these:

```env
# Database — use the RUNTIME role, not the owner
DB_SOURCE=postgresql://aces_app:<APP_DB_PASSWORD>@<PGHOST>:<PGPORT>/railway?sslmode=require
DB_ALLOW_RLS_BYPASS=false
DB_MAX_CONNS_PER_TENANT=2
DB_MAX_CONNS_SYSTEM=2
DEFAULT_TENANT_SLUG=uniuyo-ce

# Server
SERVER_ADDRESS=0.0.0.0:$PORT
ENVIRONMENT=production

# JWT — generate a strong secret
JWT_SECRET=<generate with: openssl rand -base64 48>
JWT_ACCESS_MINUTES=60
JWT_REFRESH_DAYS=10080

# CORS — your frontend URL(s)
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173

# Admin
ADMIN_EMAIL=admin@aces.zone

# Paystack (use live keys for production)
PAYSTACK_SECRET_KEY=sk_live_xxx
PAYSTACK_PUBLIC_KEY=pk_live_xxx

# Storage
STORAGE_LOCAL_PATH=./uploads
UPLOAD_LINK_MINUTES=1440

# Frontend URL (for Paystack callbacks & email links)
FRONTEND_PUBLIC_URL=https://your-frontend.vercel.app

# SMTP (use a real provider like Brevo, Resend, or Mailgun)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USERNAME=your-username
SMTP_PASSWORD=your-password
SMTP_FROM=no-reply@aces.zone
SMTP_MOCK=false

# Push notifications
PUSH_MOCK=false
VAPID_PUBLIC_KEY=<your key>
VAPID_PRIVATE_KEY=<your key>
VAPID_SUBJECT=mailto:no-reply@aces.zone

# AI (optional)
GEMINI_API_KEY=<your key>
GEMINI_MODEL=gemini-2.5-flash
```

> [!IMPORTANT]
> **Use Railway's internal hostname** for the DB connection. Railway provides a `PGHOST` like `postgres.railway.internal` for service-to-service communication (no SSL needed, use `sslmode=disable`). This is faster and free of egress charges:
> ```
> DB_SOURCE=postgresql://aces_app:<password>@postgres.railway.internal:5432/railway?sslmode=disable
> ```
> You can reference the Postgres service's variables directly with `${{Postgres.PGHOST}}` syntax in Railway's variable editor.

### 9. Set the PORT

Railway injects a `PORT` variable automatically. Your [.env.example](file:///home/nodexxplorer/Desktop/Aces%20here/backend/.env.example#L34) uses `SERVER_ADDRESS=0.0.0.0:8080`, but Railway assigns a random port. Set:

```
SERVER_ADDRESS=0.0.0.0:$PORT
```

Or better — update your Go config to fall back to the `PORT` env var if `SERVER_ADDRESS` isn't set. Railway's convention is `PORT`.

### 10. Expose the API

1. Go to your API service → **"Settings"** → **"Networking"**.
2. Click **"Generate Domain"** — you'll get something like `aces-backend-production.up.railway.app`.
3. Or add a **Custom Domain** (e.g., `api.aces.zone`).

### 11. Add Redis (Optional)

If you want rate limiting across instances:
1. **"+ New"** → **"Database"** → **"Add Redis"**.
2. Set `REDIS_ADDRESS` and `REDIS_PASSWORD` in the API service from the Redis service's variables.

---

## Quick Reference: Railway CLI Commands

```bash
# Install
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Deploy
railway up

# View logs
railway logs

# Open dashboard
railway open

# Run one-off commands (e.g., seed admin)
railway run -- go run ./cmd/seed_admin -tenant uniuyo-ce

# SSH into a running service
railway shell
```

---

## Diagram

```mermaid
graph LR
    subgraph Railway Project
        PG["PostgreSQL<br/>(Railway Plugin)"]
        API["Go API<br/>(Docker)"]
        Redis["Redis<br/>(Optional)"]
    end
    
    FE["Frontend<br/>(Vercel)"] -->|HTTPS| API
    API -->|Internal Network| PG
    API -.->|Internal Network| Redis
    API -->|Paystack API| PS["Paystack"]
    API -->|SMTP| MAIL["Email Provider"]
```

---

## Cost Estimate

| Resource | Hobby Plan | Pro Plan |
|----------|-----------|----------|
| **PostgreSQL** | Shared, 1GB storage | Dedicated, scalable |
| **Go API** | 512MB RAM, shared CPU | 8GB RAM, 8 vCPU |
| **Redis** | Shared | Dedicated |
| **Estimate** | ~$5-10/mo | ~$15-30/mo |

> [!NOTE]
> Railway bills by usage (RAM-hours, CPU-seconds, storage, egress). A low-traffic university app typically stays under $10/month on the Hobby plan.

