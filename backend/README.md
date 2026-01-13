# Backend (Express + Mongoose)

Install & run:
```bash
cd backend
npm install
cp .env.example .env
# edit .env if needed
npm run dev
```

This scaffold includes skeletal routes and models. Implement authentication, validation and WhatsApp logic as needed.


# Admin bootstrap
You can set ADMIN_EMAIL and ADMIN_PASSWORD in .env to create an initial owner account on first run.


# WhatsApp Service
This scaffold uses `whatsapp-web.js` with LocalAuth. Set `WHATSAPP_SESSION_PATH` in .env to control session storage.
Endpoints:
- GET /api/whatsapp/qr
- GET /api/whatsapp/status
- POST /api/whatsapp/send (protected)
- GET /api/whatsapp/logs (protected)


# File uploads
POST /api/uploads (form field 'file') -> returns { url } where file is accessible at /uploads/:filename
