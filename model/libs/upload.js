const multer = require('multer');
const mimeTypes = require('mime-types');
const storage = multer.diskStorage({
    destination: './src/backend/uploads',
    filename: function(req, file, cb) {
        cb(null, `${file.originalname}.${mimeTypes.extension(file.mimetype)}`)
    }
  });
  
const upload = multer({storage: storage});

module.exports = upload;