import { supabase } from './lib/supabase.ts';

async function test() {
  const { data, error } = await supabase.from('shared_notes').insert({
      sender_id: 'test',
      sender_identifier: 'test',
      recipient_identifier: 'test',
      note_title: 'test',
      note_content: 'test'
  });
  console.log("Shared Notes Insert Error:", error);
}
test();
