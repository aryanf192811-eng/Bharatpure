const { z } = require('zod');

const runSimulationSchema = z.object({
  crop_type: z.string().min(1),
  city: z.string().min(1),
  demand_spike_pct: z.number().min(0).max(50),
  supply_disruption_pct: z.number().min(0).max(40),
});

module.exports = { runSimulationSchema };
