# Deployment Guide

This guide covers the deployment of the Social Media Scheduler application to production using Coolify and Docker.

## Prerequisites

- Docker and Docker Compose installed
- Coolify instance running on your VPS
- Supabase project configured
- Domain name configured (optional but recommended)

## Environment Configuration

### 1. Environment Variables

Copy the production environment template and configure your values:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` with your actual values:

```bash
# Required Variables
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NEXTAUTH_SECRET=your-super-secret-jwt-secret
NEXTAUTH_URL=https://schedule.oddomens.com

# Platform API Keys
THREADS_CLIENT_ID=your-threads-client-id
THREADS_CLIENT_SECRET=your-threads-client-secret
THREADS_REDIRECT_URI=https://schedule.oddomens.com/api/auth/threads/callback
```

### 2. Supabase Configuration

Ensure your Supabase project has:
- Database tables created (run migrations)
- RLS policies enabled
- Storage buckets configured
- Auth providers configured

## Deployment Methods

### Method 1: Coolify Deployment (Recommended)

1. **Connect Repository to Coolify**
   ```bash
   # In your Coolify dashboard:
   # 1. Create new application
   # 2. Connect your Git repository
   # 3. Select the main branch
   ```

2. **Configure Environment Variables**
   - In Coolify dashboard, go to your application settings
   - Add all environment variables from `.env.production.example`
   - Mark sensitive variables as "secrets"

3. **Configure Build Settings**
   ```json
   {
     "buildCommand": "npm run build",
     "startCommand": "npm start",
     "port": 3000
   }
   ```

4. **Deploy**
   - Click "Deploy" in Coolify dashboard
   - Monitor deployment logs
   - Verify health checks pass

### Method 2: Manual Docker Deployment

1. **Build and Deploy**
   ```bash
   # Make scripts executable
   chmod +x scripts/*.sh
   
   # Run production build
   ./scripts/build-production.sh
   
   # Deploy with Docker Compose
   ./scripts/deploy.sh
   ```

2. **Verify Deployment**
   ```bash
   # Check container status
   docker ps
   
   # Check application logs
   docker logs social-media-scheduler-app
   
   # Test health endpoints
   curl http://localhost:3000/api/health
   curl http://localhost:3000/api/ready
   ```

## Health Monitoring

The application provides several monitoring endpoints:

### Health Check Endpoint
```
GET /api/health
```
Returns basic application health status, memory usage, and database connectivity.

### Readiness Check Endpoint
```
GET /api/ready
```
Returns detailed readiness status including:
- Database connectivity
- Environment variable validation
- File system accessibility

### Example Health Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 3600,
  "memory": {
    "used": 128,
    "total": 256,
    "external": 32
  },
  "database": {
    "status": "connected",
    "responseTime": "15ms"
  },
  "services": {
    "supabase": "connected",
    "cron": "enabled"
  }
}
```

## SSL Configuration

### Coolify SSL (Automatic)
Coolify automatically handles SSL certificates via Let's Encrypt when you:
1. Configure your domain in Coolify
2. Ensure DNS points to your server
3. Enable SSL in application settings

### Manual SSL Setup
If deploying manually, configure SSL using:
- Nginx reverse proxy with Let's Encrypt
- Cloudflare SSL (if using Cloudflare)
- Load balancer SSL termination

## Database Migrations

Run database migrations before deployment:

```bash
# Run migration scripts
node scripts/migrate.js

# Validate schema
node scripts/validate-schema.js
```

## Performance Optimization

### Docker Image Optimization
- Multi-stage build reduces image size
- Only production dependencies included
- Static assets optimized

### Application Performance
- Next.js standalone output for faster startup
- Image optimization enabled
- Caching headers configured

## Scaling Configuration

### Horizontal Scaling
Configure in `coolify.json`:
```json
{
  "scaling": {
    "minReplicas": 1,
    "maxReplicas": 3,
    "targetCPU": 70,
    "targetMemory": 80
  }
}
```

### Resource Limits
```json
{
  "resources": {
    "memory": "512Mi",
    "cpu": "500m"
  }
}
```

## Troubleshooting

### Common Issues

1. **Container Won't Start**
   ```bash
   # Check logs
   docker logs social-media-scheduler-app
   
   # Check environment variables
   docker exec social-media-scheduler-app env
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connectivity
   curl http://localhost:3000/api/ready
   
   # Check Supabase configuration
   echo $VITE_SUPABASE_URL
   ```

3. **Health Check Failures**
   ```bash
   # Check health endpoint directly
   curl -v http://localhost:3000/api/health
   
   # Check container resources
   docker stats social-media-scheduler-app
   ```

### Log Analysis
```bash
# Application logs
docker logs -f social-media-scheduler-app

# System logs
journalctl -u docker

# Coolify logs (if using Coolify)
# Check Coolify dashboard for deployment logs
```

## Backup and Recovery

### Database Backup
```bash
# Supabase provides automatic backups
# Additional manual backup:
pg_dump $DATABASE_URL > backup.sql
```

### Application Data
- User uploads stored in Supabase Storage
- Configuration stored in database
- No local file system dependencies

## Security Considerations

### Environment Security
- Use secrets management for sensitive variables
- Rotate API keys regularly
- Enable RLS policies in Supabase

### Network Security
- Use HTTPS in production
- Configure CORS properly
- Implement rate limiting

### Container Security
- Run as non-root user
- Minimal base image (Alpine Linux)
- Regular security updates

## Monitoring and Alerting

### Application Metrics
- Health check monitoring
- Response time tracking
- Error rate monitoring

### Infrastructure Metrics
- CPU and memory usage
- Disk space monitoring
- Network connectivity

### Recommended Monitoring Tools
- Uptime monitoring (UptimeRobot, Pingdom)
- Application monitoring (Sentry for errors)
- Infrastructure monitoring (Grafana, Prometheus)

## Rollback Procedure

### Coolify Rollback
1. Go to Coolify dashboard
2. Select previous deployment
3. Click "Rollback"

### Manual Rollback
```bash
# Stop current deployment
docker-compose down

# Deploy previous version
docker-compose up -d social-media-scheduler:previous-tag

# Verify rollback
curl http://localhost:3000/api/health
```

## Support

For deployment issues:
1. Check application logs
2. Verify environment configuration
3. Test health endpoints
4. Review this documentation
5. Check Supabase status page