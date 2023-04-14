import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import serverRoutes from "./routes/serverRoutes.js";
import peerRoutes from "./routes/peerRoutes.js";
import channelRoutes from "./routes/channelRoutes.js";
import { closeConnections } from "./LDK/utils/ldk-utils.js";
import initialiseWasm from "./LDK/init/initialiseWasm.js";
import { getLDKClient, createLDK } from "./LDK/init/getLDK.js";
import LightningClient from "./LDK/LightningClient.js";
import { debug_lightning } from "./debug_lightning.js";

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
app.listen(PORT, async () => {
  /* PRODUCTION CODE */
  console.log(
    `[Server.ts]: lightning-adapter listening at http://localhost:${PORT}`
  );
  await initialiseWasm();
  console.log("[Server.ts]: Finished initialiseWasm");
  await createLDK("dev"); // prod or dev
  console.log("[Server.ts]: Finished create LDK");
  const LightningClient: LightningClient = getLDKClient();
  console.log("[Server.ts]: Starting LDK Client");
  await LightningClient.start();
  console.log("[Server.ts]: LDK Client started");

  // DEBUGGING CODE TO RUN IN REGTEST (POLAR LIGHTNING NODE SEE ELECTRUMCLIENT.MTS)
  // debug_lightning();
});

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
