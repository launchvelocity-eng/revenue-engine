import { startBackgroundWorkers } from './workers.js';

app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
  startBackgroundWorkers();
});
