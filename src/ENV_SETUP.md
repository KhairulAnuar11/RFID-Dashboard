# Environment Variables Setup Guide

## Overview
This document explains how to configure environment variables for the RFID Tracking Dashboard frontend application.

## Quick Setup

### Step 1: Copy the Example File
```bash
cp .env.example .env
```

### Step 2: Edit the .env File
Open the `.env` file and update the values:

```bash
# Backend API URL
VITE_API_URL=http://localhost:3001/api
```

## Environment Variables Explained

### `VITE_API_URL`
- **Description**: The base URL of your backend API server
- **Default**: `http://localhost:3001/api`
- **Development**: `http://localhost:3001/api`
- **Production**: `https://your-domain.com/api`
- **Required**: No (defaults to `http://localhost:3001/api` if not set)

## Different Environments

### Local Development
```bash
VITE_API_URL=http://localhost:3001/api
```

### Staging
```bash
VITE_API_URL=https://api-staging.your-domain.com/api
```

### Production
```bash
VITE_API_URL=https://api.your-domain.com/api
```

## Important Notes

1. **Vite Prefix**: All environment variables must be prefixed with `VITE_` to be exposed to the frontend application.

2. **Restart Required**: After changing environment variables, you must restart the development server:
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart
   npm run dev
   ```

3. **Build Time**: Environment variables are embedded at build time, not runtime. If you change them, rebuild your application:
   ```bash
   npm run build
   ```

4. **Security**: Never commit `.env` files with sensitive data to version control. The `.env` file is already in `.gitignore`.

5. **Default Fallback**: If `VITE_API_URL` is not set, the application will automatically use `http://localhost:3001/api`.

## MQTT Configuration

**Note**: MQTT broker configuration is NOT done through environment variables. Instead:
1. Log in to the dashboard
2. Navigate to **Settings & Configuration**
3. Go to the **MQTT Settings** tab
4. Configure your MQTT broker details in the UI
5. Click **Connect to MQTT**

This approach allows you to:
- Change MQTT settings without rebuilding
- Test different brokers easily
- Store configuration in the database (via backend API)

## Troubleshooting

### Issue: Environment variable not working
**Solution**:
1. Make sure the variable name starts with `VITE_`
2. Restart the dev server
3. Clear browser cache
4. Check the browser console for the loaded URL

### Issue: "Cannot read properties of undefined"
**Solution**:
This error occurs when `import.meta.env.VITE_API_URL` is undefined. The code has been updated to handle this gracefully with a fallback, but ensure:
1. `.env` file exists in project root
2. Variable is properly formatted
3. Dev server has been restarted

### Issue: API calls failing
**Solution**:
1. Verify backend is running: `http://localhost:3001/api/health`
2. Check CORS configuration on backend
3. Verify `VITE_API_URL` matches your backend URL
4. Check browser network tab for exact API URLs being called

## Example Files

### `.env` (Local Development)
```bash
# RFID Dashboard - Environment Configuration
VITE_API_URL=http://localhost:3001/api
```

### `.env.production` (Production)
```bash
# RFID Dashboard - Production Configuration
VITE_API_URL=https://api.rfid-dashboard.com/api
```

## Loading Different Environments

### Development
```bash
npm run dev
# Automatically loads .env
```

### Production Build
```bash
# Uses .env.production if it exists, otherwise .env
npm run build
```

### Custom Environment
```bash
# Use a custom .env file
cp .env.staging .env
npm run build
```

## Best Practices

1. **Keep It Simple**: Only store configuration that changes between environments
2. **Document Values**: Add comments explaining what each variable does
3. **Use Defaults**: Provide sensible defaults for development
4. **Separate Secrets**: Never store API keys or secrets in frontend environment variables (they're exposed in the browser)
5. **Version Control**: Commit `.env.example` but never `.env`

## Files Overview

| File | Purpose | Commit to Git? |
|------|---------|----------------|
| `.env.example` | Template with example values | ✅ Yes |
| `.env` | Your local configuration | ❌ No |
| `.env.production` | Production configuration | ❌ No |
| `.env.staging` | Staging configuration | ❌ No |

## Support

If you encounter issues with environment variables:
1. Check this guide
2. Verify your `.env` file format
3. Ensure dev server is restarted
4. Check browser console for errors
5. Review `QUICK_START.md` for setup instructions

---

**Last Updated**: December 2024
