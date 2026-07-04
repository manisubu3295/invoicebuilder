const router = require('express').Router();
const { CompanySettings } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { setTestModeEnabled, canToggleTestMode } = require('../services/testMode');

router.use(auth);

async function getOrCreate() {
  let s = await CompanySettings.findOne();
  if (!s) s = await CompanySettings.create({});
  return s;
}

router.get('/', async (req, res) => {
  try {
    res.json(await getOrCreate());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const ALLOWED_FIELDS = [
  'companyName', 'registrationNo', 'address', 'phone', 'email', 'website',
  'bankName', 'bankAccountNo', 'bankAccountName',
  'currency', 'currencySymbol', 'paymentTermsDays', 'signatoryName', 'logoText',
  'logoImage', 'sealImage', 'signatureImage',
  'invoicePrefix', 'invoiceStartNumber', 'quotationPrefix', 'quotationStartNumber',
  'testModeEnabled',
];

router.put('/', rbac('admin'), async (req, res) => {
  try {
    const s = await getOrCreate();
    const updates = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in req.body) updates[key] = req.body[key];
    }
    if ('testModeEnabled' in updates && updates.testModeEnabled !== s.testModeEnabled
      && !(await canToggleTestMode(req.user))) {
      return res.status(403).json({ message: 'Only the super admin or test account can toggle Test Mode' });
    }
    await s.update(updates);
    if ('testModeEnabled' in updates) setTestModeEnabled(s.testModeEnabled);
    res.json(s);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
