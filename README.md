# RentDesk

RentDesk is a cross-platform property management system with a shared API server, a desktop app (Electron + React), and a mobile app (Expo + React Native).

## Repository Structure

- `backend/` Node.js + Express + TypeScript API
- `desktop/` Electron + React + Tailwind desktop client
- `mobile/` Expo + React Native mobile client

## Backend

### Setup

1. Copy `.env.example` to `.env` and fill MongoDB Atlas credentials.
2. Add SMTP credentials if you want forgot-password OTP emails to work.
3. Install dependencies and start the server:

```bash
cd backend
npm install
npm run dev
```

`npm run dev` now uses `nodemon`, so the backend restarts automatically when files in `backend/src` change.

### Seed Sample Data

```bash
cd backend
npm run seed
```

Sample users created by the seed:
- Owner: `owner@rentdesk.local` / `Owner@123`
- Manager: `manager@rentdesk.local` / `Manager@123`
- Accountant: `accountant@rentdesk.local` / `Accountant@123`

## Desktop App

### Setup

```bash
cd desktop
npm install
npm run dev
```

Set `VITE_API_URL` in `desktop/.env` if the API server is not running on `http://localhost:4000/api`.

## Mobile App

### Setup

```bash
cd mobile
npm install
npm run start
```

Set `EXPO_PUBLIC_API_URL` in `mobile/.env` to your backend URL.

Important for mobile:
- `http://localhost:4000/api` works for desktop, but usually does not work on a phone.
- If you run the mobile app on a real device, use your computer's LAN IP, for example `http://192.168.1.22:4000/api`.
- After changing `mobile/.env`, restart Expo so the new value is picked up.

## Notes

- All documents and images are stored as Base64 strings directly in MongoDB.
- Forgot-password OTP email uses the backend SMTP settings from `backend/.env`.
- Use the property-based routes to manage units, tenants, rent, and utilities.
- Export reports from the desktop app or by calling the `/reports` endpoints.
