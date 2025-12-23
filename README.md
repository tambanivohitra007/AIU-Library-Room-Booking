# LibBook - Library Room Booking System

A full-stack library room booking application with React + TypeScript frontend and Node.js + Express + Prisma backend.

## Architecture

```
├── client/          # React + Vite frontend
│   ├── components/  # React components
│   ├── services/    # API client
│   └── ...
├── server/          # Node.js + Express API
│   ├── src/         # Server source code
│   ├── prisma/      # Database schema & migrations
│   └── ...
```

## Tech Stack

### Frontend (Client)
- React 19.2.3
- TypeScript
- Vite
- TailwindCSS

### Backend (Server)
- Node.js
- Express
- Prisma ORM
- SQLite (easily switchable to MySQL/PostgreSQL)

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation

1. **Install dependencies for both client and server:**

```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

2. **Set up the database:**

```bash
cd server

# Generate Prisma client
npm run prisma:generate

# Run migrations (creates the SQLite database)
npm run prisma:migrate

# Seed the database with initial data
npm run prisma:seed
```

### Running the Application

You need to run both the server and client:

**Terminal 1 - Start the server:**
```bash
cd server
npm run dev
```
The server will run on http://localhost:5000

**Terminal 2 - Start the client:**
```bash
cd client
npm run dev
```
The client will run on http://localhost:3000

The client is configured to proxy API requests to the server automatically.

## Features

- **Weekly Timeline View**: Visual calendar showing available time slots
- **Drag-to-Book**: Select time ranges by dragging on the timeline
- **Room Management**: Support for multiple study rooms
- **User Roles**: Student and Admin roles with different permissions
- **Booking Management**: Create, view, and cancel bookings
- **Attendee Tracking**: Track all attendees for each booking
- **Admin Dashboard**: View all bookings and export to CSV

## Database Schema

The application uses Prisma with SQLite (can be switched to MySQL/PostgreSQL). Main models:

- **User**: Student and admin users
- **Room**: Study rooms with capacity and features
- **Booking**: Room reservations with time slots
- **Attendee**: People attending each booking

### Switching to MySQL

To switch from SQLite to MySQL:

1. Update `server/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

2. Update `server/.env`:
```
DATABASE_URL="mysql://user:password@localhost:3306/libbook"
```

3. Run migrations:
```bash
cd server
npm run prisma:migrate
```

## API Endpoints

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID

### Rooms
- `GET /api/rooms` - Get all rooms
- `GET /api/rooms/:id` - Get room by ID

### Bookings
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/:id` - Get booking by ID
- `POST /api/bookings` - Create new booking
- `DELETE /api/bookings/:id` - Cancel booking

## Development

### Useful Commands

**Client:**
```bash
cd client
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

**Server:**
```bash
cd server
npm run dev              # Start dev server with watch mode
npm run build            # Build TypeScript
npm run start            # Start production server
npm run prisma:studio    # Open Prisma Studio (database GUI)
npm run prisma:migrate   # Create and run new migration
npm run prisma:seed      # Seed database with initial data
```

## Default Users

After seeding the database:

- **Alice Student** (alice@uni.edu) - Student role
- **Bob Admin** (bob@uni.edu) - Admin role

Use the role switcher in the bottom-right corner of the app to switch between users.

## License

MIT
