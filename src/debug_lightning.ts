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
const DEBUG = new Logger(ChalkColor.Cyan, "debug_lightning.ts");
import dotenv from "dotenv";
dotenv.config();

export async function debug_lightning() {
  DEBUG.log("initialiseWasm");
  await initialiseWasm();

  DEBUG.log("createLDKClient with dev");
  await LDKClientFactory.createLDKClient("dev");

  DEBUG.log("getLDKClient");
  const LightningClient = await LDKClientFactory.getLDKClient();

  DEBUG.log("start LDK");
  await LightningClient.start();

  DEBUG.log("call updateBestBlockHeight");
  let bestBlockHeight = await LightningClient.updateBestBlockHeight();
  DEBUG.log("bestBlockHeight:", "", bestBlockHeight);

  DEBUG.log("call updateBestBlockHash");
  let bestBlockHash = await LightningClient.updateBestBlockHash();
  DEBUG.log("bestBlockHash:", "", bestBlockHash);

  // Counterparty LND Node details
  const pubkeyHex = process.env["PUBKEY_HEX"];
  const hostname = process.env["HOSTNAME"];
  const portRead = process.env["PORT"];

  if (!pubkeyHex || !hostname || !portRead) {
    throw new Error("Required environment variables are not set.");
  }
  const port = parseInt(portRead);

  // Connect to the peer node
  DEBUG.log("Connect to Peer");
  await LightningClient.connectToPeer(pubkeyHex, hostname, port);

  // Sample create invoice
  const receiveInvoice = await LightningClient.createInvoice(
    BigInt(500),
    "Sandwich",
    36000
  );

  DEBUG.log("Lightning Invoice for receiving: ", "", receiveInvoice);

  // Send a payment to an invoice
  // LightningClient.sendPayment("lnbcrt10u1pjxfkl7sp55yx83ddzp5rmhgyr9a580udza7cytgz9xy34eff5exwp94am7slspp5xgvxrrep978g8jfdz9aw8zefmeq3xp58m24ckrrt7l4fgckdtq9qdq5w3hjqcn40ysxzgr5v4ssxqyjw5qcqp29qyysgq9djsnkqysjueruzz75pvjnk3sfarumnh09pwvm7f2df069qk4zpy6vqw3wqd3f8ws2jmaykvwzjav8p0aven9ypxsp643q4w5vzksgsp5g75xm");

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
