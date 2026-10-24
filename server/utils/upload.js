const fs = require('fs');
const path = require('path');
const multer = require('multer');

const slugifyCompanyName = (value) => {
  // slug
  if (!value && value !== 0) return 'company';

  const raw = String(value).trim();
  if (!raw) return 'company';

  const slug = raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  return slug || 'company';
};

const getCompanyUploadFolderName = (source = {}) => {
  // folder
  const companyName = source.company_name || source.companyName || source.company || '';
  if (companyName && String(companyName).trim()) {
    return slugifyCompanyName(companyName);
  }

  const rawCompanyId = source.company_id || source.id || 'default';
  return `company-${String(rawCompanyId).trim() || 'default'}`;
};

const getCompanyUploadUrl = (companyNameOrSource, fileName) => {
  // path
  const folderName = typeof companyNameOrSource === 'string'
    ? slugifyCompanyName(companyNameOrSource)
    : getCompanyUploadFolderName(companyNameOrSource);

  return `/uploads/companies/${folderName}/${fileName}`;
};

const ensureCompanyFolder = (companyNameOrIdentifier) => {
  // mkdir
  const folderName = typeof companyNameOrIdentifier === 'string' && companyNameOrIdentifier
    ? slugifyCompanyName(companyNameOrIdentifier)
    : `company-${String(companyNameOrIdentifier || 'default')}`;

  const dir = path.join(__dirname, '..', 'uploads', 'companies', folderName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // target
    try {
      const targetFolder = getCompanyUploadFolderName(req.user || req.body || {});
      const targetDir = ensureCompanyFolder(targetFolder);
      cb(null, targetDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // name
    const safeName = file.originalname
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '');

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  // type
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
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = {
  uploadProfilePhoto,
  ensureCompanyFolder,
  uploadFiles,
  slugifyCompanyName,
  getCompanyUploadFolderName,
  getCompanyUploadUrl,
};
