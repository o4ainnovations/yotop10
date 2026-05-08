// JWT payload type extensions

import 'jsonwebtoken';

declare module 'jsonwebtoken' {
  interface JwtPayload {
    id: string;
    username: string;
    token_version: number;
    exp?: number;
    iat?: number;
  }
}

export {};
