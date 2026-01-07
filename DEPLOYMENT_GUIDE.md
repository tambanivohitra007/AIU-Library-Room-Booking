# AIU Library Room Booking - Production Deployment Guide

This guide will help you deploy the AIU Library Room Booking System to production.

## Prerequisites

- Node.js v18 or higher
- MySQL or PostgreSQL database server
- Domain name with SSL certificate (recommended: Let's Encrypt)
- Server with at least 2GB RAM
- PM2 or similar process manager

## Step 1: Prepare Production Server

### Install Node.js
```bash
# On Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### Install PM2 (Process Manager)
```bash
npm install -g pm2
```

### Set up MySQL/PostgreSQL
```bash
# For MySQL
sudo apt-get install mysql-server
sudo mysql_secure_installation

# For PostgreSQL
sudo apt-get install postgresql postgresql-contrib
```

## Step 2: Set Up Database

### Create Database
```bash
# For MySQL
mysql -u root -p
CREATE DATABASE aiu_library_booking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'libbook'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON aiu_library_booking.* TO 'libbook'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# For PostgreSQL
sudo -u postgres psql
CREATE DATABASE aiu_library_booking;
CREATE USER libbook WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE aiu_library_booking TO libbook;
\q
```

## Step 3: Clone and Configure Application

### Clone Repository
```bash
cd /var/www
git clone <your-repository-url> aiu-library-booking
cd aiu-library-booking
```

### Configure Server Environment
```bash
cd server
cp .env.production.example .env

# Edit .env with production values
nano .env
```

Update these values in `.env`:
```env
# For MySQL
DATABASE_URL="mysql://libbook:your_secure_password@localhost:3306/aiu_library_booking"

# For PostgreSQL
# DATABASE_URL="postgresql://libbook:your_secure_password@localhost:5432/aiu_library_booking"

# Generate a secure JWT secret (32+ characters)
JWT_SECRET="<run: openssl rand -base64 32>"

# Set your production domain
CLIENT_URL="https://library.aiu.edu"

# Ensure production mode
NODE_ENV=production
PORT=5000
```

### Update Prisma Schema (if using MySQL/PostgreSQL)
```bash
# Edit prisma/schema.prisma
nano prisma/schema.prisma
```

Change the datasource:
```prisma
datasource db {
  provider = "mysql"  // or "postgresql"
  url      = env("DATABASE_URL")
}
```

### Install Dependencies and Build Server
```bash
# Install production dependencies
npm install --production=false

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Build the server
npm run build

# Optional: Seed with initial data (creates sample rooms and admin user)
# IMPORTANT: Only run this once and change default passwords immediately
npm run prisma:seed
```

### Configure Client
```bash
cd ../client

# Install dependencies
npm install

# Build for production
npm run build
```

## Step 4: Configure Web Server

### Option A: Nginx (Recommended)

Install Nginx:
```bash
sudo apt-get install nginx
```

Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/aiu-library-booking
```

Add this configuration:
```nginx
# API Server (Backend)
server {
    listen 80;
    server_name api.library.aiu.edu;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.library.aiu.edu;

    ssl_certificate /etc/letsencrypt/live/api.library.aiu.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.library.aiu.edu/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Frontend (Client)
server {
    listen 80;
    server_name library.aiu.edu;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name library.aiu.edu;

    ssl_certificate /etc/letsencrypt/live/library.aiu.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/library.aiu.edu/privkey.pem;

    root /var/www/aiu-library-booking/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/aiu-library-booking /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Option B: Apache

```bash
sudo apt-get install apache2
sudo a2enmod proxy proxy_http ssl rewrite
```

Create Apache configuration:
```bash
sudo nano /etc/apache2/sites-available/aiu-library-booking.conf
```

## Step 5: Set Up SSL Certificates

### Using Let's Encrypt (Free)
```bash
sudo apt-get install certbot python3-certbot-nginx

# For Nginx
sudo certbot --nginx -d library.aiu.edu -d api.library.aiu.edu

# For Apache
# sudo certbot --apache -d library.aiu.edu -d api.library.aiu.edu

# Auto-renewal
sudo certbot renew --dry-run
```

## Step 6: Start Application with PM2

```bash
cd /var/www/aiu-library-booking/server

# Start the application
pm2 start dist/index.js --name "aiu-library-api"

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup
# Follow the instructions provided by the command above
```

### PM2 Useful Commands
```bash
# View logs
pm2 logs aiu-library-api

# Restart application
pm2 restart aiu-library-api

# Stop application
pm2 stop aiu-library-api

# Monitor
pm2 monit

# View status
pm2 status
```

## Step 7: Set Up Database Backups

Create a backup script:
```bash
sudo nano /usr/local/bin/backup-libbook-db.sh
```

Add this content:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/aiu-library-booking"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# For MySQL
mysqldump -u libbook -p'your_secure_password' aiu_library_booking | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# For PostgreSQL
# pg_dump -U libbook aiu_library_booking | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

Make it executable and schedule:
```bash
sudo chmod +x /usr/local/bin/backup-libbook-db.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
0 2 * * * /usr/local/bin/backup-libbook-db.sh >> /var/log/libbook-backup.log 2>&1
```

## Step 8: Set Up Monitoring and Logging

### Configure Log Rotation
```bash
sudo nano /etc/logrotate.d/aiu-library-booking
```

Add:
```
/var/www/aiu-library-booking/server/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
```

### Set Up Monitoring (Optional)
```bash
# Install and configure monitoring tools
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

## Step 9: Security Hardening

### Firewall Configuration
```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Restrict Database Access
```bash
# Edit MySQL/PostgreSQL config to only listen on localhost
# For MySQL
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
# Ensure: bind-address = 127.0.0.1

# For PostgreSQL
sudo nano /etc/postgresql/*/main/postgresql.conf
# Ensure: listen_addresses = 'localhost'
```

### Set Proper File Permissions
```bash
cd /var/www/aiu-library-booking
sudo chown -R www-data:www-data .
sudo chmod -R 755 .
sudo chmod 600 server/.env
```

## Step 10: Post-Deployment Checklist

- [ ] Verify application is running: `pm2 status`
- [ ] Test health endpoint: `curl https://api.library.aiu.edu/api/health`
- [ ] Access frontend: https://library.aiu.edu
- [ ] Test user registration with university email
- [ ] Test admin login
- [ ] Create production admin user (change default password!)
- [ ] Test booking creation and cancellation
- [ ] Verify database backups are working
- [ ] Check application logs: `pm2 logs aiu-library-api`
- [ ] Monitor server resources: `pm2 monit`
- [ ] Run security audit: `npm audit` in both server and client
- [ ] Test on multiple devices and browsers
- [ ] Set up uptime monitoring (e.g., UptimeRobot, Pingdom)

## Creating First Admin User (Production)

**IMPORTANT**: After deployment, immediately create a secure admin user:

### Option 1: Via Database
```bash
cd /var/www/aiu-library-booking/server

# Create a script to add admin
node -e "
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAdmin() {
  const password = await bcrypt.hash('CHANGE_THIS_PASSWORD', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@aiu.edu',
      name: 'System Administrator',
      password: password,
      role: 'ADMIN'
    }
  });
  console.log('Admin created:', admin.email);
  await prisma.\$disconnect();
}

createAdmin();
"
```

### Option 2: Via API (if admin endpoint is enabled)
```bash
curl -X POST https://api.library.aiu.edu/api/admin/users/admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@aiu.edu",
    "name": "System Administrator",
    "password": "CHANGE_THIS_PASSWORD"
  }'
```

## Maintenance

### Updating the Application
```bash
cd /var/www/aiu-library-booking

# Pull latest changes
git pull origin main

# Update server
cd server
npm install --production=false
npm run build
npx prisma migrate deploy
pm2 restart aiu-library-api

# Update client
cd ../client
npm install
npm run build
```

### Database Migrations
```bash
cd /var/www/aiu-library-booking/server
npx prisma migrate deploy
pm2 restart aiu-library-api
```

## Troubleshooting

### Check Application Logs
```bash
pm2 logs aiu-library-api --lines 100
```

### Check Nginx Logs
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Database Connection Issues
```bash
# Test database connection
cd /var/www/aiu-library-booking/server
npx prisma db pull
```

### Application Not Starting
```bash
# Check PM2 status
pm2 status

# Restart
pm2 restart aiu-library-api

# View detailed logs
pm2 logs aiu-library-api --err
```

## Support Contacts

- System Administrator: _______________________
- Database Administrator: _______________________
- Hosting Provider: _______________________

## Useful Resources

- Prisma Documentation: https://www.prisma.io/docs
- PM2 Documentation: https://pm2.keymetrics.io/docs
- Nginx Documentation: https://nginx.org/en/docs
- Let's Encrypt: https://letsencrypt.org/docs
