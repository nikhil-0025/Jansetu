const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Private secure upload directory outside public static exposure
const secureUploadDir = path.join(__dirname, '../secure_uploads/corrections');
if (!fs.existsSync(secureUploadDir)) {
  fs.mkdirSync(secureUploadDir, { recursive: true });
}

// Configurable file size limit (default 5 MB)
const MAX_FILE_SIZE = parseInt(process.env.MAX_PDF_SIZE_BYTES || `${5 * 1024 * 1024}`, 10);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, secureUploadDir);
  },
  filename: (req, file, cb) => {
    const randomHex = crypto.randomBytes(8).toString('hex');
    const safeName = `corr_${Date.now()}_${randomHex}.pdf`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimes = ['application/pdf', 'application/x-pdf'];

  if (ext !== '.pdf') {
    return cb(new Error('Invalid file format. Only official PDF (.pdf) documents are accepted as supporting evidence.'));
  }

  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Invalid MIME type. Uploaded file must be an authentic PDF document.'));
  }

  cb(null, true);
};

const uploadPdf = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
});

/**
 * Validates actual file signature (magic bytes) to ensure file is genuinely a PDF.
 * Checks for "%PDF" magic header (0x25 0x50 0x44 0x46).
 */
const validatePdfSignature = async (filePath) => {
  let fileHandle = null;
  try {
    const stats = await fs.promises.stat(filePath);
    if (stats.size === 0) {
      return { valid: false, reason: 'Uploaded file is completely empty (0 bytes).' };
    }

    fileHandle = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(5);
    const { bytesRead } = await fileHandle.read(buffer, 0, 5, 0);

    if (bytesRead < 4) {
      return { valid: false, reason: 'File is too small to be a valid PDF document.' };
    }

    const header = buffer.toString('ascii');
    if (!header.startsWith('%PDF')) {
      return {
        valid: false,
        reason: 'File header signature verification failed. The file is not an authentic PDF document.'
      };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, reason: `File inspection error: ${err.message}` };
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
};

/**
 * Express middleware wrapper to catch Multer errors gracefully.
 */
const uploadPdfMiddleware = (fieldName) => {
  const uploader = uploadPdf.single(fieldName);
  return (req, res, next) => {
    uploader(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const maxMb = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(1);
          return res.status(400).json({
            success: false,
            message: `Uploaded file exceeds the maximum permissible limit of ${maxMb} MB. Please upload a compressed PDF.`
          });
        }
        return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  };
};

module.exports = {
  uploadPdfMiddleware,
  validatePdfSignature,
  secureUploadDir,
  MAX_FILE_SIZE
};
