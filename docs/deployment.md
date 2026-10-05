# Deployment guidance

## Overview & Architecture

ClinicOS runs as an independent, lightweight clinical operating system without external EMR dependencies. The stack comprises:

- **Web Frontend (`@clinicos/web`)**: Single Page Application built with Vite and React.
- **Backend API (`@clinicos/api`)**: Node.js 22 Express REST API managing authentication, queue, encounters, billing, inventory, and lab workflows.
- **Background Worker (`@clinicos/worker`)**: BullMQ worker processing background notifications (payment receipts, appointment confirmations, lab results, queue tokens) via webhooks, SMTP, or console logs.
- **Database**: MongoDB (Atlas M0 Free Tier or local MongoDB >= 7.0).
- **Queue/Cache**: Redis (Upstash Free Tier or local Redis >= 7.0).

---

## 100% Free Cloud Deployment Guide

You can deploy ClinicOS completely free using reputable cloud free tiers:

| Component             | Free Platform               | Free Tier Specifications                                                   |
| :-------------------- | :-------------------------- | :------------------------------------------------------------------------- |
| **Database**          | **MongoDB Atlas**           | M0 Free Cluster (512MB storage, replica set enabled for ACID transactions) |
| **Cache & Queues**    | **Upstash Redis**           | Serverless Redis (10,000 commands/day free, zero maintenance)              |
| **Backend API**       | **Render.com** or **Koyeb** | Free Web Service (512MB RAM, HTTPS, custom domain)                         |
| **Web Frontend**      | **Vercel**                  | Free Hobby Plan (Global CDN, automated Git deployments, HTTPS)             |
| **Background Worker** | **Render.com** / Background | Run alongside or as a secondary free service on Render/Koyeb               |

---

### Step 1: Set Up Free Database (MongoDB Atlas)

1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free **M0 Sandbox** cluster (choose AWS or GCP in your closest region).
3. Under **Security > Database Access**, add a database user `clinicos-app` with a strong password and `readWriteAnyDatabase` privileges.
4. Under **Security > Network Access**, click **Add IP Address** -> Allow Access From Anywhere (`0.0.0.0/0`) or whitelist your Render egress IPs.
5. Click **Connect** -> **Drivers (Node.js)** -> copy your connection URI:
   ```env
   MONGODB_URI=mongodb+srv://clinicos-app:<password>@cluster0.xxxx.mongodb.net/clinicos?retryWrites=true&w=majority
   ```

_(Note: MongoDB Atlas M0 clusters run as 3-node replica sets, enabling native multi-document ACID transactions automatically)._

---

### Step 2: Set Up Free Redis (Upstash)

1. Sign up at [upstash.com](https://upstash.com).
2. Click **Create Database**, name it `clinicos-redis`, and pick the region closest to your MongoDB Atlas cluster.
3. In the database dashboard, find the **Redis Connect URL** (ioredis format):
   ```env
   REDIS_URL=rediss://default:<password>@<endpoint>.upstash.io:6379
   ```

---

### Step 3: Deploy Backend API (Render.com)

1. Push your repository to GitHub / GitLab.
2. Sign up at [render.com](https://render.com) and click **New + > Web Service**.
3. Connect your Git repository.
4. Configure service settings:
   - **Name**: `clinicos-api`
   - **Root Directory**: `.` (monorepo root)
   - **Runtime**: `Node`
   - **Build Command**: `npm ci && npm run build --workspace @clinicos/contracts`
   - **Start Command**: `npm start --workspace @clinicos/api`
   - **Instance Type**: `Free`
5. Under **Environment Variables**, add:
   ```env
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=mongodb+srv://clinicos-app:<password>@cluster0.xxxx.mongodb.net/clinicos?retryWrites=true&w=majority
   REDIS_URL=rediss://default:<password>@<endpoint>.upstash.io:6379
   JWT_SECRET=<generate-at-least-64-random-chars>
   COOKIE_SECURE=true
   CORS_ORIGINS=https://your-frontend.vercel.app,https://clinicos-api.onrender.com
   APP_BASE_URL=https://your-frontend.vercel.app
   ```
6. Deploy the service. Note down your API URL (e.g., `https://clinicos-api.onrender.com`).
7. In the Render Shell tab, run the initialization tasks:
   ```bash
   # 1. Create database indexes:
   npm run db:indexes --workspace @clinicos/api

   # 2. Seed your initial clinic administrator account:
   npm run seed:admin --workspace @clinicos/api
   ```
   _(Save the printed temporary admin credentials from the console)._

---

### Step 4: Deploy Background Worker (Render.com)

1. On Render, click **New + > Background Worker** (or another Web Service with worker start command).
2. Connect the same repository with:
   - **Build Command**: `npm ci && npm run build --workspace @clinicos/contracts`
   - **Start Command**: `npm start --workspace @clinicos/worker`
   - **Environment Variables**:
     ```env
     NODE_ENV=production
     REDIS_URL=rediss://default:<password>@<endpoint>.upstash.io:6379
     NOTIFICATION_PROVIDER=console
     ```

---

### Step 5: Deploy Frontend (Vercel)

1. Sign up at [vercel.com](https://vercel.com) and click **Add New > Project**.
2. Import your GitHub repository.
3. Set the Framework Preset to **Vite** (Vercel auto-detects `vercel.json`).
4. Update `vercel.json` in your repository if you want Vercel to proxy `/api/*` requests to your backend (recommended to avoid cross-domain cookie restrictions):
   ```json
   "rewrites": [
     { "source": "/api/:path*", "destination": "https://clinicos-api.onrender.com/api/:path*" },
     { "source": "/login", "destination": "/index.html" },
     { "source": "/change-password", "destination": "/index.html" },
     { "source": "/app/:path*", "destination": "/index.html" },
     { "source": "/display/:path*", "destination": "/index.html" }
   ]
   ```
5. Deploy. Your application will be live at `https://your-project.vercel.app`.

---

## Production Security Checklist

1. Replace all default passwords and secrets before real patient intake.
2. Generate a non-example `JWT_SECRET` (at least 64 random characters):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
3. Ensure `COOKIE_SECURE=true` in production mode.
4. Run `npm run db:indexes --workspace @clinicos/api` on initial setup and after schema updates.
5. Log in using the seeded admin account and immediately navigate to `/change-password` to establish a permanent password.
6. Restrict remote database/redis access to application hosts.

## Backups

- **MongoDB Atlas**: Automatic continuous backups and restore points are included in MongoDB Atlas. For offline recovery, periodically run `mongodump --uri="<MONGODB_URI>" --out=./backup` and store encrypted copies.
