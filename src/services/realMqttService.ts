// Real MQTT Service using mqtt.js
import mqtt from 'mqtt';
import { RFIDTag } from '../types';

export type MQTTCallback = (tag: RFIDTag) => void;
export type ConnectionStatusCallback = (status: 'connected' | 'disconnected' | 'reconnecting' | 'error', message?: string) => void;

interface MQTTConnectionOptions {
  broker: string;
  port: number;
  protocol: 'mqtt' | 'ws' | 'wss';
  username?: string;
  password?: string;
  clientId?: string;
  keepalive?: number;
  clean?: boolean;
}

class RealMQTTService {
  private client: mqtt.MqttClient | null = null;
  private messageCallbacks: MQTTCallback[] = [];
  private statusCallbacks: ConnectionStatusCallback[] = [];
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  /**
   * Connect to MQTT broker
   */
  connect(options: MQTTConnectionOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Disconnect existing connection if any
        if (this.client) {
          this.disconnect();
        }

        // Build connection URL
        
        const brokerUrl =
          options.protocol === 'ws' || options.protocol === 'wss'
          ? `${options.protocol}://${options.broker}:${options.port}/mqtt`
          : `${options.protocol}://${options.broker}:${options.port}`;
          
        // MQTT connection options
        const mqttOptions: mqtt.IClientOptions = {
          clientId: options.clientId || `rfid_dashboard_${Math.random().toString(16).substr(2, 8)}`,
          username: options.username || undefined,
          password: options.password || undefined,
          keepalive: options.keepalive || 60,
          clean: options.clean !== false,
          reconnectPeriod: 5000, // Reconnect every 5 seconds
          connectTimeout: 30000, // 30 seconds
        };

        console.log('[MQTT] Connecting to:', brokerUrl);
        this.notifyStatusChange('reconnecting', 'Connecting to MQTT broker...');

        // Create MQTT client
        this.client = mqtt.connect(brokerUrl, mqttOptions);

        // Connection successful
        this.client.on('connect', () => {
          console.log('[MQTT] Connected successfully');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.notifyStatusChange('connected', 'Connected to MQTT broker');
          resolve();
        });

        // Connection error
        this.client.on('error', (error) => {
          console.error('[MQTT] Connection error:', error);
          this.isConnected = false;
          this.notifyStatusChange('error', `Connection error: ${error.message}`);
          
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });

        // Disconnected
        this.client.on('close', () => {
          console.log('[MQTT] Connection closed');
          this.isConnected = false;
          this.notifyStatusChange('disconnected', 'Disconnected from MQTT broker');
        });

        // Reconnecting
        this.client.on('reconnect', () => {
          this.reconnectAttempts++;
          console.log(`[MQTT] Reconnecting... (attempt ${this.reconnectAttempts})`);
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[MQTT] Max reconnect attempts reached');
            this.disconnect();
            this.notifyStatusChange('error', 'Max reconnection attempts reached');
          } else {
            this.notifyStatusChange('reconnecting', `Reconnecting... (attempt ${this.reconnectAttempts})`);
          }
        });

        // Offline
        this.client.on('offline', () => {
          console.log('[MQTT] Client offline');
          this.isConnected = false;
          this.notifyStatusChange('disconnected', 'MQTT client offline');
        });

        // Message received
        this.client.on('message', (topic, payload) => {
          try {
            const message = payload.toString();
            console.log(`[MQTT] Message received on topic "${topic}":`, message);
            
            // Parse RFID tag data
            const data = JSON.parse(message);
            const tag = this.parseRFIDTag(data, topic);
            
            if (tag) {
              // Notify all message subscribers
              this.messageCallbacks.forEach(callback => callback(tag));
            }
          } catch (error) {
            console.error('[MQTT] Error parsing message:', error);
          }
        });

      } catch (error) {
        console.error('[MQTT] Connection setup error:', error);
        reject(error);
      }
    });
  }

  /**
   * Subscribe to MQTT topics
   */
  subscribe(topics: string[]): void {
    if (!this.client || !this.isConnected) {
      console.warn('[MQTT] Cannot subscribe: Not connected');
      return;
    }

    topics.forEach(topic => {
      this.client!.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT] Failed to subscribe to "${topic}":`, err);
        } else {
          console.log(`[MQTT] Subscribed to topic: "${topic}"`);
        }
      });
    });
  }

  /**
   * Unsubscribe from MQTT topics
   */
  unsubscribe(topics: string[]): void {
    if (!this.client) return;

    topics.forEach(topic => {
      this.client!.unsubscribe(topic, (err) => {
        if (err) {
          console.error(`[MQTT] Failed to unsubscribe from "${topic}":`, err);
        } else {
          console.log(`[MQTT] Unsubscribed from topic: "${topic}"`);
        }
      });
    });
  }

  /**
   * Publish message to MQTT topic
   */
  publish(topic: string, message: any, options?: mqtt.IClientPublishOptions): void {
    if (!this.client || !this.isConnected) {
      console.warn('[MQTT] Cannot publish: Not connected');
      return;
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    
    this.client.publish(topic, payload, options || { qos: 1 }, (err) => {
      if (err) {
        console.error(`[MQTT] Failed to publish to "${topic}":`, err);
      } else {
        console.log(`[MQTT] Published to topic "${topic}":`, payload);
      }
    });
  }

  /**
   * Disconnect from MQTT broker
   */
  disconnect(): void {
    if (this.client) {
      console.log('[MQTT] Disconnecting...');
      this.client.end(true);
      this.client = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.notifyStatusChange('disconnected', 'Disconnected from MQTT broker');
    }
  }

  /**
   * Add message callback
   */
  onMessage(callback: MQTTCallback): void {
    this.messageCallbacks.push(callback);
  }

  /**
   * Remove message callback
   */
  removeMessageCallback(callback: MQTTCallback): void {
    this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Add connection status callback
   */
  onStatusChange(callback: ConnectionStatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  /**
   * Remove status callback
   */
  removeStatusCallback(callback: ConnectionStatusCallback): void {
    this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Check if connected
   */
  isConnectedToBroker(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get connection state
   */
  getConnectionState(): 'connected' | 'disconnected' | 'reconnecting' {
    if (!this.client) return 'disconnected';
    if (this.isConnected) return 'connected';
    if (this.reconnectAttempts > 0) return 'reconnecting';
    return 'disconnected';
  }

  /**
   * Parse RFID tag data from MQTT message
   */
  private parseRFIDTag(payload: any, topic: string): RFIDTag | null {
    try {
      // Validate payload structure
      if (!payload || payload.code !== 0 || !payload.data) {
        console.warn('[MQTT] Invalid payload or non-success code:', payload);
        return null;
      }

      const d = payload.data;

      const tag: RFIDTag = {
        id: `${d.EPC}-${d.ReadTime}`,
        tagId: d.TID || '',
        epc: d.EPC,
        rssi: d.RSSI,
        readerId: d.Device,
        readerName: d.Device,
        antenna: Number(d.AntId) || 1,
        timestamp: new Date(d.ReadTime).toISOString(),
        count: 1
      };

    // Final validation
    if (!tag.epc) {
      console.warn('[MQTT] Missing EPC:', payload);
      return null;
    }

    return tag;
  } catch (error) {
    console.error('[MQTT] Error parsing RFID tag:', error);
    return null;
  }
}

  /**
   * Notify status change to all callbacks
   */
  private notifyStatusChange(status: 'connected' | 'disconnected' | 'reconnecting' | 'error', message?: string): void {
    this.statusCallbacks.forEach(callback => callback(status, message));
  }

  /**
   * Test connection with ping
   */
  async testConnection(): Promise<boolean> {
    return this.isConnectedToBroker();
  }
}

// Export singleton instance
export const mqttService = new RealMQTTService();
