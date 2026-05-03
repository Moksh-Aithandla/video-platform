const Redis = require("ioredis");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: 6379,
});

const RAW_DIR = "/videos/raw";
const PROCESSED_DIR = "/videos/processed";

if (!fs.existsSync(PROCESSED_DIR)) {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

async function processJobs() {
  console.log("Worker started...");

  while (true) {
    const result = await redis.brpop("video-jobs", 0);
    const job = JSON.parse(result[1]);

    console.log("Processing:", job.filename);

    const inputPath = path.join(RAW_DIR, job.filename);
    const outputDir = path.join(PROCESSED_DIR, job.filename);

    fs.mkdirSync(outputDir, { recursive: true });

    const command = `
      ffmpeg -i "${inputPath}" \
      -codec: copy \
      "${outputDir}/processed.mp4"
    `;

    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error("FFmpeg Error:", err);
        return;
      }

      console.log("Processing complete:", job.filename);
    });
  }
}

processJobs();