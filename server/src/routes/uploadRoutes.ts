import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { authenticate } from "../middleware/auth";

const router = Router();

// 上传目录：server/data/uploads（与 index.ts 的 /data 静态目录一致；已被 .gitignore 忽略）
const UPLOAD_DIR = path.join(__dirname, "../../data/uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error("仅支持 jpg / png / gif / webp 图片"));
    }
    cb(null, true);
  },
});

// 上传图片（登录即可），返回可直接用于 <img src> 的相对路径
router.post("/", authenticate, (req: Request, res: Response) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const msg =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? `图片过大，请不超过 ${MAX_SIZE / 1024 / 1024}MB`
          : err.message || "上传失败";
      return res.status(400).json({ error: msg });
    }
    if (!req.file) {
      return res.status(400).json({ error: "未收到文件" });
    }
    res.status(201).json({ url: `/data/uploads/${req.file.filename}` });
  });
});

export default router;
