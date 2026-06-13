declare module 'whois';
declare module 'multer';

declare namespace Express {
  interface Request {
    file?: {
      path?: string;
      filename?: string;
      originalname?: string;
      mimetype?: string;
      size?: number;
    };
  }
}
