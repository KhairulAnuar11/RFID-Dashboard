# Changelog

## [1.0.1] - December 12, 2024

### Fixed
- **Environment Variable Error**: Fixed `TypeError: Cannot read properties of undefined (reading 'VITE_API_URL')` error
  - Updated `services/apiService.ts` to safely handle undefined environment variables
  - Added proper fallback to `http://localhost:3001/api` when `VITE_API_URL` is not set
  - Improved error handling with type checking

### Added
- **Environment Configuration Files**:
  - Created `.env` file with default configuration
  - Created `.env.example` template file for easy setup
  - Added `ENV_SETUP.md` comprehensive guide for environment variable configuration

### Changed
- **Documentation Updates**:
  - Updated `DEPLOYMENT_GUIDE.md` to reflect simplified environment variable setup
  - Updated `QUICK_START.md` with clearer `.env` configuration instructions
  - Removed outdated MQTT environment variables from deployment guide (now configured via UI)

### Technical Details

#### apiService.ts Changes
**Before:**
```typescript
const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  // ...
};
```

**After:**
```typescript
const API_CONFIG = {
  baseURL: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3001/api',
  // ...
};
```

This change ensures:
1. Checks if `import.meta` exists before accessing it
2. Uses optional chaining (`?.`) to safely access `env` property
3. Provides fallback even if Vite environment is not initialized
4. Prevents runtime errors during initialization

### Files Modified
- `/services/apiService.ts` - Fixed environment variable access
- `/DEPLOYMENT_GUIDE.md` - Updated environment variable documentation
- `/QUICK_START.md` - Improved setup instructions

### Files Added
- `/.env` - Default environment configuration
- `/.env.example` - Environment variable template
- `/ENV_SETUP.md` - Comprehensive environment setup guide
- `/CHANGELOG.md` - This changelog

### Migration Guide

If you're experiencing the environment variable error:

1. **Create `.env` file**:
   ```bash
   cp .env.example .env
   ```

2. **Update your `.env`** (if needed):
   ```bash
   VITE_API_URL=http://localhost:3001/api
   ```

3. **Restart your development server**:
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

4. The error should now be resolved with proper fallback handling.

### Notes
- The application will work even without a `.env` file, defaulting to `http://localhost:3001/api`
- MQTT configuration is done through the Settings UI, not environment variables
- All changes are backward compatible

---

## [1.0.0] - December 11, 2024

### Added
- Complete RFID Tracking Dashboard System
- Real-time MQTT integration with any broker
- Full API service layer with production-ready endpoints
- Interactive Settings page with MQTT configuration UI
- User management with role-based access control
- Real-time dashboard with live charts and statistics
- Tag data module with filtering and export capabilities
- Device management for RFID readers
- Location mapping with visual floor plans
- Comprehensive documentation (README, Deployment Guide, Backend Starter)
- API collection for Postman testing

### Features
- ✅ Real-time RFID tag tracking via MQTT
- ✅ Interactive dashboard with live updates
- ✅ Device management and monitoring
- ✅ User authentication and authorization
- ✅ Data export (CSV, Excel, PDF)
- ✅ Responsive design for mobile and desktop
- ✅ Production-ready with no mock code
- ✅ Comprehensive documentation
- ✅ Backend starter template

---

**Version**: 1.0.1
**Last Updated**: December 12, 2024
