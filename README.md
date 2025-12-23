# AIU Library Room Booking System

A production-ready full-stack library room booking application for Adventist International University with React + TypeScript frontend and Node.js + Express + Prisma backend.

## Features

### User Features
- **Authentication**: JWT-based login and registration
- **Room Booking**: Interactive timeline with drag-to-select
- **My Bookings**: View and manage personal bookings
- **Real-time Availability**: See room availability across the week

### Admin Features
- **Dashboard**: Statistics and analytics
  - Total bookings, active bookings, user count
  - Room utilization charts
  - Recent activity feed
- **User Management**: Create, edit, delete users; promote to admin
- **Room Management**: Add, edit, delete rooms
- **Booking Management**: Advanced filters, search, and CSV export
- **Audit Logging**: Track all administrative actions

### Production Features
- **Security**:
  - Rate limiting on all routes
  - Helmet for security headers
  - CORS configuration
  - Input validation
  - Password hashing (bcrypt)
  - JWT authentication
- **Monitoring**:
  - Winston logging
  - Error tracking
  - Request logging
- **Performance**:
  - Database indexing
  - Optimized queries
  - Connection pooling

## Architecture

```
├── client/                # React + Vite frontend
│   ├── components/        # React components
│   │   ├── AdminDashboard.tsx
│   │   ├── LoginForm.tsx
│   │   ├── Timeline.tsx
│   │   └── ...
│   ├── services/          # API client
│   └── ...
├── server/                # Node.js + Express API
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── middleware/    # Auth, validation, security
│   │   ├── utils/         # Logger, helpers
│   │   └── index.ts       # Server entry
│   ├── prisma/            # Database schema & migrations
│   └── logs/              # Application logs
```

## Tech Stack

### Frontend
- React 19.2.3
- TypeScript
- Vite
- TailwindCSS

### Backend
- Node.js + Express
- Prisma ORM
- SQLite (dev) / MySQL/PostgreSQL (prod)
- JWT authentication
- Winston logging
- Express-rate-limit
- Helmet.js

## Getting Started

### Prerequisites
- Node.js v18 or higher
- npm or yarn
- (Production) MySQL or PostgreSQL

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd AIU-Library-Room-Booking
```

2. **Install dependencies**

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

3. **Set up environment variables**

```bash
# Server
cd server
cp .env.example .env

# Edit .env and set your values:
# - DATABASE_URL
# - JWT_SECRET (use a strong random string)
```

4. **Set up the database**

```bash
cd server

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed the database
npm run prisma:seed
```

### Development

Run both server and client in development mode:

**Terminal 1 - Server:**
```bash
cd server
npm run dev
```
Server runs on http://localhost:5000

**Terminal 2 - Client:**
```bash
cd client
npm run dev
```
Client runs on http://localhost:3000

### Default Users (Development Only)

After seeding the database in development:
- **Student**: alice@uni.edu / student123
- **Admin**: bob@uni.edu / admin123

**Important**: For production, create admin users through the database or API, and users should register with their official university email addresses.

## Production Deployment

### 1. Environment Setup

```bash
cd server
cp .env.production.example .env

# Edit .env with production values:
# - Use MySQL/PostgreSQL DATABASE_URL
# - Set strong JWT_SECRET
# - Set production CLIENT_URL
# - Set NODE_ENV=production
```

### 2. Database Migration

```bash
cd server

# For MySQL, update prisma/schema.prisma:
# datasource db {
#   provider = "mysql"
#   url      = env("DATABASE_URL")
# }

# Run production migrations
npm run prisma:migrate:prod

# Seed production database (optional)
npm run prisma:seed
```

### 3. Build

```bash
# Build server
cd server
npm run build

# Build client
cd ../client
npm run build
```

### 4. Deploy

**Server:**
```bash
cd server
npm run start:prod
```

**Client:**
Serve the `client/dist` folder using:
- Nginx
- Apache
- Vercel
- Netlify
- Any static hosting service

### Environment Variables

#### Server (.env)

```env
DATABASE_URL="mysql://user:pass@host:3306/aiu_library_booking"
JWT_SECRET="your-super-secret-key-change-this"
PORT=5000
NODE_ENV=production
CLIENT_URL="https://library.aiu.edu"
```

#### Client

Update `vite.config.ts` proxy target for production API URL.

## API Documentation

### Authentication
- `POST /api/auth/register` - Register new student
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Bookings
- `GET /api/bookings` - List all bookings
- `POST /api/bookings` - Create booking
- `DELETE /api/bookings/:id` - Cancel booking

### Rooms
- `GET /api/rooms` - List all rooms
- `GET /api/rooms/:id` - Get room details

### Users
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user details

### Admin (Requires Admin Role)
- `POST /api/admin/users/admin` - Create admin user
- `PATCH /api/admin/users/:id/role` - Update user role
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/rooms` - Create room
- `PUT /api/admin/rooms/:id` - Update room
- `DELETE /api/admin/rooms/:id` - Delete room
- `GET /api/admin/stats` - Get statistics

## Security Features

### Authentication
- JWT tokens with configurable expiration
- Password hashing with bcrypt
- Protected routes with middleware

### Rate Limiting
- Auth routes: 5 requests / 15 minutes
- API routes: 100 requests / 15 minutes
- Configurable via environment variables

### Input Validation
- Email validation
- Password strength requirements
- Request payload validation
- XSS protection

### Headers & CORS
- Helmet.js security headers
- CORS with whitelist
- CSP headers

### Logging
- Winston logger
- Separate error and combined logs
- Request logging with IP tracking
- Production-safe error messages

## Monitoring & Logs

Logs are stored in `server/logs/`:
- `error.log` - Error level logs
- `combined.log` - All logs

In production, configure log rotation:
```bash
# Install pm2 or use logrotate
npm install -g pm2
pm2 start npm --name "aiu-library-api" -- run start:prod
pm2 logs aiu-library-api
```

## Database Schema

### Users
- id, email, name, password, role, createdAt

### Rooms
- id, name, capacity, description, features

### Bookings
- id, roomId, userId, startTime, endTime, purpose, status, createdAt

### Attendees
- id, bookingId, name, studentId, isCompanion

## Switching Database Providers

### From SQLite to MySQL

1. Update `server/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

2. Update DATABASE_URL in `.env`:
```env
DATABASE_URL="mysql://user:password@localhost:3306/aiu_library_booking"
```

3. Run migration:
```bash
npm run prisma:migrate:prod
```

### From SQLite to PostgreSQL

Same steps as MySQL, but use:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

```env
DATABASE_URL="postgresql://user:password@localhost:5432/aiu_library_booking"
```

## Troubleshooting

### Port already in use
```bash
# Find and kill process
lsof -ti:5000 | xargs kill -9  # Server
lsof -ti:3000 | xargs kill -9  # Client
```

### Prisma migration fails
```bash
# Reset database (DEV ONLY!)
cd server
npx prisma migrate reset

# Or manually fix:
npx prisma migrate resolve --applied <migration_name>
```

### CORS errors
Check that CLIENT_URL in server `.env` matches your client URL.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT

## Support

For issues, questions, or contributions, please open an issue on GitHub.
