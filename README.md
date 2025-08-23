# Social Media Scheduler

A SaaS social media scheduling tool that enables users to schedule and manage posts across multiple platforms. The initial implementation focuses on Threads integration with a flexible architecture to support additional platforms in the future.

## Tech Stack

- **Frontend**: Next.js 14 with React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Coolify on VPS
- **State Management**: Zustand for client-side state
- **UI Components**: Radix UI primitives with custom styling

## Project Structure

```
src/
├── app/                 # Next.js 14 app router
│   ├── globals.css     # Global styles with Tailwind
│   ├── layout.tsx      # Root layout component
│   └── page.tsx        # Home page
├── components/         # React components
│   ├── ui/            # Reusable UI components
│   ├── calendar/      # Calendar-related components
│   ├── posts/         # Post creation and management
│   ├── time-slots/    # Time slot configuration
│   └── auth/          # Authentication components
├── services/          # Business logic and external services
│   ├── supabase.ts    # Supabase client configuration
│   ├── scheduling.ts  # Core scheduling logic
│   ├── platform-manager.ts # Platform plugin management
│   └── platforms/     # Platform-specific integrations
├── types/             # TypeScript type definitions
│   ├── index.ts       # Core application types
│   ├── database.ts    # Database schema types
│   ├── platform.ts    # Platform plugin interfaces
│   └── api.ts         # API request/response types
└── utils/             # Utility functions and helpers
    ├── date.ts        # Date and time utilities
    ├── validation.ts  # Input validation helpers
    ├── constants.ts   # Application constants
    └── format.ts      # Data formatting utilities
```

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:
   ```bash
   cp .env.local.example .env.local
   ```

3. **Configure Supabase**:
   - Create a new Supabase project
   - Add your project URL and anon key to `.env.local`
   - Set up the database schema (see database migrations)

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Environment Variables

Required environment variables (see `.env.local.example`):

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `NEXTAUTH_SECRET` - Secret for NextAuth.js
- `THREADS_CLIENT_ID` - Threads API client ID
- `THREADS_CLIENT_SECRET` - Threads API client secret

## Features

- 📅 Calendar-based post visualization
- ⏰ Automated scheduling with time slots
- 🧵 Threads integration with thread support
- 📱 Responsive design with Tailwind CSS
- 🔐 Secure authentication with Supabase Auth
- 🔌 Plugin-based architecture for multiple platforms
- 📊 Real-time post status tracking

## Development

- **Linting**: `npm run lint`
- **Type checking**: `npx tsc --noEmit`
- **Build**: `npm run build`
- **Start production**: `npm start`

## Architecture

The application uses a modular, plugin-based architecture:

- **Frontend Layer**: React/Next.js components with Tailwind CSS
- **API Layer**: Next.js API routes with authentication middleware
- **Service Layer**: Business logic and platform integrations
- **Data Layer**: Supabase for database, authentication, and storage

## Contributing

1. Follow the existing code structure and naming conventions
2. Add TypeScript types for all new interfaces
3. Write tests for new functionality
4. Update documentation as needed

## License

This project is private and proprietary.
