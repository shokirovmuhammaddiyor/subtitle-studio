import { buildProxiedUrl, CORS_PROXIES } from './corsProxy';

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

  // 512KB Block Cache to avoid making thousands of small HTTP requests
  private readonly BLOCK_SIZE = 512 * 1024;
  private blockCache: Map<number, Uint8Array> = new Map();

  constructor(rawUrl: string, proxyId: string = 'corsproxy_io', customProxy?: string) {
    this.rawUrl = rawUrl.trim();
    this.proxyId = proxyId;
    this.customProxy = customProxy;
  }

  private getFetchUrl(activeProxyId?: string): string {
    return buildProxiedUrl(this.rawUrl, activeProxyId || this.proxyId, this.customProxy);
  }

  async getSize(): Promise<number> {
    if (this.totalSize !== null) return this.totalSize;

    // List of proxies to try for size discovery
    const proxiesToTry = this.proxyId === 'custom'
      ? ['custom']
      : [this.proxyId, 'corsproxy_io', 'corsproxy_org', 'direct'];

    let lastError: any = null;

    for (const pId of proxiesToTry) {
      try {
        const targetUrl = this.getFetchUrl(pId);
        // Range request for first byte: Range: bytes=0-0
        const res = await fetch(targetUrl, {
          headers: {
            'Range': 'bytes=0-0',
            'Accept-Encoding': 'identity'
          }
        });

        if (res.ok || res.status === 206) {
          const contentRange = res.headers.get('Content-Range') || res.headers.get('content-range');
          if (contentRange) {
            const match = contentRange.match(/\/(\d+|\*)$/);
            if (match && match[1] !== '*') {
              this.totalSize = parseInt(match[1], 10);
              this.proxyId = pId; // Remember working proxy
              return this.totalSize;
            }
          }
          const contentLength = res.headers.get('Content-Length') || res.headers.get('content-length');
          if (contentLength && parseInt(contentLength, 10) > 1) {
            this.totalSize = parseInt(contentLength, 10);
            this.proxyId = pId;
            return this.totalSize;
          }
        }
      } catch (err) {
        lastError = err;
      }
    }

    // Default fallback if server doesn't report size
    this.totalSize = 0;
    return this.totalSize;
  }

  private async fetchBlock(blockIndex: number): Promise<Uint8Array> {
    if (this.blockCache.has(blockIndex)) {
      return this.blockCache.get(blockIndex)!;
    }

    const start = blockIndex * this.BLOCK_SIZE;
    const end = start + this.BLOCK_SIZE - 1;

    const proxiesToTry = this.proxyId === 'custom'
      ? ['custom']
      : [this.proxyId, 'corsproxy_io', 'corsproxy_org', 'direct'];

    let lastError: any = null;

    for (const pId of proxiesToTry) {
      try {
        const targetUrl = this.getFetchUrl(pId);
        const res = await fetch(targetUrl, {
          headers: {
            'Range': `bytes=${start}-${end}`,
            'Accept-Encoding': 'identity'
          }
        });

        if (res.status === 206 || res.ok) {
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          this.bytesRead += bytes.byteLength;
          this.blockCache.set(blockIndex, bytes);
          this.proxyId = pId; // Stick with the working proxy
          return bytes;
        } else if (res.status === 416) {
          // Range Not Satisfiable (past EOF)
          const empty = new Uint8Array(0);
          this.blockCache.set(blockIndex, empty);
          return empty;
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(
      `Videoning ${start}-${end} baytlarini yuklab bo'lmadi (CORS yoki server xatoligi). ` +
      `Iltimos, boshqa CORS Proxy tanlang yoki havolaning amal qilish muddatini tekshiring. Xato: ${lastError?.message || lastError}`
    );
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    if (length <= 0) return new Uint8Array(0);

    const startBlock = Math.floor(offset / this.BLOCK_SIZE);
    const endBlock = Math.floor((offset + length - 1) / this.BLOCK_SIZE);

    if (startBlock === endBlock) {
      const blockBytes = await this.fetchBlock(startBlock);
      const blockOffset = offset % this.BLOCK_SIZE;
      return blockBytes.slice(blockOffset, Math.min(blockOffset + length, blockBytes.length));
    }

    // Spans across multiple blocks
    const result = new Uint8Array(length);
    let bytesCopied = 0;

    for (let b = startBlock; b <= endBlock; b++) {
      const blockBytes = await this.fetchBlock(b);
      const blockStart = b * this.BLOCK_SIZE;
      const readStart = Math.max(offset, blockStart);
      const readEnd = Math.min(offset + length, blockStart + blockBytes.length);

      if (readEnd > readStart) {
        const offsetInBlock = readStart - blockStart;
        const count = readEnd - readStart;
        result.set(blockBytes.subarray(offsetInBlock, offsetInBlock + count), bytesCopied);
        bytesCopied += count;
      }
    }

    return result.subarray(0, bytesCopied);
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
