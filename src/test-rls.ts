import { supabase } from './lib/supabase.ts';

async function test() {
  const { data, error } = await supabase.rpc('get_table_info'); // this won't work unless they made an rpc
}
test();
