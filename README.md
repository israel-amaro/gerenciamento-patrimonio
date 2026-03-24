# Educational Equipment Control System

A production-ready equipment control system designed for educational institutions to manage laptops, lab computers, and technical audits with a clean, sober enterprise UI.

## Features
- Box/Lot loans for professors.
- Quick mobile checklists for labs.
- Technical audits using QR codes.
- Incident tracking and automated notifications.
- Admin dashboard.

## Tech Stack
- Frontend: React + Vite, TypeScript, Tailwind CSS
- Data Layer/Auth: Supabase, TanStack Query

## Setup Instructions
1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a Supabase project and execute `supabase/schema.sql` and `supabase/seed.sql` in the SQL Editor.

3. Copy configuration:
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase URL and Anon Key.

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Access `http://localhost:5173`.
