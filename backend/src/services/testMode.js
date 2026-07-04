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

module.exports = { loadTestMode, isTestModeEnabled, setTestModeEnabled };
