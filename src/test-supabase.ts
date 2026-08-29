import { supabase } from './lib/supabase.ts';

async function test() {
  const { data, error } = await supabase.from('direct_messages').select('*').limit(1);
  console.log("Error:", error);
}
test();
