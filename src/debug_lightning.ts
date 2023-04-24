import initialiseWasm from "./LDK/init/initialiseWasm.js";
import { getLDKClient, createLDK } from "./LDK/init/getLDK.js";
import { hexToUint8Array } from "./LDK/utils/utils.ts";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import serverRoutes from "./routes/serverRoutes";
import peerRoutes from "./routes/peerRoutes";
import channelRoutes from "./routes/channelRoutes";
import { closeConnections } from "./LDK/utils/ldk-utils";

export async function debug_lightning() {
  console.log("[debug_lightning.ts]: running");

  await initialiseWasm();

  console.log("[debug_lightning.ts]: import LDK");
  await createLDK("dev");

  console.log("[debug_lightning.ts]: getLDKClient");
  const LightningClient = await getLDKClient();

  console.log("[debug_lightning.ts]: start LDK");
  await LightningClient.start();

  console.log("[debug_lightning.ts]: getBlockHeight");
  let blockHeight = await LightningClient.getBlockHeight();

  console.log("[debug_lightning.ts]: getBestBlockHash");
  let bestBlockHash = await LightningClient.getBestBlockHash();

  // 035ed8262d974f29af1926d2d055112e4a96d91072d18ecfefec2ec0521877d11d@127.0.0.1:9737
  // 029fb20b846d911b9aee81e7e64e46de70c52df93489465998f374fdc3e0df9845@127.0.0.1:9738

  // 03534237af8affcf708cfe553b59fafa3a8420a4aaf1b2861d6e52df967976b53b@127.0.0.1:9735

  // Polar node details
  let pubkeyHex =
    "03534237af8affcf708cfe553b59fafa3a8420a4aaf1b2861d6e52df967976b53b";
  let hostname = "127.0.0.1";
  let port = 9735;

  // Connect to the peer node
  console.log("[debug_lightning.ts]: Connect to Peer");
  await LightningClient.connectToPeer(pubkeyHex, hostname, port);

  // Set the TXID for the funding generation event
  // bcrt1q0zxgl8d78wpkwmpql8fcr79dds5v80237zg52s
  // txid: 6738dc075642815b67845be57a452e93909fe4c7e52e7397c2713d9b6c57387d

  LightningClient.setEventTXData(
    "6cf30a3fc3a32774494a9b04d06459f1ffd05382cf9e4e943675bea74c99a64c"
  );

  let privateKey = crypto.randomBytes(32);

  LightningClient.createInvoice(50000, 5000, "Test Invoice", privateKey);

  // Connect to the channel
  let pubkey = hexToUint8Array(pubkeyHex);
  //console.log("[debug_lightning.ts]: Connect to channel");
  if (pubkey) {
    //await LightningClient.createChannel(pubkey, 100000, 0, 1, true);
  }

  //await LightningClient.forceCloseChannel("ef382090de601be8d62439d80def437503bb5a5e5c2ddc7a5aa27c4a7f3d3618");
}

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
  debug_lightning();
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

export default app;
