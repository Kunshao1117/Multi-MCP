import { GatewayServer } from '../../src/gateway-server.ts';
import { loadConfig } from '../../src/config-loader.ts';
const config = loadConfig(process.argv[2]);
const gateway = new GatewayServer(config, { version: '1.0.0', generated_at: '', servers: {}, all_tools: {} });
await gateway.start();
