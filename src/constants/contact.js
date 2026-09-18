const CONTACT_CATEGORIES = Object.freeze([
  'general_question',
  'report_issue',
  'privacy_concern',
  'case_information_concern',
  'volunteer_legal_aid'
]);

const CONTACT_CATEGORY_LABELS = Object.freeze({
  general_question: 'General Question',
  report_issue: 'Report Issue',
  privacy_concern: 'Privacy Concern',
  case_information_concern: 'Case Information Concern',
  volunteer_legal_aid: 'Volunteer Legal Aid'
});

const CONTACT_STATUSES = Object.freeze([
  'new',
  'in_review',
  'resolved',
  'closed'
]);

module.exports = {
  CONTACT_CATEGORIES,
  CONTACT_CATEGORY_LABELS,
  CONTACT_STATUSES
};
