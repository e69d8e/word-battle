import { NextResponse } from "next/server"

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init)
}
