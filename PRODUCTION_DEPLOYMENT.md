# Production Deployment Guide

This guide covers deploying the Social Media Scheduler app to production.

## Prerequisites

1. **Environment Setup**: Ensure all required environment variables are configured
2. **Database**: Supabase project with proper schema and RLS policies
3. **Platform APIs**: Threads API credentials configured
4. **Domain**: Production domain configured (schedule.oddomens.com)

## Environment Configuration

### 1. Create Production Environment File

Copy `.env.production.example` to `.env.production` and configure:

```bash
cp .env.production.example .env.production
```

### 2. Required Environment Variables

```env
# Application
NODE_ENV=production
APP_URL=https://schedule.oddomens.com

# Supabase
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Threads API
THREADS_CLIENT_ID=your-threads-client-id
THREADS_CLIENT_SECRET=your-threads-client-secret
THREADS_REDIRECT_URI=https://schedule.oddomens.com/auth/threads/callback
```

### 3. Validate Environment

```bash
npm run validate-env
```

## Build Process

### 1. Install Dependencies

```bash
npm ci --production=false
```

### 2. Run Tests

```bash
npm test
```

### 3. Build for Production

```bash
npm run build:prod
```

### 4. Preview Production Build

```bash
npm run preview:prod
```

## Deployment Options

### Option 1: Static Hosting (Recommended)

Deploy the `dist` folder to any static hosting service:

- **Vercel**: Connect GitHub repo, auto-deploys on push
- **Netlify**: Drag & drop `dist` folder or connect repo
- **Cloudflare Pages**: Connect repo for automatic deployments

### Option 2: Docker Deployment

Use the provided Dockerfile:

```bash
# Build image
docker build -t social-scheduler .

# Run container
docker run -p 80:80 social-scheduler
```

### Option 3: Traditional Server

Upload `dist` folder to web server and configure:

```nginx
server {
    listen 80;
    server_name schedule.oddomens.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name schedule.oddomens.com;
    
    # SSL configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    root /var/www/social-scheduler/dist;
    index index.html;
    
    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy (if needed)
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
}
```

## Post-Deployment Checklist

### 1. Verify Application

- [ ] App loads at production URL
- [ ] User authentication works
- [ ] Database connections successful
- [ ] Platform integrations functional

### 2. Test Core Features

- [ ] User registration/login
- [ ] Dashboard displays real data
- [ ] Post creation works
- [ ] Time slot management
- [ ] Platform connections (Threads)
- [ ] Settings pages functional

### 3. Performance Checks

- [ ] Page load times < 3 seconds
- [ ] Lighthouse score > 90
- [ ] No console errors
- [ ] Mobile responsiveness

### 4. Security Verification

- [ ] HTTPS enforced
- [ ] Environment variables secure
- [ ] No sensitive data in client bundle
- [ ] CORS properly configured

## Monitoring & Maintenance

### 1. Error Tracking

Consider integrating error tracking:

```typescript
// Add to src/main.tsx
if (import.meta.env.PROD) {
  // Initialize error tracking service
  // e.g., Sentry, LogRocket, etc.
}
```

### 2. Analytics

Add analytics tracking:

```typescript
// Add to src/utils/analytics.ts
export function trackEvent(event: string, properties?: object) {
  if (import.meta.env.PROD) {
    // Send to analytics service
  }
}
```

### 3. Health Checks

Monitor application health:

- Database connectivity
- API response times
- Error rates
- User activity

## Troubleshooting

### Common Issues

1. **White Screen**: Check browser console for errors
2. **API Errors**: Verify environment variables
3. **Auth Issues**: Check Supabase configuration
4. **Build Failures**: Run `npm run validate-env`

### Debug Mode

Enable debug logging in production:

```env
LOG_LEVEL=debug
```

### Rollback Plan

1. Keep previous build artifacts
2. Use blue-green deployment strategy
3. Have database backup/restore procedures

## Updates & Maintenance

### Regular Updates

1. **Dependencies**: Update monthly
2. **Security Patches**: Apply immediately
3. **Feature Releases**: Test in staging first

### Backup Strategy

1. **Database**: Daily automated backups
2. **Environment Config**: Version controlled
3. **Build Artifacts**: Keep last 5 versions

## Support

For deployment issues:

1. Check application logs
2. Verify environment configuration
3. Test in local production mode
4. Review this deployment guide

---

**Note**: This app is configured for the domain `schedule.oddomens.com`. Update all references if using a different domain.