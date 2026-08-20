declare module 'mp4box' {
  export interface MP4BoxFile {
    onReady?: (info: any) => void;
    onError?: (e: string) => void;
    onSamples?: (id: number, user: any, samples: any[]) => void;
    appendBuffer(data: ArrayBuffer & { fileStart: number }): number;
    flush(): void;
    setExtractionOptions(id: number, user?: any, options?: { nbSamples?: number }): void;
    start(): void;
    stop(): void;
  }

  export function createFile(): MP4BoxFile;
}
