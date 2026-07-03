const client = require("prom-client");

// Create a registry
const register = new client.Registry();

// Collect default Node.js metrics
client.collectDefaultMetrics({
  register,
});
const videosUploaded = new client.Counter({
  name: "videos_uploaded_total",
  help: "Total number of successfully uploaded videos",
  registers: [register],
});
const uploadFailures = new client.Counter({
  name: "upload_failures_total",
  help: "Total number of failed uploads",
  registers: [register],
});
const uploadDuration = new client.Histogram({
  name: "upload_duration_seconds",
  help: "Time taken to upload videos",
  registers: [register],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20],
});
module.exports = {
  register,
  videosUploaded,
  uploadFailures,
  uploadDuration,
};