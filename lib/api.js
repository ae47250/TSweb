import { NextResponse } from "next/server";

export function json(data, init = {}) {
  return NextResponse.json(data, init);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function requestIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
