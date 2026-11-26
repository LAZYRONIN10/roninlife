# RONINLIFE — Full-Stack Creative Vault

A complete, production-ready full-stack creative web application with dedicated frontend, backend, and cloud database architecture.

---

## 🏛️ Deployment Architecture: Neon + Render + GitHub

- **Render**: Hosts the live Node.js backend & frontend application.
- **Neon PostgreSQL**: Cloud serverless database storing vault titles (books, movies, stories), user/author accounts, sessions, and visitor suggestions.
- **GitHub**: Maintains the source code repository with automated CI/CD to Render.

```
                  ┌──────────────────────┐
                  │    GitHub Repo       │
                  │  (Source & CI/CD)    │
                  └──────────┬───────────┘
                             │ pushes
                             ▼
  ┌────────────────┐     ┌──────────────────────┐
  │ Neon Postgres  │◄───►│    Render Service    │
  │  (Database)    │     │  (Node.js + Frontend)│
  └────────────────┘     └──────────▲───────────┘
                                    │
                            Visitors & Author
```

---

## 📁 Project Architecture

```
roninlife-app/
│
├── .env                       # Local secret config (ignored by git)
├── .env.example               # Template for cloud deployment variables
├── .gitignore                 # Prevents pushing .env, node_modules, and logs
├── package.json               # Project manifest (pg driver)
├── render.yaml                # Render Infrastructure-as-Code Blueprint
├── README.md                  # Documentation
├── server.js                  # Node.js HTTP server & API dispatcher
│
├── backend/                   # 🔒 BACKEND & DATABASE
│   ├── config.js              # Server configuration & environment parser
│   ├── db.js                  # Neon PostgreSQL connection, schema & auto-seeding
│   ├── middleware/
│   │   └── auth.js            # Cryptographic scrypt authentication & session tokens
│   ├── routes/
│   │   ├── auth.js            # /api/auth/login, verify, logout
│   │   ├── library.js         # /api/library (GET), /api/items (POST, DELETE)
│   │   └── suggestions.js     # /api/suggestions (POST visitor, GET/DELETE admin)
│   └── data/
│       ├── library.json       # Initial seed database (books, stories & films)
│       └── suggestions.json   # Local fallback inbox
│
└── frontend/                  # 🎨 MODULAR FRONTEND
    ├── index.html             # Public visitor showcase (zero admin code/forms)
    ├── admin.html             # Dedicated author admin dashboard (/admin)
    ├── css/
    │   ├── style.css          # Dark cinematic styles, 3D card tilt, modals
    │   └── admin.css          # Clean admin dashboard, stats cards, tables
    └── js/
        ├── app.js             # Public client script (search, filters, reader, suggestion)
        └── admin.js           # Admin dashboard script (login, publish, delete, inbox)
```

---

## 🚀 Setup & Cloud Deployment Guide

### 1. Create your Free Neon PostgreSQL Database
1. Go to [neon.tech](https://neon.tech) and sign up / log in.
2. Click **Create Project** (Name: `roninlife-db`).
3. Under **Connection Details**, copy your **Connection String** (`postgresql://...`).
4. Ensure `Pooled connection` is selected or standard connection with `?sslmode=require`.

### 2. Deploy to Render
1. Go to [render.com](https://render.com) and log in with your GitHub account.
2. Click **New +** ➔ **Web Service**.
3. Connect your repository: `LAZYRONIN10/roninlife`.
4. Configure the service settings:
   - **Name**: `roninlife`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. In **Environment Variables**, add:
   - `DATABASE_URL`: *(Paste your Neon connection string)*
   - `ADMIN_PASSWORD`: *(Choose a strong secret author password)*
   - `AUTHOR_EMAIL`: *(Your email address)*
6. Click **Deploy Web Service**!
7. The database tables (`users`, `library_items`, `suggestions`, `sessions`) will be automatically created and seeded on the first boot.

---

## 💻 Running Locally

1. Install dependencies:
   ```powershell
   npm install
   ```

2. (Optional) In your local `.env`, paste your Neon `DATABASE_URL`:
   ```env
   PORT=3000
   ADMIN_PASSWORD=your_secret_password
   AUTHOR_EMAIL=author@roninlife.com
   DATABASE_URL=postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require
   ```
   *(Note: If `DATABASE_URL` is omitted, the app automatically runs in local JSON file-based mode!)*

3. Start the server:
   ```powershell
   npm start
   ```

4. Open in browser:
   - **Public Showcase**: `http://localhost:3000`
   - **Author Admin Dashboard**: `http://localhost:3000/admin`


---

## 🌐 Publishing as a Website on GitHub Pages

This vault is pre-configured to deploy effortlessly to **GitHub Pages**:

### Option A: Automatic Deployment via GitHub Actions (Recommended)
1. Push this repository to GitHub.
2. In your GitHub repository, click **Settings** → **Pages**.
3. Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. The included `.github/workflows/deploy.yml` workflow will automatically build and publish your website!

### Option B: Deploy from Branch
1. In your GitHub repository, click **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, select **Deploy from a branch**.
3. Set the branch to `main` and folder to `/ (root)`.
4. Click **Save**. The root `index.html` will seamlessly load your vault showcase.

---

## ☁️ Full-Stack Cloud Deployment (Optional)

If you wish to host the dynamic author backend with persistent live API authentication:
- **Render / Railway / Glitch**: Connect your GitHub repository, set the build command to `npm install` (or none, zero dependencies needed), and start command to `node server.js`. Add your `ADMIN_PASSWORD` in environment variables.

---

## 🔑 Author Authentication

- Change your password in `.env`:
  ```env
  PORT=3000
  ADMIN_PASSWORD=your_secret_password
  ```
- Navigate to `http://localhost:3000/admin` and enter your password.
- Once authenticated, you can:
  - 🚀 **Publish new books, short stories, films, or series**
  - 📚 **Manage and delete vault items**
  - 📥 **Review and adopt recommendations from visitors**
