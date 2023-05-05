import initialiseWasm from "./LDK/init/initializeWasm.js";
import LDKClientFactory from "./LDK/init/LDKClientFactory.js";
import { hexToUint8Array } from "./LDK/utils/utils";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import serverRoutes from "./routes/serverRoutes";
import peerRoutes from "./routes/peerRoutes";
import channelRoutes from "./routes/channelRoutes";
import { closeConnections } from "./LDK/utils/ldk-utils";
import { ChannelDetails } from "lightningdevkit";

export async function debug_lightning() {
  console.log("[debug_lightning.ts]: running");

  await initialiseWasm();

  console.log("[debug_lightning.ts]: import LDK");
  await LDKClientFactory.createLDKClient("dev");

  console.log("[debug_lightning.ts]: getLDKClient");
  const LightningClient = await LDKClientFactory.getLDKClient();

  console.log("[debug_lightning.ts]: start LDK");
  await LightningClient.start();

  console.log("[debug_lightning.ts]: updateBestBlockHeight");
  let bestBlockHeight = await LightningClient.updateBestBlockHeight();
  console.log("[debug_lightning.ts]: bestBlockHeight:", bestBlockHeight);

  console.log("[debug_lightning.ts]: updateBestBlockHash");
  let bestBlockHash = await LightningClient.updateBestBlockHash();
  console.log("[debug_lightning.ts]: bestBlockHash:", bestBlockHash);

  // 03ff520f98be326ec107f4a7bb0109feb8b2b5848f0cede7f5c0e0f01a9209c08b@136.244.108.27:9601
  // 0227e0e3a9198601964d77a5b2d9a2b21ffff59a85a85031d61c6bb27b2ece2075@136.244.108.27:9600

  /*
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

  const invoiceString = LightningClient.createInvoiceUtil(
    BigInt(100),
    "coffee",
    36000
  );
  console.log("[debug_lightning.ts]: Invoice string returned:", invoiceString);

  // get channel balance
  const balance = LightningClient.getChannels();
  balance.forEach((channel: ChannelDetails) => {
    console.log("[debug_lightning.ts]: balances:", channel.get_balance_msat());
  });

  // Connect to the channel
  let pubkey = hexToUint8Array(pubkeyHex);

  if (pubkey) {
    // MUST ONLY BE CALLED ONCE - doesn't currently have any checks to prevent it - can be prevented by checking db
    //await LightningClient.createChannel(pubkey, 100000, 0, 1, true);
  }

  //await LightningClient.forceCloseChannel("ef382090de601be8d62439d80def437503bb5a5e5c2ddc7a5aa27c4a7f3d3618");*/
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
  console.log("[debug_lightning.ts]: Exiting the application");
  closeConnections();
};

const onSigInt = () => {
  // code to be executed on sigint, e.g. close connections, cleanup resources
  console.log("[debug_lightning.ts]: Application interrupted");
  closeConnections();
  process.exit();
};

process.on("exit", onExit);
process.on("SIGINT", onSigInt);

export default app;
