const { createClient } = require('@supabase/supabase-js');
const { assignmentKey, isCourseAssignmentKey } = require('./_course-access');

function json(status, body){ return { statusCode: status, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }; }

exports.handler = async (event) => {
  if(event.httpMethod !== 'GET') return json(405,{ok:false,error:'Method not allowed'});
  try{
    const auth = event.headers.authorization || event.headers.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i,'');
    if(!token) return json(401,{ok:false,error:'Missing authorization token.'});

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data:userData, error:userError } = await supabase.auth.getUser(token);
    if(userError || !userData?.user) return json(401,{ok:false,error:'Invalid session.'});

    const { data, error } = await supabase
      .from('candidate_assignments')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('status','assigned')
      .order('created_at',{ascending:true});

    if(error) throw error;

    const { data:courses, error:courseError } = await supabase
      .from('cmc_courses')
      .select('id,slug,title,subtitle,description,stage_key,access_mode,estimated_minutes,status')
      .eq('status', 'published');
    if (courseError) throw courseError;

    const courseByKey = new Map((courses || []).map(course => [assignmentKey(course), course]));
    const assignments = (data || []).map(item => ({
      ...item,
      course:isCourseAssignmentKey(item.item_key) ? (courseByKey.get(item.item_key) || null) : null
    })).filter(item => {
      if (!isCourseAssignmentKey(item.item_key)) return true;
      if (item.item_key === 'discover_course') return true;
      return Boolean(item.course);
    });

    return json(200,{ok:true,assignments});
  }catch(err){
    return json(500,{ok:false,error:err.message||'Could not load assignments.'});
  }
};
