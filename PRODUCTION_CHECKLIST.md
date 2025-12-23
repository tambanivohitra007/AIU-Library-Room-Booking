# Production Deployment Checklist

Use this checklist to ensure your AIU Library Room Booking system is production-ready.

## Pre-Deployment

### Security
- [ ] Change JWT_SECRET to a strong random value (min 32 characters)
- [ ] Remove or disable demo/test user accounts
- [ ] Verify password requirements are enforced (min 6 chars)
- [ ] Ensure email validation is working (@aiu.edu or approved domains)
- [ ] Review and configure CORS whitelist for production domains
- [ ] Enable HTTPS/SSL certificates
- [ ] Review rate limiting settings
- [ ] Audit all API endpoints for proper authentication

### Database
- [ ] Switch from SQLite to MySQL or PostgreSQL
- [ ] Update DATABASE_URL in production .env
- [ ] Run production migrations (`npm run prisma:migrate:prod`)
- [ ] Set up database backups
- [ ] Configure database connection pooling
- [ ] Review and optimize database indexes
- [ ] Create initial admin user(s)

### Environment Variables
- [ ] Copy .env.production.example to .env
- [ ] Set NODE_ENV=production
- [ ] Update CLIENT_URL to production domain
- [ ] Update PORT if needed
- [ ] Verify all required environment variables are set

### Code Quality
- [ ] Remove all console.log statements (keep console.error)
- [ ] Remove development-only features (demo login buttons)
- [ ] Run linter and fix issues
- [ ] Run type checker (tsc --noEmit)
- [ ] Review and remove any TODO/FIXME comments

### Build & Test
- [ ] Build server: `cd server && npm run build`
- [ ] Build client: `cd client && npm run build`
- [ ] Test built application locally
- [ ] Verify all features work with production database
- [ ] Test authentication flow
- [ ] Test booking creation and cancellation
- [ ] Test admin features

## Deployment

### Server Setup
- [ ] Install Node.js v18+ on production server
- [ ] Install and configure process manager (PM2 recommended)
- [ ] Set up log rotation
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerts
- [ ] Configure automatic restart on failure

### Client Deployment
- [ ] Upload dist folder to static hosting service
- [ ] Configure CDN (optional but recommended)
- [ ] Set up custom domain
- [ ] Configure SSL/TLS certificate
- [ ] Test client can connect to API

### DNS & Domain
- [ ] Configure DNS records
- [ ] Set up SSL certificates (Let's Encrypt recommended)
- [ ] Configure reverse proxy (Nginx/Apache)
- [ ] Test HTTPS is working

## Post-Deployment

### Monitoring
- [ ] Set up application monitoring (PM2, New Relic, etc.)
- [ ] Configure error tracking (Sentry, etc.)
- [ ] Set up uptime monitoring
- [ ] Configure log aggregation
- [ ] Set up alerts for errors and downtime

### Testing
- [ ] Test user registration with university email
- [ ] Test login/logout flow
- [ ] Create test booking
- [ ] Cancel test booking
- [ ] Test admin dashboard
- [ ] Test all CRUD operations
- [ ] Verify emails are sent (if configured)
- [ ] Test on multiple browsers
- [ ] Test on mobile devices

### Performance
- [ ] Run performance audit (Lighthouse)
- [ ] Optimize images and assets
- [ ] Enable gzip/brotli compression
- [ ] Configure caching headers
- [ ] Test under load

### Documentation
- [ ] Update README with production setup
- [ ] Document deployment process
- [ ] Create user guide for students
- [ ] Create admin guide
- [ ] Document API endpoints

### Security Audit
- [ ] Run security scan (npm audit)
- [ ] Update all dependencies to latest secure versions
- [ ] Verify no sensitive data in logs
- [ ] Test rate limiting is working
- [ ] Verify SQL injection protection
- [ ] Test XSS protection
- [ ] Review CORS configuration

### Backup & Recovery
- [ ] Set up automated database backups
- [ ] Test database restore process
- [ ] Document disaster recovery plan
- [ ] Set up code repository backup

## Ongoing Maintenance

### Regular Tasks
- [ ] Monitor error logs weekly
- [ ] Review performance metrics monthly
- [ ] Update dependencies quarterly
- [ ] Rotate JWT secrets periodically (optional)
- [ ] Review and clean up old bookings
- [ ] Audit user accounts periodically

### Support
- [ ] Set up support email or ticketing system
- [ ] Create FAQ for common issues
- [ ] Train admin users
- [ ] Document common troubleshooting steps

## Emergency Contacts

- **System Administrator**: _______________________
- **Database Administrator**: _______________________
- **Hosting Provider Support**: _______________________
- **Security Contact**: _______________________

## Notes

Add any deployment-specific notes or customizations here:

---

Last updated: _______________________
Deployed by: _______________________
Production URL: _______________________
