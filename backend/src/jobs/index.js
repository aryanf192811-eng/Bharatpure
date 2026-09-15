const cron = require('node-cron');

const logger = require('../utils/logger');
const { runTrustScoreJob } = require('./trust-score.job');
const { runCropAdvisoryJob } = require('./crop-advisory.job');

/** Registers all scheduled jobs. Called once from server.js at boot. */
const startJobs = () => {
  // Nightly at 2:00 AM IST, per chatbot.md TASK-P5-003. Explicit timezone so this is correct
  // regardless of what timezone the server itself is running in.
  cron.schedule(
    '0 2 * * *',
    async () => {
      try {
        await runTrustScoreJob();
      } catch (err) {
        logger.error({ action: 'SCHEDULED_TRUST_SCORE_JOB_FAILED', err: err.message });
      }
    },
    { timezone: 'Asia/Kolkata' },
  );
  // Nightly at 2:30 AM IST -- staggered after trust scores rather than run concurrently, same
  // low-traffic window.
  cron.schedule(
    '30 2 * * *',
    async () => {
      try {
        await runCropAdvisoryJob();
      } catch (err) {
        logger.error({ action: 'SCHEDULED_CROP_ADVISORY_JOB_FAILED', err: err.message });
      }
    },
    { timezone: 'Asia/Kolkata' },
  );
  logger.info({ action: 'JOBS_SCHEDULED', jobs: ['trust-score (nightly 2am IST)', 'crop-advisory (nightly 2:30am IST)'] });
};

module.exports = { startJobs };
