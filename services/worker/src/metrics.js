const client = require("prom-client");

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const videosProcessed = new client.Counter({
  name: "videos_processed_total",
  help: "Total number of successfully processed videos",
});

const processingFailures = new client.Counter({
  name: "processing_failures_total",
  help: "Total number of failed video processing jobs",
});

const processingDuration = new client.Histogram({
  name: "processing_duration_seconds",
  help: "Time taken to process videos",
  buckets: [1, 5, 10, 20, 30, 60, 120],
});

const activeJobs = new client.Gauge({
  name: "active_processing_jobs",
  help: "Current number of videos being processed",
});

register.registerMetric(videosProcessed);
register.registerMetric(processingFailures);
register.registerMetric(processingDuration);
register.registerMetric(activeJobs);

module.exports = {
  register,
  videosProcessed,
  processingFailures,
  processingDuration,
  activeJobs,
};