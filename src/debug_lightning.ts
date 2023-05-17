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
import {
  closeConnections,
  savePeerAndChannelToDatabase,
} from "./LDK/utils/ldk-utils";
import { ChannelDetails } from "lightningdevkit";
import { ChalkColor, Logger } from "./LDK/utils/Logger.js";
const DEBUG = new Logger(ChalkColor.Yellow, "debug_lightning.ts");

export async function debug_lightning() {
  DEBUG.log("running");
  await initialiseWasm();

  DEBUG.log("import LDK");
  await LDKClientFactory.createLDKClient("dev");

  DEBUG.log("getLDKClient");
  const LightningClient = await LDKClientFactory.getLDKClient();

  DEBUG.log("start LDK");
  await LightningClient.start();

  DEBUG.log("call updateBestBlockHeight");
  let bestBlockHeight = await LightningClient.updateBestBlockHeight();
  DEBUG.log("bestBlockHeight:", "debug_lightning", bestBlockHeight);

  DEBUG.log("call updateBestBlockHash");
  let bestBlockHash = await LightningClient.updateBestBlockHash();
  DEBUG.log("bestBlockHash:", "debug_lightning", bestBlockHash);

  // node details
  let pubkeyHex =
    "0227e0e3a9198601964d77a5b2d9a2b21ffff59a85a85031d61c6bb27b2ece2075";
  let hostname = "136.244.108.27";
  let port = 9600;

  // Connect to the peer node
  DEBUG.log("Connect to Peer");
  await LightningClient.connectToPeer(pubkeyHex, hostname, port);

  // Sample create invoice
  const receiveInvoice = LightningClient.createInvoice(
    BigInt(100),
    "Coffee",
    36000
  );

  DEBUG.log(
    "Lightning Invoice for receiving: ",
    "debug_lightning",
    receiveInvoice
  );

  // Send a payment to an invoice
  LightningClient.sendPayment("");

  // Connect to the channel
  let pubkey = hexToUint8Array(pubkeyHex);

  if (pubkey) {
    let hostInfo = {
      host: pubkeyHex,
      port,
      channel_name: "",
      wallet_name: "",
      privkey: "",
      paid: true, // TODO: this should be figured out by ldk not manually inserted
      payment_address: "bcrt1qa0h3k6mfhjxedelag752k04lkj245e47kaullm",
    };

    // Set the TXID for the funding generation event
    // bcrt1qa0h3k6mfhjxedelag752k04lkj245e47kaullm
    // txid: 5557bd457de22fb0950cf6364da8ecb0d15ee9c478f874071e5a85fab0978a5f

    // MUST ONLY BE CALLED ONCE - calling it twice opens a new channel
    /*
    await LightningClient.createChannel(
      pubkey,
      100000,
      0,
      1,
      true,
      "5557bd457de22fb0950cf6364da8ecb0d15ee9c478f874071e5a85fab0978a5f",
      hostInfo
    );*/
  }

  // Close a channel
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
  DEBUG.log("Exiting the application");
  closeConnections();
};

const onSigInt = () => {
  // code to be executed on sigint, e.g. close connections, cleanup resources
  DEBUG.log("Application interrupted");
  closeConnections();
  process.exit();
};

process.on("exit", onExit);
process.on("SIGINT", onSigInt);

export default app;
