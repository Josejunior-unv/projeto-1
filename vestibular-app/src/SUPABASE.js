import { createClient } from '@supabase/supabase-js'


const supabaseUrl = 'https://plyavsgrxdxfzhoidqwk.supabase.co' 
const supabaseKey = 'sb_publishable__GrVY6C5aG9TnTXbUqd4xQ_e2aIoLrq'

export const supabase = createClient(supabaseUrl, supabaseKey)