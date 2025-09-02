const { createClient } = require('@supabase/supabase-js')

// Test script for Supabase connection
async function testSupabase() {
  console.log('🔍 Testing Supabase connection...')
  
  const supabaseUrl = 'https://yxzmxfwpgsqabtamnfql.supabase.co'
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4em14ZndwZ3NxYWJ0YW1uZnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NDcwMTYsImV4cCI6MjA3MTUyMzAxNn0.EJNLyurCnaA5HY8MgyoLs9RiZvzrGk7eclnYLq56rCE'
  
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
