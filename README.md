# StudyFlow

> A focused student workspace for organizing classes, assignments, calendar events, and study sessions in one place.

StudyFlow brings the essential parts of a student's academic workflow together in one responsive application. Keep track of what is due, plan when to study, and manage class information without switching between multiple tools.

## Tech Stack

| Category | Technology |
| --- | --- |
| Framework | Next.js App Router with TypeScript |
| Interface | React and Tailwind CSS |
| Authentication | NextAuth.js credentials authentication |
| Database | Prisma 7 with SQLite and better-sqlite3 |
| Planning | date-fns for calendar and study planning calculations |
| Icons | lucide-react |

## Setup

### 1. Clone the repository

Clone the repository and enter the project directory.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env.local` from `.env.local.example`, then set the following values:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Set up the database

Generate the Prisma client and apply the existing migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Credentials-based registration, login, JWT sessions, and protected routes
- Dashboard overview with assignments, schedule, and quick actions
- Calendar month and week views with event CRUD and day details
- Class Manager with class records, assignment tracking, grades, progress, and due-date indicators
- Assignment-to-calendar synchronization with completion checkmarks and cleanup
- Study Helper with a `localStorage`-backed focus timer and browser completion sound
- Study session planner with optional class association and insights
- Responsive desktop sidebar and mobile icon navigation
- Shared toast notifications, loading skeletons, empty states, and error handling

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |

## Team

- StudyFlow Group Project Team
