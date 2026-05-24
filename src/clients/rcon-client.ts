import * as dgram from 'dgram';
import { Buffer } from 'buffer';
import { ResponseParser } from '../utils/response-parser.js';

/**
 * FiveM RCON Client for server communication
 */
export class FiveMRconClient {
  private socket: dgram.Socket;
  private host: string;
  private port: number;
  private password: string;
  private isConnected: boolean = false;
  private lastHealthCheck: number = 0;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly RECONNECT_DELAY = 2000; // 2 seconds

  constructor(host: string, port: number, password: string) {
    this.host = host;
    this.port = port;
    this.password = password;
    this.socket = dgram.createSocket('udp4');
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.socket.on('error', (err) => {
      console.error(`[RCON Client] Socket error: ${err.message}`);
      this.isConnected = false;
    });
  }

  private encodeRequest(command: string): Buffer {
    const header = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
    // Handle empty commands and ensure proper encoding
    const cleanCommand = command?.trim() || '';
    const rconCommand = Buffer.from(`rcon ${this.password} ${cleanCommand}`, 'utf8');
    return Buffer.concat([header, rconCommand]);
  }

  private decodeResponse(data: Buffer): string {
    const header = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
    if (data.length < header.length) {
      return '';
    }
    return data.subarray(header.length).toString().trim();
  }

  async sendCommand(command: string, timeout: number = 5000): Promise<string> {
    if (!command?.trim()) {
      throw new Error('Command cannot be empty');
    }

    await this.ensureConnection();
    return this.sendCommandRaw(command, timeout, false);
  }

  async sendCommandCollectResponse(command: string, timeout: number = 20000): Promise<string> {
    if (!command?.trim()) {
      throw new Error('Command cannot be empty');
    }

    await this.ensureConnection();
    return this.sendCommandRaw(command, timeout, true);
  }

  private async sendCommandRaw(command: string, timeout: number, collectUntilJson: boolean): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = this.encodeRequest(command);
      let accumulated = '';

      const finish = (response: string) => {
        clearTimeout(timeoutId);
        this.socket.removeListener('message', onMessage);
        this.socket.removeListener('error', onError);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve(response);
      };

      const fail = (error: Error) => {
        clearTimeout(timeoutId);
        this.socket.removeListener('message', onMessage);
        this.socket.removeListener('error', onError);
        this.isConnected = false;
        reject(error);
      };

      const onMessage = (data: Buffer) => {
        const chunk = this.decodeResponse(data);
        accumulated = accumulated ? `${accumulated}\n${chunk}` : chunk;

        if (collectUntilJson) {
          const pluginJson = ResponseParser.extractPluginJson(accumulated);
          if (pluginJson) {
            finish(JSON.stringify(pluginJson));
            return;
          }
        } else {
          finish(accumulated);
        }
      };

      const onError = (err: Error) => {
        fail(new Error(`Socket error: ${err.message}`));
      };

      const timeoutId = setTimeout(() => {
        if (collectUntilJson && accumulated.trim()) {
          finish(accumulated);
          return;
        }
        fail(new Error(`Command timeout: ${command}`));
      }, timeout);

      this.socket.on('message', onMessage);
      this.socket.once('error', onError);

      this.socket.send(request, this.port, this.host, (err) => {
        if (err) {
          fail(new Error(`Failed to send command: ${err.message}`));
        }
      });
    });
  }

  /**
   * Ensure connection is active, reconnect if necessary
   */
  private async ensureConnection(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastHealthCheck;

    // Perform health check if enough time has passed
    if (!this.isConnected || timeSinceLastCheck > this.HEALTH_CHECK_INTERVAL) {
      try {
        await this.healthCheck();
        this.lastHealthCheck = now;
      } catch (error) {
        // Connection lost, attempt to reconnect
        await this.reconnect();
      }
    }
  }

  /**
   * Perform health check by sending a simple command
   * Uses direct socket communication to avoid recursion
   */
  private async healthCheck(): Promise<void> {
    try {
      const testRequest = this.encodeRequest('version');
      
      const response = await new Promise<string>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.socket.removeAllListeners('message');
          reject(new Error('Health check timeout'));
        }, 3000);

        this.socket.once('message', (data) => {
          clearTimeout(timeoutId);
          const decoded = this.decodeResponse(data);
          resolve(decoded);
        });

        this.socket.once('error', (err) => {
          clearTimeout(timeoutId);
          reject(new Error(`Health check socket error: ${err.message}`));
        });

        this.socket.send(testRequest, this.port, this.host, (err) => {
          if (err) {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to send health check: ${err.message}`));
          }
        });
      });

      if (response.includes('Bad rcon')) {
        throw new Error('Invalid RCON password');
      }
      this.isConnected = true;
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Attempt to reconnect to the server
   */
  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      throw new Error(`Failed to reconnect after ${this.MAX_RECONNECT_ATTEMPTS} attempts`);
    }

    this.reconnectAttempts++;
    
    // Close existing socket
    try {
      this.socket.close();
    } catch {
      // Ignore errors when closing
    }

    // Create new socket
    this.socket = dgram.createSocket('udp4');
    this.setupSocketHandlers();

    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, this.RECONNECT_DELAY));

    // Attempt to reconnect
    try {
      await this.connect();
      this.reconnectAttempts = 0; // Reset on successful reconnect
    } catch (error) {
      // Will retry on next ensureConnection call
      throw error;
    }
  }

  async connect(): Promise<void> {
    try {
      // Use a direct connection test without going through sendCommand to avoid recursion
      const testRequest = this.encodeRequest('version');
      
      const response = await new Promise<string>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.socket.removeAllListeners('message');
          reject(new Error('Connection timeout'));
        }, 5000);

        this.socket.once('message', (data) => {
          clearTimeout(timeoutId);
          const decoded = this.decodeResponse(data);
          resolve(decoded);
        });

        this.socket.once('error', (err) => {
          clearTimeout(timeoutId);
          reject(new Error(`Socket error: ${err.message}`));
        });

        this.socket.send(testRequest, this.port, this.host, (err) => {
          if (err) {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to send connection test: ${err.message}`));
          }
        });
      });

      if (response.includes('Bad rcon')) {
        throw new Error('Invalid RCON password');
      }
      this.isConnected = true;
      this.lastHealthCheck = Date.now();
      this.reconnectAttempts = 0;
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to FiveM server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Force health check
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.healthCheck();
      this.lastHealthCheck = Date.now();
      return true;
    } catch {
      return false;
    }
  }

  close(): void {
    try {
      this.socket.close();
    } catch {
      // Ignore errors when closing
    }
    this.isConnected = false;
  }
} 