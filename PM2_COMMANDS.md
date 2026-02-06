# PM2 Quick Reference

## Current Running Services

1. **artist-api-dev** - API Backend (Development)
2. **cloudflare-tunnel** - Cloudflare Tunnel

## Quick Commands

### Start Services
```bash
# Start API only
npm run pm2:dev

# Start Tunnel only
npm run pm2:tunnel

# Start both API + Tunnel
npm run pm2:all
```

### Monitor Services
```bash
# Check status
npm run pm2:status
# or
pm2 status

# View API logs
npm run pm2:logs
# or
pm2 logs artist-api-dev

# View Tunnel logs (to get URL)
npm run pm2:logs:tunnel
# or
pm2 logs cloudflare-tunnel

# View all logs
pm2 logs
```

### Control Services
```bash
# Restart all services
npm run pm2:restart

# Stop all services
npm run pm2:stop

# Delete all services (removes from PM2)
npm run pm2:delete

# Restart specific service
pm2 restart artist-api-dev
pm2 restart cloudflare-tunnel
```

### Get Tunnel URL
```bash
pm2 logs cloudflare-tunnel --lines 50 --nostream | grep trycloudflare.com
```

## Current Configuration

**API:** http://localhost:3000
**Tunnel:** https://fabulous-monsters-chamber-powered.trycloudflare.com

### Note on Tunnel URLs
- Free tunnel URLs are temporary and change on restart
- Check logs after restart to get the new URL
- Update the URL in:
  - `lib/core/constants/app_constants.dart` (Flutter)
  - `src/server.ts` (API CORS - optional, regex covers all)

## PM2 Ecosystem File

Location: `ecosystem.config.js`

Apps configured:
- `artist-api` - Production build
- `artist-api-dev` - Development with hot reload
- `cloudflare-tunnel` - Tunnel service

## Logs Location

All logs are stored in `./logs/` directory:
- `pm2-dev-*.log` - API logs
- `pm2-tunnel-*.log` - Tunnel logs
