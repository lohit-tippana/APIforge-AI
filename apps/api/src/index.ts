import { createServer } from "node:http";
import { config } from "./config";
import { createApp } from "./app";
import { initSocket } from "./lib/socket";

const app = createApp();
const server = createServer(app);
initSocket(server);

server.listen(config.port, () => {
  console.log(`[api] APIForge API listening on http://localhost:${config.port}`);
});
