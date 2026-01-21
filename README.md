# AIU Library Room Booking System

A production-ready full-stack library room booking application for Adventist International University with React + TypeScript frontend and Node.js + Express + Prisma backend.

## 🚀 Production Status

**✅ Production Ready** - This application has been fully prepared for production deployment with:
- Zero TypeScript compilation errors
- No security vulnerabilities
- Comprehensive deployment documentation
- Automated deployment scripts
- PM2 process management configuration

See [PRODUCTION_READY.md](PRODUCTION_READY.md) for complete production readiness summary.

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
- **Export Reports**: Generate and print PDF reports for bookings, users, and rooms
- **Dynamic Branding**: Configure service name, logo, and description via the Admin Dashboard settings
- **Audit Logging**: Track all administrative actions

### Production Features
- **Security**:
  - Rate limiting on all routes (5 req/15min for auth, 3000 req/15min for API)
  - Helmet.js security headers
  - CORS configuration with domain whitelist
  - Input validation with express-validator
  - Password hashing with bcrypt (10 rounds)
  - JWT authentication with configurable expiration
  - Protection against SQL injection (Prisma ORM)
  - XSS protection
- **Monitoring & Logging**:
  - Winston logger with separate error/combined logs
  - Request logging with IP tracking
  - Production-safe error messages
  - PM2 process management with auto-restart
  - Log rotation support
- **Performance**:
  - Database indexing on critical fields
  - Optimized queries with Prisma
  - Connection pooling support
  - Gzip compression support
  - Static asset optimization

## Architecture

```
├── client/                   # React + Vite frontend
│   ├── components/           # React components
│   │   ├── AdminDashboard.tsx
│   │   ├── LoginForm.tsx
│   │   ├── Timeline.tsx
│   │   └── ...
│   ├── services/             # API client
│   └── dist/                 # Production build output
├── server/                   # Node.js + Express API
│   ├── src/
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Auth, validation, security
│   │   ├── services/         # Background jobs, schedulers
│   │   ├── utils/            # Logger, helpers
│   │   └── index.ts          # Server entry
│   ├── prisma/               # Database schema & migrations
│   ├── logs/                 # Application logs (gitignored)
│   ├── dist/                 # Production build output
│   └── ecosystem.config.js   # PM2 configuration
├── scripts/                  # Deployment & utility scripts
│   ├── deploy.sh             # Automated deployment script
│   └── production-check.sh   # Production readiness checker
├── DEPLOYMENT_GUIDE.md       # Comprehensive deployment guide
├── PRODUCTION_READY.md       # Production readiness summary
└── PRODUCTION_CHECKLIST.md   # Detailed production checklist
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

> **📖 Complete Guide**: See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for comprehensive deployment instructions including server setup, database configuration, SSL certificates, monitoring, and troubleshooting.

### Quick Start

#### 1. Run Production Check
```bash
chmod +x scripts/production-check.sh
./scripts/production-check.sh
```

#### 2. Environment Setup
```bash
cd server
cp .env.production.example .env

# Edit .env with production values
# Generate secure JWT secret:
openssl rand -base64 32
```

**Required environment variables:**
```env
DATABASE_URL="mysql://user:pass@host:3306/aiu_library_booking"
JWT_SECRET="<generated-secure-key-32+-characters>"
PORT=5000
NODE_ENV=production
CLIENT_URL="https://library.aiu.edu"
```

#### 3. Database Setup

Update `server/prisma/schema.prisma` for MySQL/PostgreSQL:
```prisma
datasource db {
  provider = "mysql"  // or "postgresql"
  url      = env("DATABASE_URL")
}
```

Run migrations:
```bash
cd server
npx prisma migrate deploy
```

#### 4. Build Application

**Option A: Use deployment script (recommended)**
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

**Option B: Manual build**
```bash
# Server
cd server
npm install --production=false
npm run build

# Client
cd ../client
npm install
npm run build
```

#### 5. Deploy with PM2

```bash
cd server

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Configure PM2 to start on system boot
pm2 startup
```

### Deployment Options

**Server (API):**
- PM2 (recommended) - configured via `ecosystem.config.js`
- Docker
- Any Node.js hosting service

**Client (Frontend):**
- Nginx (recommended - see DEPLOYMENT_GUIDE.md)
- Apache
- Vercel
- Netlify
- Any static hosting service

### Post-Deployment

1. Create secure admin user (don't use seed defaults!)
2. Set up database backups (see DEPLOYMENT_GUIDE.md)
3. Configure SSL certificates (Let's Encrypt recommended)
4. Set up monitoring and alerts
5. Test all features in production

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
- Auth routes: 5 requests / 15 minutes (production), 100 (development)
- API routes: 3000 requests / 15 minutes (supports client polling)
- Strict limiter: 10 requests / hour for sensitive operations
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

### Log Files
Logs are stored in `server/logs/`:
- `error.log` - Error level logs only
- `combined.log` - All logs (info, warn, error)

### PM2 Management
```bash
# View logs
pm2 logs aiu-library-api

# Monitor resources
pm2 monit

# Restart application
pm2 restart aiu-library-api

# View status
pm2 status

# Stop application
pm2 stop aiu-library-api
```

### Production Logging
- Winston logger with JSON formatting
- Request logging with IP addresses
- Automatic error tracking
- Log rotation (via PM2 or logrotate)
- Production-safe error messages (no stack traces exposed)

## Database Schema

### Users
- `id` (String, UUID) - Primary key
- `email` (String, unique) - User email (validated for university domain)
- `name` (String) - User full name
- `password` (String) - Bcrypt hashed password
- `role` (Enum: STUDENT, ADMIN) - User role
- `avatarUrl` (String?, optional) - Profile picture URL
- `createdAt` (DateTime) - Account creation timestamp

### Rooms
- `id` (String, UUID) - Primary key
- `name` (String) - Room name
- `minCapacity` (Int) - Minimum attendee capacity
- `maxCapacity` (Int) - Maximum attendee capacity
- `description` (String) - Room description
- `features` (String) - JSON array of features (Whiteboard, Projector, etc.)

### Bookings
- `id` (String, UUID) - Primary key
- `roomId` (String) - Foreign key to Room
- `userId` (String) - Foreign key to User
- `startTime` (DateTime) - Booking start time
- `endTime` (DateTime) - Booking end time
- `purpose` (String) - Booking purpose/description
- `status` (Enum: CONFIRMED, CANCELLED, COMPLETED) - Booking status
- `createdAt` (DateTime) - Booking creation timestamp

### Attendees
- `id` (String, UUID) - Primary key
- `bookingId` (String) - Foreign key to Booking (cascade delete)
- `name` (String) - Attendee name
- `studentId` (String?, optional) - Student ID number
- `isCompanion` (Boolean) - Whether attendee is a companion

## Switching Database Providers

### From SQLite to MySQL

1. **Update schema**: 
   Open `server/prisma/schema.prisma` and change the provider:
   ```prisma
   datasource db {
     provider = "mysql"
     url      = env("DATABASE_URL")
   }
   ```

2. **Update Environment**:
   In your `.env` file, update `DATABASE_URL` with your MySQL connection string:
   ```env
   # Format: mysql://USER:PASSWORD@HOST:PORT/DATABASE
   DATABASE_URL="mysql://root:password@localhost:3306/aiu_library_booking"
   ```

3. **Reset & Migrate**:
   Since you are switching providers, you need to create the initial tables.
   *Warning: This will clear existing SQLite data.*
   
   ```bash
   cd server
   
   # Remove the old migrations folder specific to SQLite
   rm -rf prisma/migrations
   
   # Run migration to create MySQL tables
   npm run prisma:migrate
   ```

4. **Seed Data** (Optional):
   ```bash
   npm run prisma:seed
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

## 🔄 Handling Updates & Migrations

When fetching updates from the repository that include database schema changes (new tables, columns, etc.), follow this procedure:

### 1. Pull Latest Changes
```bash
git pull origin main
```

### 2. Update Dependencies
If `package.json` was modified, install new packages:
```bash
cd server && npm install
cd ../client && npm install
```

### 3. Update Database (Schema Changes)
If `prisma/schema.prisma` has changed, you must apply the migrations.

**For Development:**
```bash
cd server
npm run prisma:migrate  # Applies migrations & regenerates client
```

**For Production:**
```bash
cd server
npm run prisma:migrate:prod
# Restart backend to pick up schema changes
pm2 restart aiu-library-api
```

### 4. Rebuild Frontend (If needed)
If there are frontend changes:
```bash
cd client
npm run build
```

## Useful Scripts

### Production Check
```bash
# Run automated production readiness check
./scripts/production-check.sh
```

### Deployment
```bash
# Automated build and deployment
./scripts/deploy.sh
```

### Database
```bash
cd server

# Generate Prisma client
npm run prisma:generate

# Run migrations (development)
npm run prisma:migrate

# Deploy migrations (production)
npm run prisma:migrate:prod

# Seed database
npm run prisma:seed

# Open Prisma Studio
npm run prisma:studio
```

## Troubleshooting

### TypeScript Errors
```bash
cd server
npx tsc --noEmit
```

### Port already in use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
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
Check that `CLIENT_URL` in server `.env` matches your client URL.

### PM2 Issues
```bash
# View detailed logs
pm2 logs aiu-library-api --err

# Restart application
pm2 restart aiu-library-api

# Delete and recreate
pm2 delete aiu-library-api
pm2 start ecosystem.config.js
```

### Security Vulnerabilities
```bash
# Check for vulnerabilities
cd server && npm audit
cd client && npm audit

# Fix vulnerabilities
npm audit fix
```

For more troubleshooting help, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

## Documentation

- **[README.md](README.md)** - This file - Project overview and quick start
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Comprehensive production deployment guide
- **[PRODUCTION_READY.md](PRODUCTION_READY.md)** - Production readiness summary and checklist
- **[PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)** - Detailed pre/post deployment checklist
- **API Documentation** - See API Documentation section above

## Production Readiness

✅ **This application is production-ready!**

Key achievements:
- Zero TypeScript compilation errors
- Zero security vulnerabilities
- Comprehensive logging with Winston
- Rate limiting configured
- Input validation on all routes
- Secure password hashing
- JWT authentication
- Production builds tested
- Deployment scripts provided
- PM2 configuration included

Run `./scripts/production-check.sh` to verify production readiness.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT

## Support

For issues, questions, or contributions:
- Check the documentation files listed above
- Review troubleshooting section
- Open an issue on GitHub

## Version History

- **v1.0.0** (2026-01-07) - Production-ready release
  - Full-featured room booking system
  - Complete admin dashboard
  - Production deployment ready
  - Comprehensive documentation
