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

  // 256KB Block Cache
  private readonly BLOCK_SIZE = 256 * 1024;
  private blockCache: Map<number, Uint8Array> = new Map();

  constructor(rawUrl: string, proxyId: string = 'cf_worker_official', customProxy?: string) {
    this.rawUrl = rawUrl.trim();
    this.proxyId = proxyId || 'cf_worker_official';
    this.customProxy = customProxy;
  }

  private getFetchUrl(activeProxyId?: string): string {
    return buildProxiedUrl(this.rawUrl, activeProxyId || this.proxyId, this.customProxy);
  }

  async getSize(): Promise<number> {
    if (this.totalSize !== null) return this.totalSize;

    const proxiesToTry = this.proxyId === 'custom'
      ? ['custom']
      : [this.proxyId, 'cf_worker_official', 'direct'];

    for (const pId of proxiesToTry) {
      try {
        const targetUrl = this.getFetchUrl(pId);
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
              this.proxyId = pId;
              // Clean up body immediately
              if (res.body) {
                const r = res.body.getReader();
                r.cancel().catch(() => {});
              }
              return this.totalSize;
            }
          }
          const contentLength = res.headers.get('Content-Length') || res.headers.get('content-length');
          if (contentLength && parseInt(contentLength, 10) > 1) {
            this.totalSize = parseInt(contentLength, 10);
            this.proxyId = pId;
            if (res.body) {
              const r = res.body.getReader();
              r.cancel().catch(() => {});
            }
            return this.totalSize;
          }
        }
      } catch (err) {
        // try next proxy
      }
    }

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
      : [this.proxyId, 'cf_worker_official', 'direct'];

    for (const pId of proxiesToTry) {
      try {
        const targetUrl = this.getFetchUrl(pId);
        const res = await fetch(targetUrl, {
          headers: {
            'Range': `bytes=${start}-${end}`,
            'Accept-Encoding': 'identity'
          }
        });

        if (res.status === 206) {
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          this.bytesRead += bytes.byteLength;
          this.blockCache.set(blockIndex, bytes);
          this.proxyId = pId;
          return bytes;
        } else if (res.ok) {
          // If server returns 200 (full body), read ONLY the needed chunk and cancel the stream!
          if (res.body) {
            const reader = res.body.getReader();
            const chunks: Uint8Array[] = [];
            let received = 0;

            while (received < this.BLOCK_SIZE) {
              const { done, value } = await reader.read();
              if (done || !value) break;
              chunks.push(value);
              received += value.byteLength;
            }

            // CRITICAL: Cancel the remaining stream to prevent downloading the whole video!
            reader.cancel().catch(() => {});

            const merged = new Uint8Array(received);
            let p = 0;
            for (const c of chunks) {
              merged.set(c, p);
              p += c.byteLength;
            }

            this.bytesRead += merged.byteLength;
            this.blockCache.set(blockIndex, merged);
            this.proxyId = pId;
            return merged;
          }
        } else if (res.status === 416) {
          const empty = new Uint8Array(0);
          this.blockCache.set(blockIndex, empty);
          return empty;
        }
      } catch (err) {
        // try next proxy
      }
    }

    throw new Error(`Videoning ${start}-${end} baytlarini yuklab bo'lmadi. Havola muddati tugagan bo'lishi mumkin.`);
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    if (length <= 0) return new Uint8Array(0);

    const startBlock = Math.floor(offset / this.BLOCK_SIZE);
    const endBlock = Math.floor((offset + length - 1) / this.BLOCK_SIZE);

    const result = new Uint8Array(length);
    let resultOffset = 0;

    for (let b = startBlock; b <= endBlock; b++) {
      const blockData = await this.fetchBlock(b);
      const blockStart = b * this.BLOCK_SIZE;

      const readStart = Math.max(offset, blockStart);
      const readEnd = Math.min(offset + length, blockStart + blockData.length);

      if (readStart < readEnd) {
        const sliceStart = readStart - blockStart;
        const sliceLength = readEnd - readStart;
        result.set(blockData.subarray(sliceStart, sliceStart + sliceLength), resultOffset);
        resultOffset += sliceLength;
      }
    }

    return result.subarray(0, resultOffset);
  }

  getBytesRead(): number {
    return this.bytesRead;
  }

  getSourceName(): string {
    try {
      const urlObj = new URL(this.rawUrl);
      const pathParts = urlObj.pathname.split('/');
      const last = pathParts[pathParts.length - 1];
      return decodeURIComponent(last) || 'remote-video.mkv';
    } catch {
      return 'remote-video.mkv';
    }
  }
}
