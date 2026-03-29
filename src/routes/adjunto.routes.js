const router = require('express').Router()
const path   = require('path')
const multer = require('multer')
const ctrl   = require('../controllers/adjunto.controller')
const { authenticate } = require('../middlewares/auth')

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_')
    cb(null, `${Date.now()}-${base}${ext}`)
  },
})

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
]

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Tipo de archivo no permitido'))
  },
})

router.use(authenticate)

// Subir archivo a un ticket
router.post('/tickets/:id/adjuntos', upload.single('archivo'), ctrl.subir)

// Descargar archivo
router.get('/adjuntos/:adjuntoId/download', ctrl.descargar)

// Eliminar archivo
router.delete('/adjuntos/:adjuntoId', ctrl.eliminar)

module.exports = router
