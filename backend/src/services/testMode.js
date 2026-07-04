let cached = false;

async function loadTestMode() {
  const { CompanySettings } = require('../models');
  const s = await CompanySettings.findOne();
  cached = !!s?.testModeEnabled;
  return cached;
}

function isTestModeEnabled() {
  return cached;
}

function setTestModeEnabled(v) {
  cached = !!v;
}

// "Super admin" is whichever admin account was created first — usernames
// vary per deployment (may get auto-assigned from the user's name), so we
// can't hardcode a literal username. The dedicated test-login account is
// always named "testadmin", so that one is safe to check by username.
async function canToggleTestMode(user) {
  if (!user) return false;
  if (user.username === 'testadmin') return true;
  const { User } = require('../models');
  const earliestAdmin = await User.findOne({ where: { role: 'admin' }, order: [['createdAt', 'ASC']] });
  return !!earliestAdmin && earliestAdmin.id === user.id;
}

module.exports = { loadTestMode, isTestModeEnabled, setTestModeEnabled, canToggleTestMode };
