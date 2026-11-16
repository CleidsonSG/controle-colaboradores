import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Variáveis públicas: o build do GitHub Pages recebe os valores pelas "vars" do repositório; localmente, .env.local.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let client: SupabaseClient | null = null;

/** Supabase só é usado quando as duas variáveis estão definidas; sem elas, os dados ficam no navegador (IndexedDB). */
export function isSupabaseConfigured(): boolean {
  return URL !== "" && ANON_KEY !== "";
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado.");
  client ??= createClient(URL, ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
