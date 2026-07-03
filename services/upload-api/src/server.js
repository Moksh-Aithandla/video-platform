const express = require("express");
const multer = require("multer");
const Redis = require("ioredis");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const {
  register,
  videosUploaded,
  uploadFailures,
  uploadDuration,
} = require("./metrics");

const app = express();

const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: 6379,
});

const uploadDir = "/videos/raw";

// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const id = uuidv4();
    cb(null, `${id}-${file.originalname}`);
  },
});

const upload = multer({ storage });

/*
----------------------------------------------------
Upload Endpoint
----------------------------------------------------
*/
app.post("/upload", upload.single("video"), async (req, res) => {
  // Start measuring upload duration
  const endTimer = uploadDuration.startTimer();

  try {
    const job = {
      filename: req.file.filename,
      path: req.file.path,
      uploadedAt: new Date().toISOString(),
    };

    // Push processing job to Redis
    await redis.lpush("video-jobs", JSON.stringify(job));

    // Increment successful upload counter
    videosUploaded.inc();

    // Stop timer
    endTimer();

    res.json({
      message: "Upload successful",
      job,
    });

  } catch (err) {

    // Increment failure counter
    uploadFailures.inc();

    // Stop timer even if upload failed
    endTimer();

    console.error("Upload Error:", err);

    res.status(500).json({
      message: "Upload failed",
      error: err.message,
    });
  }
});

/*
----------------------------------------------------
Health Check Endpoint
----------------------------------------------------
*/
app.get("/health", (req, res) => {
  res.send("OK");
});

/*
----------------------------------------------------
Prometheus Metrics Endpoint
----------------------------------------------------
*/
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

/*
----------------------------------------------------
Start Server
----------------------------------------------------
*/
app.listen(3000, () => {
  console.log("Upload API listening on port 3000");
});