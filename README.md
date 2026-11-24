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

## 🚀 Running the Project

1. Open PowerShell or Command Prompt:
   ```powershell
   cd "C:\Users\shenk\.gemini\antigravity\scratch\roninlife-app"
   ```

2. Start the application (zero external npm dependencies required — runs natively on Node.js):
   ```powershell
   npm start
   ```

3. Open in your browser:
   - **Public Visitor Showcase**: `http://localhost:3000`
   - **Author Admin Dashboard**: `http://localhost:3000/admin`

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
