const fs = require('fs');
const path = require('path');
const multer = require('multer');

const ensureCompanyFolder = (companyId) => {
  const dir = path.join(__dirname, '..', 'uploads', 'companies', String(companyId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const companyId = req.user?.company_id || req.body?.company_id || 'default';
      const targetDir = ensureCompanyFolder(companyId);
      cb(null, targetDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '');

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new Error('Only JPG, PNG, and WebP images are allowed.'));
};

const uploadProfilePhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

const uploadFiles = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // allow up to 10MB per file
});

module.exports = {
  uploadProfilePhoto,
  ensureCompanyFolder,
  uploadFiles,
};
