declare module 'ali-oss' {
  interface OSSOptions {
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    region: string;
  }

  interface PutResult {
    url: string;
    name: string;
  }

  interface PutOptions {
    mime?: string;
    headers?: Record<string, string>;
  }

  class OSS {
    constructor(options: OSSOptions);
    put(key: string, buffer: Buffer, options?: PutOptions): Promise<PutResult>;
    delete(key: string): Promise<void>;
  }

  export = OSS;
}
