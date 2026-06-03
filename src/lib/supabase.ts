import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function createSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase environment variables not configured")
    return null
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Only create client on the client side
let supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return null
  }
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient()
  }
  return supabaseInstance
}
