const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

function json(status, body){ return { statusCode: status, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }; }

const ITEM_LABELS = {
  discernment_application: 'Discernment Center Application',
  character_qualities: 'Character Qualities Assessment',
  ministry_readiness: 'Ministry Readiness Inventory',
  pastoral_reference: 'Pastoral Reference Form'
};

function assignmentUrl(key){
  const base = process.env.SITE_URL || process.env.URL || '';
  if(key === 'discernment_application') return `${base}/application.html`;
  if(key === 'character_qualities') return `${base}/assessment.html`;
  if(key === 'ministry_readiness') return `${base}/isa-assessment.html`;
  return `${base}/dashboard.html`;
}

async function sendAssignmentEmail({email,name,itemKey}){
  if(!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL || !email) return {sent:false, skipped:true};
  const resend = new Resend(process.env.RESEND_API_KEY);
  const itemTitle = ITEM_LABELS[itemKey] || itemKey;
  const url = assignmentUrl(itemKey);
  await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: `New Discernment Center item assigned: ${itemTitle}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2933">
      <h2 style="margin-bottom:8px;">${itemTitle} has been assigned to you</h2>
      <p>Hello ${name || 'there'},</p>
      <p>A new item has been added to your Discernment Center dashboard.</p>
      <p><strong>${itemTitle}</strong></p>
      <p><a href="${url}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">Open Your Dashboard</a></p>
      <p style="color:#64748b;font-size:13px;">If you have questions, please contact your Discernment Center coordinator.</p>
    </div>`
  });
  return {sent:true};
}

function normalizeReport(row){
  const c = row.candidate || {};
  const s = row.scores || {};
  return {
    id: row.id,
    userId: row.user_id,
    submittedAt: row.created_at,
    candidate: c,
    scores: s,
    name: c.name || row.name || '',
    email: c.email || row.email || '',
    phone: c.phone || row.phone || '',
    state: c.state || row.state || '',
    region: c.region || row.region || '',
    married: c.married || '',
    assessmentType: s.assessmentType || row.assessment_type || 'character_qualities',
    assessmentTitle: s.assessmentTitle || (s.assessmentType === 'isa_readiness' ? 'Ministry Readiness Inventory' : s.assessmentType === 'ministry_style' ? 'Ministry Style Inventory' : 'Character Qualities Assessment'),
    overall: s.overall || row.overall || '',
    overallLabel: s.overallLabel || row.overall_label || '',
    emailError: row.email_error || ''
  };
}

function normalizeApplication(row){
  const a = row.application || {};
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    completion: row.completion,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    application: a,
    name: a.fullName || row.name || '',
    email: a.email || row.email || '',
    phone: a.phone || row.phone || '',
    state: a.state || row.state || '',
    region: a.region || row.region || '',
    hasPhoto: Boolean(row.photo_path || row.photo_name),
    hasResume: Boolean(row.resume_path || row.resume_name),
    photoName: row.photo_name || '',
    resumeName: row.resume_name || ''
  };
}

exports.handler = async (event) => {
  if(event.httpMethod !== 'POST') return json(405,{ok:false,error:'Method not allowed'});
  try{
    const body = JSON.parse(event.body || '{}');
    if(body.password !== process.env.ADMIN_PASSWORD) return json(401,{ok:false,error:'Incorrect admin password.'});

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    if(body.id){
      const { data: report, error: reportByIdError } = await supabase
        .from('assessment_results')
        .select('*')
        .eq('id', body.id)
        .maybeSingle();

      if(reportByIdError) throw reportByIdError;
      if(!report) return json(404,{ok:false,error:'Report not found.'});

      return json(200,{ok:true,submission:normalizeReport(report)});
    }

    if(body.action === 'updateAssignments'){
      const updates = Array.isArray(body.assignments) ? body.assignments : [];
      const results = [];
      for(const u of updates){
        if(!u.userId && !u.email) continue;
        let userId = u.userId;
        if(!userId && u.email){
          const { data: profile } = await supabase.from('candidate_profiles').select('id,email,full_name').eq('email',u.email).maybeSingle();
          userId = profile?.id;
        }
        if(!userId) continue;

        const { data: existing, error: existingError } = await supabase
          .from('candidate_assignments')
          .select('*')
          .eq('user_id',userId)
          .eq('item_key',u.itemKey)
          .maybeSingle();
        if(existingError) throw existingError;

        const firstTimeAssignment = !existing && u.status === 'assigned';

        const payload = {
          user_id:userId,
          candidate_email:u.email || existing?.candidate_email || '',
          candidate_name:u.name || existing?.candidate_name || '',
          item_key:u.itemKey,
          item_type:u.itemKey === 'character_qualities' || u.itemKey === 'ministry_readiness' ? 'assessment' : 'form',
          status:u.status,
          assigned_at:u.status === 'assigned' ? (existing?.assigned_at || new Date().toISOString()) : existing?.assigned_at,
          hidden_at:u.status === 'hidden' ? new Date().toISOString() : null,
          updated_at:new Date().toISOString()
        };

        const { data: saved, error: saveError } = await supabase
          .from('candidate_assignments')
          .upsert(payload,{onConflict:'user_id,item_key'})
          .select()
          .single();
        if(saveError) throw saveError;

        if(firstTimeAssignment){
          try{
            await sendAssignmentEmail({email:payload.candidate_email,name:payload.candidate_name,itemKey:u.itemKey});
            await supabase.from('candidate_assignments').update({first_assigned_email_sent_at:new Date().toISOString()}).eq('id',saved.id);
          }catch(emailErr){
            await supabase.from('candidate_assignments').update({email_error:emailErr.message||'Email failed'}).eq('id',saved.id);
          }
        }
        results.push(saved);
      }
      return json(200,{ok:true,assignments:results});
    }

    if(body.action === 'deleteCandidate'){
      let userId = body.userId || '';

      if(!userId && body.email){
        const { data: profile } = await supabase
          .from('candidate_profiles')
          .select('id')
          .eq('email', body.email)
          .maybeSingle();

        userId = profile?.id || '';
      }

      if(!userId && !body.email){
        return json(400,{ok:false,error:'Could not identify candidate to delete.'});
      }

      const deleteResults = [];
      const storagePaths = [];

      async function collectStorageFiles(){
        let query = supabase
          .from('candidate_applications')
          .select('photo_path,resume_path');

        if(userId){
          query = query.eq('user_id', userId);
        }else if(body.email){
          query = query.eq('email', body.email);
        }

        const { data, error } = await query;
        if(error) throw error;

        for(const row of data || []){
          if(row.photo_path) storagePaths.push(row.photo_path);
          if(row.resume_path) storagePaths.push(row.resume_path);
        }
      }

      async function deleteStorageFiles(){
        const uniquePaths = [...new Set(storagePaths.filter(Boolean))];
        if(!uniquePaths.length) return;

        const { data, error } = await supabase
          .storage
          .from('candidate-uploads')
          .remove(uniquePaths);

        if(error) throw error;
        deleteResults.push(`candidate-uploads:${uniquePaths.length}`);
      }

      async function deleteFromTable(table, column, value){
        if(!value) return;
        const { error } = await supabase.from(table).delete().eq(column, value);
        if(error) throw error;
        deleteResults.push(`${table}.${column}`);
      }

      await collectStorageFiles();
      await deleteStorageFiles();

      if(userId){
        await deleteFromTable('candidate_assignments','user_id',userId);
        await deleteFromTable('candidate_applications','user_id',userId);
        await deleteFromTable('assessment_results','user_id',userId);
        await deleteFromTable('candidate_profiles','id',userId);

        try{
          await supabase.auth.admin.deleteUser(userId);
          deleteResults.push('auth.users.id');
        }catch(authDeleteError){
          // Do not block cleanup if the Auth user was already removed or cannot be deleted locally.
          deleteResults.push('auth.users.delete_skipped');
        }
      }else if(body.email){
        await deleteFromTable('candidate_assignments','candidate_email',body.email);
        await deleteFromTable('candidate_applications','email',body.email);
        await deleteFromTable('assessment_results','email',body.email);
        await deleteFromTable('candidate_profiles','email',body.email);
      }

      return json(200,{ok:true,deleted:deleteResults,storageDeleted:storagePaths.length});
    }

    if(body.action === 'archiveCandidate'){
      let userId = body.userId;
      if(!userId && body.email){
        const { data: profile } = await supabase.from('candidate_profiles').select('id').eq('email',body.email).maybeSingle();
        userId = profile?.id;
      }
      if(!userId) return json(400,{ok:false,error:'Could not find candidate account.'});

      const { error } = await supabase
        .from('candidate_assignments')
        .upsert({
          user_id:userId,
          candidate_email:body.email||'',
          candidate_name:body.name||'',
          item_key:'candidate_record',
          item_type:'system',
          status:'system',
          candidate_archived:Boolean(body.archived),
          updated_at:new Date().toISOString()
        },{onConflict:'user_id,item_key'});
      if(error) throw error;
      return json(200,{ok:true});
    }

    const [
      {data:profiles,error:profileError},
      {data:reports,error:reportError},
      {data:apps,error:appError},
      assignmentResult,
      authUsersResult
    ] = await Promise.all([
      supabase.from('candidate_profiles').select('*').order('created_at',{ascending:false}),
      supabase.from('assessment_results').select('*').order('created_at',{ascending:false}),
      supabase.from('candidate_applications').select('*').order('updated_at',{ascending:false}),
      supabase.from('candidate_assignments').select('*').order('updated_at',{ascending:false}),
      supabase.auth.admin.listUsers({page:1,perPage:1000})
    ]);

    if(profileError) throw profileError;
    if(reportError) throw reportError;
    if(appError) throw appError;

    let assignmentRows = assignmentResult.data || [];
    if(assignmentResult.error){
      const msg = String(assignmentResult.error.message || assignmentResult.error.details || '');
      const assignmentTableMissing = msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('candidate_assignments');
      if(!assignmentTableMissing) throw assignmentResult.error;
      assignmentRows = [];
    }

    if(authUsersResult.error) throw authUsersResult.error;

    const profileById = new Map((profiles || []).map(profile => [profile.id, profile]));
    const visibleProfiles = [...(profiles || [])];

    for(const user of authUsersResult.data?.users || []){
      if(profileById.has(user.id)) continue;

      const metadata = user.user_metadata || {};
      visibleProfiles.push({
        id:user.id,
        email:user.email || '',
        full_name:metadata.full_name || metadata.name || user.email || 'Incomplete signup',
        phone:metadata.phone || '',
        state:metadata.state || '',
        region:metadata.region || '',
        married:metadata.married || '',
        created_at:user.created_at || '',
        updated_at:user.updated_at || user.last_sign_in_at || user.created_at || '',
        profile_incomplete:true
      });
    }

    visibleProfiles.sort((a,b) =>
      new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
    );

    return json(200,{
      ok:true,
      profiles:visibleProfiles,
      submissions:(reports||[]).map(normalizeReport),
      applications:(apps||[]).map(normalizeApplication),
      assignments:assignmentRows
    });
  }catch(err){
    return json(500,{ok:false,error:err.message||'Admin request failed.'});
  }
};
