const http = require("http");
const Redis = require("ioredis");
const { exec } = require("child_process");
const util = require("util");
const fs = require("fs");
const path = require("path");

const {
  register,
  videosProcessed,
  processingFailures,
  processingDuration,
  activeJobs,
} = require("./metrics");

const execPromise = util.promisify(exec);

const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: 6379,
});

const RAW_DIR = "/videos/raw";
const PROCESSED_DIR = "/videos/processed";

if (!fs.existsSync(PROCESSED_DIR)) {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

async function processVideo(inputPath, outputPath, resolution) {
  const command = `
ffmpeg -y -i "${inputPath}" \
-vf scale=-2:${resolution} \
-c:v libx264 \
-c:a aac \
-hls_time 4 \
-hls_playlist_type vod \
-hls_segment_filename "${outputPath}/segment_%03d.ts" \
"${outputPath}/index.m3u8"
`;

  console.log(`Starting ${resolution}p transcoding...`);

  try {
    const { stdout, stderr } = await execPromise(command);

    if (stdout) {
      console.log(stdout);
    }

    if (stderr) {
      console.log(stderr);
    }

    console.log(`${resolution}p generation complete`);
  } catch (err) {
    console.error(`${resolution}p FFmpeg Error:`, err);
    throw err;
  }
}

async function processJobs() {
  console.log("Worker started...");

  while (true) {
    try {
      // Wait for a job from Redis
      const result = await redis.brpop("video-jobs", 0);
      const job = JSON.parse(result[1]);

      console.log("Processing:", job.filename);

      // Metrics
      activeJobs.inc();
      const endTimer = processingDuration.startTimer();

      try {
        const inputPath = path.join(RAW_DIR, job.filename);
        const outputDir = path.join(PROCESSED_DIR, job.filename);

        fs.mkdirSync(outputDir, { recursive: true });

        const output480 = path.join(outputDir, "480p");
        const output720 = path.join(outputDir, "720p");

        fs.mkdirSync(output480, { recursive: true });
        fs.mkdirSync(output720, { recursive: true });

        // Generate 480p
        await processVideo(inputPath, output480, 480);

        // Generate 720p
        await processVideo(inputPath, output720, 720);

        // Create Master Playlist
        const masterPlaylist = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480
480p/index.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720p/index.m3u8
`;

        fs.writeFileSync(
          path.join(outputDir, "master.m3u8"),
          masterPlaylist
        );

        console.log("Master playlist created");

        // Success Metrics
        videosProcessed.inc();

        console.log("Processing complete:", job.filename);

      } catch (err) {
        // Failure Metrics
        processingFailures.inc();

        console.error("Worker Processing Error:", err);

      } finally {
        // Always execute
        activeJobs.dec();
        endTimer();
      }

    } catch (err) {
      console.error("Redis Error:", err);
    }
  }
}

// Metrics HTTP Server
http
  .createServer(async (req, res) => {
    if (req.url === "/metrics") {
      res.writeHead(200, {
        "Content-Type": register.contentType,
      });

      res.end(await register.metrics());
      return;
    }

    res.writeHead(404);
    res.end();
  })
  .listen(3001, () => {
    console.log("Metrics server listening on port 3001");
  });

// Start Worker
processJobs();