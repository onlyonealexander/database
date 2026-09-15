# Kaasfield Farms DBMS

React + Neon PostgreSQL farm operations system. The browser talks to the local API server; the Neon connection string is never exposed to frontend code.

## Connect Neon

1. Create a project at neon.tech.
2. Copy the project connection string from Neon.
3. Create `.env.local` beside `package.json` using `.env.example`:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=use-a-long-random-secret
CLIENT_ORIGIN=http://localhost:5173
```

4. In the Neon SQL Editor, paste and run `supabase/schema.sql`. It is PostgreSQL-compatible and includes the farm tables, relationships, indexes, inventory transaction trigger, and seed data.
5. Start both the API and Vite frontend:

```powershell
npm run dev
```

The API runs on `http://localhost:3001` and the frontend on `http://localhost:5173`. The first account is a staff account; promote it to admin with:

```sql
update profiles set role = 'admin' where email = 'your-email@example.com';
```

Never put `DATABASE_URL` in a `VITE_` variable. Vite variables are sent to the browser.
