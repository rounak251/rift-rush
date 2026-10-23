import { env, waitUntil } from 'cloudflare:workers';
import { handleAPI } from '../../../backend/service.mjs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return handleAPI(request, env, {waitUntil}); }
export function POST(request: Request) { return handleAPI(request, env, {waitUntil}); }
