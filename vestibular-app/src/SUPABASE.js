import { createClient } from '@supabase/supabase-js'

// Lê as credenciais das variáveis de ambiente (arquivo .env — ver .env.example).
// Mantém um fallback com os valores atuais para não quebrar caso o .env não exista.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://plyavsgrxdxfzhoidqwk.supabase.co'
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable__GrVY6C5aG9TnTXbUqd4xQ_e2aIoLrq'

// Bucket público usado para os PDFs enviados pelos professores.
export const BUCKET_MATERIAIS = 'materiais'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
