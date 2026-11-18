// The worker container's health check (07-OPS-ARCH 4.3), which distroless gives no shell to run.
import { HEARTBEAT_MAX_AGE_MS, HEARTBEAT_PATH, isHeartbeatFresh } from './worker-heartbeat.js';

process.exitCode = isHeartbeatFresh(HEARTBEAT_PATH, HEARTBEAT_MAX_AGE_MS, Date.now()) ? 0 : 1;
