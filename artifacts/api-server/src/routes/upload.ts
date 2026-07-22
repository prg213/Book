import { Router } from "express";
import multer from "multer";
import path from "path";
import { mkdir } from "fs/promises";

const uploadsDir = path.resolve(process.cwd(), "uploads", "originals");

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (err) {
      cb(err as Error, uploadsDir);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const router = Router();

router.post("/upload-photo", upload.single("photo"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const relativePath = path.join("originals", req.file.filename);
  res.json({
    photoPath: relativePath,
    photoUrl: `/api/uploads/${relativePath}`,
  });
});

export default router;
