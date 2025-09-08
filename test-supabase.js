const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Test script for Supabase connection
async function testSupabase() {
  console.log('🔍 Testing Supabase connection...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase environment variables missing!')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  try {
    console.log('📊 Testing purchase_requests table...')
    const { data, error, count } = await supabase
      .from('purchase_requests')
      .select('*', { count: 'exact' })
      .limit(3)
    
    console.log('Result:', { 
      count, 
      dataLength: data?.length, 
      error: error,
      firstRecord: data?.[0] 
    })
    
    console.log('📊 Testing sites table...')
    const sitesResult = await supabase.from('sites').select('*').limit(3)
    console.log('Sites:', { 
      count: sitesResult.data?.length, 
      error: sitesResult.error,
      firstSite: sitesResult.data?.[0]
    })
    
  } catch (err) {
    console.error('❌ Error:', err)
  }
}

testSupabase()
