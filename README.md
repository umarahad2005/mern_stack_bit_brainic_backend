# Bit Brainic — Backend

REST API server for **Bit Brainic**, an AI computer-science tutor chatbot. It handles user accounts, stores chat history in MongoDB, and generates tutor replies with Google Gemini.

## Tech stack

- Node.js (ES modules) + Express
- MongoDB with Mongoose
- Google Gemini via `@google/genai`
- JWT authentication (`jsonwebtoken`) and password hashing (`bcryptjs`)
- Nodemailer for password-reset and contact-form emails
- nodemon for development

## Features

- **Auth**: register, login, get current user, update profile/password, delete account (JWT, 30-day tokens)
- **Password reset**: emailed reset link with a hashed token that expires after 10 minutes
- **Personalisation**: users can save a list of interests and a custom "persona" prompt that are added to the tutor's system prompt
- **Chats**: create, list, rename and delete chats; send a message and get a Gemini reply. The last 30 messages are sent as context, and the first message sets the chat title
- **Gemini handling**: system prompt keeps answers to computer-science topics; retries with exponential backoff and a fallback model on 429/503 errors
- **Admin**: password-protected (`x-admin-password` header) stats dashboard data (users, chats, messages, 7-day activity) and user management (list, view, update, delete)
- **Public stats** endpoint and a **contact form** endpoint
- `/health` health-check route and centralised error handling for Mongoose errors

## Project structure

```
server/
├── config/db.js        # MongoDB connection
├── middleware/         # JWT auth and admin password checks
├── models/             # User, Chat, Message schemas
├── routes/             # auth, chat, admin, contact routes
├── services/           # Gemini client and email sending
├── server.js           # Express app entry point
└── .env.example
```

## API routes

Routes are mounted at the server root (no `/api` prefix):

| Prefix     | Endpoints |
|------------|-----------|
| `/auth`    | `POST /register`, `POST /login`, `GET /me`, `POST /forgot-password`, `POST /reset-password/:token`, `PUT /profile`, `PUT /password`, `PUT /interests`, `PUT /persona`, `DELETE /account` |
| `/chat`    | `GET /`, `POST /`, `GET /:id`, `POST /:id/message`, `PUT /:id`, `DELETE /:id` (all require a Bearer token) |
| `/admin`   | `POST /verify`, `GET /public-stats`, `GET /stats`, `GET /users`, `GET/PUT/DELETE /users/:id` |
| `/contact` | `POST /` |
| `/health`  | `GET /health` |

## Getting started

Requires Node.js and a MongoDB database (local or Atlas).

```bash
cd server
npm install
cp .env.example .env   # then fill in your own values
npm run dev            # frees port 5000, then starts with nodemon
```

Other scripts: `npm start` (nodemon) and `npm run prod` (plain `node server.js`). The `dev`, `start` and `prod` scripts run `npx kill-port 5000` first.

## Environment variables

Set these in `server/.env` (see `server/.env.example`):

| Variable | Used for |
|----------|----------|
| `PORT` | Server port (default `5000`) |
| `MONGODB_URI` | MongoDB connection string (required) |
| `JWT_SECRET` | Signing JWTs |
| `GEMINI_API_KEY` | Google Gemini API |
| `ADMIN_PASSWORD` | Admin routes |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_EMAIL`, `SMTP_PASSWORD`, `FROM_NAME` | Password-reset emails |
| `CLIENT_URL` | Frontend URL used in reset links (default `http://localhost:5173`) |
| `EMAIL_USER`, `EMAIL_PASS` | Contact form (Gmail); if `EMAIL_PASS` is unset, submissions are only logged |
| `NODE_ENV` | Hides stack traces in error responses when `production` |
