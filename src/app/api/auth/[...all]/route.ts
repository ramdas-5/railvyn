import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = toNextJsHandler((request) => getAuth().handler(request));

export const GET = handler.GET;
export const POST = handler.POST;
