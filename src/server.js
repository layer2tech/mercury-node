import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import serverRoutes from "./routes/serverRoutes";
import peerRoutes from "./routes/peerRoutes";
import channelRoutes from "./routes/channelRoutes";
import { closeConnections } from "./LDK/utils/ldk-utils";
import initialiseWasm from "./LDK/init/initializeWasm";
import LDKClientFactory from "./LDK/init/LDKClientFactory";
await initialiseWasm();

// Constants
const PORT = 3003;

// Express app
const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use("/", serverRoutes);
app.use("/peer", peerRoutes);
app.use("/channel", channelRoutes);

// Starting the express server
async function startServer() {
  // Check if the port is in use
  const net = require("net");
  const socket = net.createConnection(PORT, () => {
    socket.destroy();
  });
  try {
    await socket.connect();
    console.log(`Port ${PORT} is in use. Force closing...`);
    socket.destroy();
  } catch (error) {
    if (error.code !== "EADDRINUSE") {
      throw error;
    }
  }

  // Start the express server
  app.listen(PORT, async () => {
    /* PRODUCTION CODE */
    console.log(
      `[Server.ts]: lightning-adapter listening at http://localhost:${PORT}`
    );
  });
}

// Exit handlers
const onExit = () => {
  // code to be executed on exit, e.g. close connections, cleanup resources
  console.log("[Server.ts]: Exiting the application");
  closeConnections();
};

const onSigInt = () => {
  // code to be executed on sigint, e.g. close connections, cleanup resources
  console.log("[Server.ts]: Application interrupted");
  closeConnections();
  process.exit();
};

process.on("exit", onExit);
process.on("SIGINT", onSigInt);

startServer();

export { app };
