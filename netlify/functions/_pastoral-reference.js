const crypto = require('crypto');

const REFERENCE_ITEM_KEY = 'pastoral_reference';

function createReferenceToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashReferenceToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function cleanText(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function validateRequest(body = {}) {
  const pastorName = cleanText(body.pastor_name, 140);
  const pastorEmail = cleanText(body.pastor_email, 254).toLowerCase();
  if (pastorName.length < 2) throw validationError('Enter the pastor’s name.');
  if (!validEmail(pastorEmail)) throw validationError('Enter a valid pastor email address.');
  return { pastorName, pastorEmail };
}

function validateResponse(body = {}) {
  const recommendation = cleanText(body.recommendation, 40);
  const allowedRecommendations = new Set(['recommend', 'recommend_with_reservations', 'do_not_recommend']);
  if (!allowedRecommendations.has(recommendation)) {
    throw validationError('Choose a recommendation.');
  }
  const relationship = cleanText(body.relationship, 220);
  const knownFor = cleanText(body.known_for, 100);
  const strengths = cleanText(body.strengths, 4000);
  const growth = cleanText(body.growth_areas, 4000);
  if (relationship.length < 3) throw validationError('Describe your relationship to the participant.');
  if (!knownFor) throw validationError('Tell us how long you have known the participant.');
  if (strengths.length < 10) throw validationError('Share at least one ministry strength.');
  if (growth.length < 10) throw validationError('Share an area for continued growth.');
  const ratings = {};
  for (const key of ['spiritual_maturity', 'character_integrity', 'teachability', 'relational_health', 'leadership', 'ministry_readiness']) {
    const value = cleanText(body[key], 10);
    if (!['1', '2', '3', '4', '5', 'unable'].includes(value)) {
      throw validationError('Complete each rating before submitting.');
    }
    ratings[key] = value;
  }
  return {
    pastor_title:cleanText(body.pastor_title, 140),
    church_ministry:cleanText(body.church_ministry, 180),
    phone:cleanText(body.phone, 80),
    relationship,
    known_for:knownFor,
    ratings,
    strengths,
    growth_areas:growth,
    concerns:cleanText(body.concerns, 4000),
    recommendation,
    may_contact:Boolean(body.may_contact),
    attested:true
  };
}

function participantStatus(row) {
  if (!row) return { status:'not_requested' };
  return {
    status:row.submitted_at ? 'received' : row.email_error ? 'send_failed' : 'waiting',
    pastor_name:row.pastor_name,
    pastor_email:row.pastor_email,
    requested_at:row.requested_at,
    email_sent_at:row.email_sent_at,
    submitted_at:row.submitted_at
  };
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

module.exports = {
  REFERENCE_ITEM_KEY,
  createReferenceToken,
  hashReferenceToken,
  participantStatus,
  validateRequest,
  validateResponse,
  validEmail
};

