const { adminClient, json, requireUser } = require('./_auth');
const { regionForState } = require('./_regions');

const UPLOAD_RULES = {
  photo:{
    max:25 * 1024 * 1024,
    types:new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
  },
  resume:{
    max:15 * 1024 * 1024,
    types:new Set([
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ])
  }
};

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const admin = adminClient();
    const { user } = await requireUser(event, admin);
    const body = JSON.parse(event.body || '{}');
    const application = body.application && typeof body.application === 'object' ? body.application : {};
    const status = body.status === 'submitted' ? 'submitted' : 'draft';
    const uploads = await Promise.all(
      (Array.isArray(body.uploads) ? body.uploads : [])
        .map(upload => validateStoredUpload(admin, upload, user.id))
    );
    const state = String(application.state || '').trim().toUpperCase();
    const region = regionForState(state);
    const now = new Date().toISOString();

    const { data:existing, error:existingError, supportsReopenFields } = await loadExistingApplication(admin, user.id);
    if (existingError) throw existingError;
    if (existing?.status === 'submitted') {
      return json(409, {
        ok:false,
        locked:true,
        error:'This application has been submitted and is locked. Ask your CMC leader to reopen it if a change is needed.'
      });
    }

    const photoUpload = uploads.find(upload => upload.kind === 'photo');
    const resumeUpload = uploads.find(upload => upload.kind === 'resume');
    const row = {
      user_id:user.id,
      candidate_name:String(application.fullName || '').trim(),
      email:user.email || '',
      phone:String(application.phone || '').trim(),
      state,
      region,
      status,
      completion:completionPercent(application),
      application:{ ...application, email:user.email || '', state, region },
      photo_path:photoUpload?.path || existing?.photo_path || null,
      photo_name:photoUpload?.fileName || existing?.photo_name || null,
      resume_path:resumeUpload?.path || existing?.resume_path || null,
      resume_name:resumeUpload?.fileName || existing?.resume_name || null,
      submitted_at:status === 'submitted' ? now : existing?.submitted_at || null,
      updated_at:now
    };
    if (supportsReopenFields) {
      row.reopened_at = existing?.reopened_at || null;
      row.reopened_by = existing?.reopened_by || null;
      row.reopen_reason = existing?.reopen_reason || '';
    }

    const { data, error } = await admin
      .from('candidate_applications')
      .upsert(row, { onConflict:'user_id' })
      .select('*')
      .single();
    if (error) throw error;

    await admin.from('candidate_profiles').upsert({
      id:user.id,
      full_name:row.candidate_name,
      email:user.email || '',
      phone:row.phone,
      state,
      region,
      married:application.maritalStatus === 'Married' ? 'Yes' : 'No',
      updated_at:now
    }, { onConflict:'id' });

    if (status === 'submitted') {
      const { error:auditError } = await admin.from('candidate_application_events').insert({
        application_id:data.id,
        user_id:user.id,
        actor_user_id:user.id,
        action:'submitted'
      });
      if (auditError && !isMissingApplicationSecuritySchema(auditError)) throw auditError;
    }

    return json(200, {
      ok:true,
      application:data,
      locked:status === 'submitted',
      photoName:data.photo_name,
      resumeName:data.resume_name
    });
  } catch (error) {
    return json(error.statusCode || 500, { ok:false, error:error.message || 'Could not save application.' });
  }
};

async function loadExistingApplication(admin, userId) {
  const currentFields = 'id,status,photo_path,photo_name,resume_path,resume_name,submitted_at,reopened_at,reopened_by,reopen_reason';
  const legacyFields = 'id,status,photo_path,photo_name,resume_path,resume_name,submitted_at';
  const current = await admin
    .from('candidate_applications')
    .select(currentFields)
    .eq('user_id', userId)
    .maybeSingle();

  if (!current.error || !isMissingApplicationSecuritySchema(current.error)) {
    return { ...current, supportsReopenFields:true };
  }

  const legacy = await admin
    .from('candidate_applications')
    .select(legacyFields)
    .eq('user_id', userId)
    .maybeSingle();
  return { ...legacy, supportsReopenFields:false };
}

function isMissingApplicationSecuritySchema(error) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error?.code)
    || /candidate_applications\.(reopened_at|reopened_by|reopen_reason).*does not exist/i.test(message)
    || /candidate_application_events.*(does not exist|schema cache)/i.test(message);
}

async function validateStoredUpload(admin, upload, userId) {
  const path = String(upload?.path || '');
  if (!path.startsWith(`${userId}/`) || path.includes('..')) throw validationError('Invalid upload path.');
  const slash = path.lastIndexOf('/');
  const folder = path.slice(0, slash);
  const fileName = path.slice(slash + 1);
  const { data, error } = await admin.storage.from('candidate-uploads').list(folder, {
    search:fileName,
    limit:10
  });
  if (error) throw error;
  const stored = (data || []).find(file => file.name === fileName);
  if (!stored) throw validationError('The uploaded file could not be verified. Please choose it again.');
  return validateUploadMetadata(upload, userId, {
    size:Number(stored.metadata?.size || 0),
    mimeType:String(stored.metadata?.mimetype || stored.metadata?.['content-type'] || '').toLowerCase()
  });
}

function validateUploadMetadata(upload, userId, stored) {
  const rule = UPLOAD_RULES[upload?.kind];
  if (!rule) throw validationError('Unsupported upload type.');
  const path = String(upload.path || '');
  const mimeType = String(stored?.mimeType || '').toLowerCase();
  const size = Number(stored?.size || 0);
  if (!path.startsWith(`${userId}/`) || path.includes('..')) throw validationError('Invalid upload path.');
  if (!rule.types.has(mimeType)) {
    throw validationError(upload.kind === 'photo'
      ? 'Use a JPEG, PNG, WebP, HEIC, or HEIF photo.'
      : 'Use a PDF, DOC, or DOCX résumé.');
  }
  if (!Number.isFinite(size) || size <= 0 || size > rule.max) {
    throw validationError(upload.kind === 'photo' ? 'Keep photos under 25 MB.' : 'Keep résumés under 15 MB.');
  }
  return {
    kind:upload.kind,
    path,
    fileName:String(upload.fileName || '').slice(0, 160),
    mimeType,
    size
  };
}

function completionPercent(application) {
  const keys = [
    'fullName','email','phone','state','address','maritalStatus','conversionStory',
    'callToMinistry','hasSponsor','licenseStatus','lastYearIncome','averageIncome',
    'bankruptcy','whyPlant','plantType','targetAudience','financialPlan','plantTiming',
    'supportNetwork','waiverAgreement','statementOfFaith','coreConvictions'
  ];
  const done = keys.filter(key => {
    const value = application[key];
    return Array.isArray(value) ? value.length : String(value || '').trim();
  }).length;
  return Math.round((done / keys.length) * 100);
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

exports._test = { validateUploadMetadata, isMissingApplicationSecuritySchema };
