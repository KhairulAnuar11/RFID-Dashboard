"use strict";
// backend/src/config.ts
// New file: Configuration management module
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSystemConfig = loadSystemConfig;
exports.updateSystemConfig = updateSystemConfig;
exports.loadFrontendConfig = loadFrontendConfig;
exports.loadUserPreferences = loadUserPreferences;
exports.updateUserPreferences = updateUserPreferences;
exports.clearConfigCache = clearConfigCache;
// In-memory cache for system config
let systemConfigCache = null;
let frontendConfigCache = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 60 seconds
async function loadSystemConfig(pool) {
    const now = Date.now();
    // Return cached config if still fresh
    if (systemConfigCache && (now - lastCacheUpdate) < CACHE_TTL) {
        return systemConfigCache;
    }
    const [rows] = await pool.execute('SELECT * FROM system_config WHERE id = 1');
    if (!rows || rows.length === 0) {
        throw new Error('System configuration not found. Run migration script first.');
    }
    systemConfigCache = rows[0];
    lastCacheUpdate = now;
    return systemConfigCache;
}
async function updateSystemConfig(pool, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    await pool.execute(`UPDATE system_config SET ${setClause}, updated_at = NOW() WHERE id = 1`, values);
    // Invalidate cache
    systemConfigCache = null;
    return loadSystemConfig(pool);
}
async function loadFrontendConfig(pool) {
    const now = Date.now();
    if (frontendConfigCache && (now - lastCacheUpdate) < CACHE_TTL) {
        return frontendConfigCache;
    }
    const [rows] = await pool.execute('SELECT * FROM frontend_config WHERE id = 1');
    if (!rows || rows.length === 0) {
        throw new Error('Frontend configuration not found.');
    }
    frontendConfigCache = rows[0];
    return frontendConfigCache;
}
async function loadUserPreferences(pool, userId) {
    const [rows] = await pool.execute('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
    if (!rows || rows.length === 0) {
        // Create default preferences for user
        await pool.execute('INSERT INTO user_preferences (user_id) VALUES (?)', [userId]);
        // Fetch newly created preferences
        const [newRows] = await pool.execute('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
        return newRows[0];
    }
    return rows[0];
}
async function updateUserPreferences(pool, userId, updates) {
    const fields = Object.keys(updates);
    const values = [...Object.values(updates), userId];
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    await pool.execute(`UPDATE user_preferences SET ${setClause}, updated_at = NOW() WHERE user_id = ?`, values);
    return loadUserPreferences(pool, userId);
}
// Clear all caches (call after system config changes)
function clearConfigCache() {
    systemConfigCache = null;
    frontendConfigCache = null;
    lastCacheUpdate = 0;
}
