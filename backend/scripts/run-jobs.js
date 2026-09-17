require('dotenv').config();

const { pool } = require('../src/db');
const { runTrustScoreJob } = require('../src/jobs/trust-score.job');
const { runCropAdvisoryJob } = require('../src/jobs/crop-advisory.job');
const logger = require('../src/utils/logger');

// Both jobs otherwise only run on their 2am/2:30am IST cron schedule (jobs/index.js) -- after a
// db:reset, fpo_profiles.trust_score and crop_advisories are empty until the next scheduled run,
// which silently blanks out the farmer dashboard's trust-tier/streak/badges block and demand
// advisories for anyone testing or demoing sooner than that. Runs both once, on demand.
const runOnce = async () => {
  await runTrustScoreJob();
  await runCropAdvisoryJob();
};

if (require.main === module) {
  runOnce()
    .then(() => {
      logger.info({ action: 'JOBS_RUN_ONCE_COMPLETE' });
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ action: 'JOBS_RUN_ONCE_FAILED', err: err.message });
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { runOnce };
