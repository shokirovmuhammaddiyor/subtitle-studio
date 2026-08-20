import { buildProxiedUrl } from './corsProxy';

export interface DataReader {
  getSize(): Promise<number>;
  read(offset: number, length: number): Promise<Uint8Array>;
  getBytesRead(): number;
  getSourceName(): string;
}

export class FileSliceReader implements DataReader {
  private file: File;
  private bytesRead: number = 0;

  constructor(file: File) {
    this.file = file;
  }

  async getSize(): Promise<number> {
    return this.file.size;
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    const end = Math.min(offset + length, this.file.size);
    if (offset >= this.file.size || end <= offset) {
      return new Uint8Array(0);
    }
    const blob = this.file.slice(offset, end);
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    this.bytesRead += bytes.byteLength;
    return bytes;
  }

  getBytesRead(): number {
    return this.bytesRead;
  }

  getSourceName(): string {
    return this.file.name;
  }
}

export class HttpRangeReader implements DataReader {
  private rawUrl: string;
  private proxyId: string;
  private customProxy?: string;
  private totalSize: number | null = null;
  private bytesRead: number = 0;

  constructor(rawUrl: string, proxyId: string = 'direct', customProxy?: string) {
    this.rawUrl = rawUrl;
    this.proxyId = proxyId;
    this.customProxy = customProxy;
  }

  private getFetchUrl(): string {
    return buildProxiedUrl(this.rawUrl, this.proxyId, this.customProxy);
  }

  async getSize(): Promise<number> {
    if (this.totalSize !== null) return this.totalSize;

    // Try HEAD request first
    try {
      const targetUrl = this.getFetchUrl();
      const res = await fetch(targetUrl, {
        method: 'HEAD',
        headers: {
          'Accept-Encoding': 'identity',
        }
      });
      const contentLength = res.headers.get('Content-Length');
      if (contentLength && !isNaN(parseInt(contentLength, 10))) {
        this.totalSize = parseInt(contentLength, 10);
        return this.totalSize;
      }
    } catch {
      // HEAD might be blocked by CORS or server, fallback to 1-byte Range request
    }

    // Fallback: Range request for first byte
    try {
      const targetUrl = this.getFetchUrl();
      const res = await fetch(targetUrl, {
        headers: {
          'Range': 'bytes=0-0'
        }
      });
      const contentRange = res.headers.get('Content-Range');
      if (contentRange) {
        // e.g. "bytes 0-0/524288000"
        const match = contentRange.match(/\/(\d+|\*)$/);
        if (match && match[1] !== '*') {
          this.totalSize = parseInt(match[1], 10);
          return this.totalSize;
        }
      }
      const contentLength = res.headers.get('Content-Length');
      if (contentLength) {
        this.totalSize = parseInt(contentLength, 10);
        return this.totalSize;
      }
    } catch (err: any) {
      throw new Error(`Videoning hajmini aniqlab bo'lmadi. CORS yoki havola noto'g'ri bo'lishi mumkin: ${err?.message || err}`);
    }

    // Default unknown or huge placeholder if indeterminate
    this.totalSize = 0;
    return this.totalSize;
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    const end = offset + length - 1;
    const targetUrl = this.getFetchUrl();

    const response = await fetch(targetUrl, {
      headers: {
        'Range': `bytes=${offset}-${end}`,
      }
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(`HTTP Range so'rovi xatoligi: Status ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    this.bytesRead += bytes.byteLength;
    return bytes;
  }

  getBytesRead(): number {
    return this.bytesRead;
  }

  getSourceName(): string {
    try {
      const urlObj = new URL(this.rawUrl);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').filter(Boolean).pop() || 'remote_video';
      return decodeURIComponent(filename);
    } catch {
      return 'remote_video';
    }
  }
}
