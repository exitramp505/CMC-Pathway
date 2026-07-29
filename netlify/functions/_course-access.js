function assignmentKey(course) {
  if (course?.slug === 'discover') return 'discover_course';
  return `course:${course?.id || ''}`;
}

function assignmentRecord(course, profile, source = 'automatic') {
  const now = new Date().toISOString();
  return {
    user_id: profile.id,
    candidate_email: profile.email || '',
    candidate_name: profile.full_name || profile.email || 'Participant',
    item_key: assignmentKey(course),
    item_type: 'course',
    stage_key: course.stage_key,
    status: 'assigned',
    assignment_source: source,
    assigned_at: now,
    hidden_at: null,
    updated_at: now
  };
}

function isCourseAssignmentKey(value) {
  return value === 'discover_course' || String(value || '').startsWith('course:');
}

function courseIdFromAssignmentKey(value) {
  return String(value || '').startsWith('course:') ? String(value).slice(7) : '';
}

module.exports = {
  assignmentKey,
  assignmentRecord,
  isCourseAssignmentKey,
  courseIdFromAssignmentKey
};
