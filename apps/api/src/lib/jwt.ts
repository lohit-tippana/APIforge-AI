import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AccessPayload {
  sub: string;
  email: string;
  name: string;
}

export const signAccessToken = (p: AccessPayload) =>
  jwt.sign(p, config.jwt.accessSecret, { expiresIn: config.jwt.accessTtl });

export const verifyAccessToken = (token: string) => jwt.verify(token, config.jwt.accessSecret) as AccessPayload;
