import { z } from 'zod';
import { C2SSchemas, C2S, S2C } from '../schema';

export const WireMessageSchema = z.object({
  v: z.literal(1),
  dir: z.enum(['c2s', 's2c']),
  name: z.string(),
  payload: z.unknown(),
});

export type WireMessage = z.infer<typeof WireMessageSchema>;

export function encodeWireMessage(dir: 'c2s' | 's2c', name: string, payload: unknown): string {
  const msg: WireMessage = { v: 1, dir, name, payload };
  return JSON.stringify(msg);
}

export function decodeWireMessage(raw: string | ArrayBuffer): WireMessage | null {
  try {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    const parsed = JSON.parse(text);
    const result = WireMessageSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function validateC2S(name: string, payload: unknown): { valid: boolean; data?: unknown } {
  const schema = (C2SSchemas as Record<string, z.ZodType>)[name];
  if (!schema) return { valid: false };
  const result = schema.safeParse(payload);
  return result.success ? { valid: true, data: result.data } : { valid: false };
}

export const C2S_EVENTS = Object.values(C2S);
export const S2C_EVENTS = Object.values(S2C);
