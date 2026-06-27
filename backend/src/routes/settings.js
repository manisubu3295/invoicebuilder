const router = require('express').Router();
const { CompanySettings } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

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

router.put('/', rbac('admin'), async (req, res) => {
  try {
    const s = await getOrCreate();
    await s.update(req.body);
    res.json(s);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
