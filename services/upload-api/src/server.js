const express = require("express");
const multer = require("multer");
const Redis = require("ioredis");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const app = express();
const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: 6379,
});

const uploadDir = "/videos/raw";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const id = uuidv4();
    cb(null, `${id}-${file.originalname}`);
  },
});

const upload = multer({ storage });

app.post("/upload", upload.single("video"), async (req, res) => {
  const job = {
    filename: req.file.filename,
    path: req.file.path,
    uploadedAt: new Date().toISOString(),
  };

  await redis.lpush("video-jobs", JSON.stringify(job));

  res.json({
    message: "Upload successful",
    job,
  });
});

app.get("/health", (req, res) => {
  res.send("OK");
});

app.listen(3000, () => {
  console.log("Upload API listening on port 3000");
});