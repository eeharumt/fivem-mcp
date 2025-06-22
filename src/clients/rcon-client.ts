import * as dgram from 'dgram';
import { Buffer } from 'buffer';

/**
 * FiveM RCON Client for server communication
 */
export class FiveMRconClient {
  private socket: dgram.Socket;
  private host: string;
  private port: number;
  private password: string;
  private isConnected: boolean = false;

  constructor(host: string, port: number, password: string) {
    this.host = host;
    this.port = port;
    this.password = password;
    this.socket = dgram.createSocket('udp4');
  }

  private encodeRequest(command: string): Buffer {
    const header = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
    const rconCommand = Buffer.from(`rcon ${this.password} ${command}`);
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
    return new Promise((resolve, reject) => {
      const request = this.encodeRequest(command);
      
      const timeoutId = setTimeout(() => {
        this.socket.removeAllListeners('message');
        reject(new Error(`Command timeout: ${command}`));
      }, timeout);

      this.socket.once('message', (data) => {
        clearTimeout(timeoutId);
        const response = this.decodeResponse(data);
        resolve(response);
      });

      this.socket.send(request, this.port, this.host, (err) => {
        if (err) {
          clearTimeout(timeoutId);
          reject(err);
        }
      });
    });
  }

  async connect(): Promise<void> {
    try {
      const response = await this.sendCommand('version');
      if (response.includes('Bad rcon')) {
        throw new Error('Invalid RCON password');
      }
      this.isConnected = true;
    } catch (error) {
      throw new Error(`Failed to connect to FiveM server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  close(): void {
    this.socket.close();
    this.isConnected = false;
  }
} 