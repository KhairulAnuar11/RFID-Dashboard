/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_MQTT_BROKER: string;
  readonly VITE_MQTT_PORT: string;
  readonly VITE_MQTT_PROTOCOL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_ENABLE_ANALYTICS: string;
  readonly VITE_ENABLE_EXPORT: string;
  readonly VITE_ENABLE_REALTIME: string;
  readonly VITE_DATA_RETENTION_DAYS: string;
  readonly VITE_AUTO_REFRESH_INTERVAL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


