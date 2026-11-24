# RONINLIFE — Full-Stack Creative Vault

A complete, production-ready full-stack creative web application with dedicated frontend and backend separation.

---

## 📁 Project Architecture

```
roninlife-app/
│
├── .env                       # Secret author password & server configuration (ignored by git)
├── .env.example               # Safe template for cloud deployment
├── .gitignore                 # Prevents pushing .env and logs to GitHub
├── package.json               # Project manifest
├── README.md                  # Documentation
├── server.js                  # Pure Node.js HTTP server & API dispatcher
│
├── backend/                   # 🔒 SECURE BACKEND
│   ├── config.js              # Server configuration & JSON data helpers
│   ├── middleware/
│   │   └── auth.js            # Cryptographic token auth & constant-time password checks
│   ├── routes/
│   │   ├── auth.js            # /api/auth/login, verify, logout
│   │   ├── library.js         # /api/library, /api/items (POST, DELETE)
│   │   └── suggestions.js     # /api/suggestions (POST visitor, GET/DELETE admin)
│   └── data/
│       ├── library.json       # Permanent database for books, stories & films
│       └── suggestions.json   # Visitor recommendations inbox
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

## 🚀 Running the Project Locally

1. Open PowerShell or Command Prompt in the project folder:
   ```powershell
   npm start
   ```

2. Open in your browser:
   - **Public Visitor Showcase**: `http://localhost:3000`
   - **Author Admin Dashboard**: `http://localhost:3000/admin` (or `/admin.html`)

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
