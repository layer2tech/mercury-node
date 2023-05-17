import {
  PeerManager,
  FeeEstimator,
  Logger,
  BroadcasterInterface,
  NetworkGraph,
  Persist,
  Filter,
  ChainMonitor,
  KeysManager,
  UserConfig,
  ChannelHandshakeConfig,
  ChainParameters,
  ChannelManager,
  Persister,
  ChannelDetails,
  Result_NoneAPIErrorZ,
  InFlightHtlcs,
  Result_RouteLightningErrorZ_OK,
  RouteParameters,
  PaymentParameters,
  Route,
  Option_u64Z_Some,
  Result_InvoiceParseOrSemanticErrorZ_OK,
  Result_InvoiceParseOrSemanticErrorZ_Err,
  Invoice,
  Router,
  UtilMethods,
  Option_u64Z,
  Option_u16Z,
  Result_InvoiceSignOrCreationErrorZ_OK,
  Result_InvoiceSignOrCreationErrorZ_Err,
  Result_InvoiceSignOrCreationErrorZ,
  EventHandler,
  RecipientOnionFields,
} from "lightningdevkit";
import { NodeLDKNet } from "./structs/NodeLDKNet.mjs";
import LightningClientInterface from "./types/LightningClientInterface.js";
import PeerDetails from "./types/PeerDetails.js";
import {
  hexToBytes,
  hexToUint8Array,
  uint8ArrayToHexString,
} from "./utils/utils.js";
import {
  checkIfChannelExists,
  savePeerAndChannelToDatabase,
} from "./utils/ldk-utils.js";
import MercuryEventHandler from "./structs/MercuryEventHandler.js";
import ElectrumClient from "./bitcoin_clients/ElectrumClient.mjs";
import TorClient from "./bitcoin_clients/TorClient.mjs";
import EsploraSyncClient from "./sync/EsploraSyncClient.js";

export default class LightningClient implements LightningClientInterface {
  feeEstimator: FeeEstimator;
  bitcoind_client: TorClient | ElectrumClient;
  logger: Logger;
  txBroadcasted: any;
  txBroadcaster: BroadcasterInterface;
  network: any;
  genesisBlock: any;
  genesisBlockHash: any;
  networkGraph: NetworkGraph;
  filter: Filter;
  persist: Persist;
  persister: Persister;
  eventHandler: EventHandler;
  chainMonitor: ChainMonitor;
  chainWatch: any;
  keysManager: KeysManager;
  config: UserConfig;
  channelHandshakeConfig: ChannelHandshakeConfig;
  params: ChainParameters;
  channelManager: ChannelManager;
  peerManager: PeerManager;
  txDatas: any;
  currentConnections: any[] = [];
  blockHeight: number | undefined;
  latestBlockHeader: Uint8Array | undefined;
  netHandler: NodeLDKNet;
  bestBlockHash: any;
  router: Router;
  syncClient: EsploraSyncClient;
  txdata: any;

  constructor(props: LightningClientInterface) {
    this.feeEstimator = props.feeEstimator;
    this.bitcoind_client = props.bitcoind_client;
    this.logger = props.logger;
    this.txBroadcasted = props.txBroadcasted;
    this.txBroadcaster = props.txBroadcaster;
    this.network = props.network;
    this.genesisBlock = props.genesisBlock;
    this.genesisBlockHash = props.genesisBlockHash;
    this.networkGraph = props.networkGraph;
    this.filter = props.filter;
    this.persist = props.persist;
    this.persister = props.persister;
    this.eventHandler = props.eventHandler;
    this.chainMonitor = props.chainMonitor;
    this.chainWatch = props.chainWatch;
    this.keysManager = props.keysManager;
    this.config = props.config;
    this.channelHandshakeConfig = props.channelHandshakeConfig;
    this.params = props.params;
    this.channelManager = props.channelManager;
    this.peerManager = props.peerManager;
    this.router = props.router;
    this.syncClient = props.syncClient;
    this.netHandler = new NodeLDKNet(this.peerManager);
  }

  /*
    bitcoind Client Functions
    These functions when called update the values of the object and return the value
  */
  async updateBestBlockHeight() {
    this.blockHeight = await this.bitcoind_client.getBestBlockHeight();
    return this.blockHeight;
  }

  async updateBestBlockHash() {
    this.bestBlockHash = await this.bitcoind_client.getBestBlockHash();
    return this.bestBlockHash;
  }

  async updateLatestBlockHeader(height: number | undefined) {
    if (height) {
      let latestBlockHeader = await this.bitcoind_client.getBlockHeader(height);

      this.latestBlockHeader = hexToBytes(latestBlockHeader);
    } else {
      throw Error("[LightningClient.ts]: Block Height undefined");
    }
    return this.latestBlockHeader;
  }

  /*

  */
  async createInvoice(
    amount_sats: bigint,
    description: string,
    expiry_time_secs: number
  ) {
    let some_amount = Option_u64Z.constructor_some(amount_sats);

    // Create a new Date object representing the desired timestamp
    const timestamp = new Date();

    // Get the number of seconds since the UNIX epoch at the timestamp
    const secondsSinceEpoch = Math.floor(timestamp.getTime() / 1000);

    // Convert the number of seconds to a BigInt value
    const durationSinceEpoch = BigInt(secondsSinceEpoch);

    let min_final_cltv_expiry_delta = 36;
    let min_final_cltv_expiry = Option_u16Z.constructor_some(
      min_final_cltv_expiry_delta
    );

    let invoice:
      | Result_InvoiceSignOrCreationErrorZ_OK
      | Result_InvoiceSignOrCreationErrorZ_Err
      | Result_InvoiceSignOrCreationErrorZ =
      UtilMethods.constructor_create_invoice_from_channelmanager_and_duration_since_epoch(
        this.channelManager,
        this.keysManager.as_NodeSigner(),
        this.logger,
        this.network,
        some_amount,
        description,
        durationSinceEpoch,
        expiry_time_secs,
        min_final_cltv_expiry
      );

    console.log(
      "[LightningClient.ts][createInvoiceUtil]: Invoice before encoded:",
      invoice
    );

    if (invoice instanceof Result_InvoiceSignOrCreationErrorZ_Err) {
      console.log(
        "[LightningClient.ts][createInvoiceUtil]: ",
        invoice.err.to_str()
      );
      throw new Error(
        "[LightningClient.ts][createInvoiceUtil]:" + invoice.err.to_str()
      );
    } else if (invoice instanceof Result_InvoiceSignOrCreationErrorZ_OK) {
      let successful_invoice: any =
        Result_InvoiceSignOrCreationErrorZ_OK.constructor_ok(invoice.res);
      console.log(
        "[LightningClient.ts][createInvoiceUtil]: Invoice generated with UTIL METHODS:",
        successful_invoice.res
      );
      let encoded_invoice: Invoice = successful_invoice.res;
      console.log(
        "[LightningClient.ts][createInvoiceUtil]: Encoded_invoice:",
        encoded_invoice.to_str()
      );

      return encoded_invoice.to_str();
    }

    throw new Error(
      "Error occured in [LightningClient.ts/createInvoiceUtil] method not in fail or success state"
    );
  }

  async setEventTxData(txid: any) {
    this.txdata = await this.getTxData(txid);
    MercuryEventHandler.setInputTx(this.txdata);
  }

  async getTxData(txid: any) {
    let txData = await this.bitcoind_client.getTxIdData(txid);
    console.log("[LightningClient.ts]-> getTxData ->", txData);
    return txData;
  }

  async sendPayment(invoiceStr: string) {
    if (invoiceStr === "") return;

    const parsed_invoice = Invoice.constructor_from_str(invoiceStr);

    if (parsed_invoice instanceof Result_InvoiceParseOrSemanticErrorZ_OK) {
      const invoice = parsed_invoice.res;
      console.log("[LightningClient.ts/sendPayment]: " + invoice);

      let amt_msat: bigint = 0n;

      let invoiceSome = invoice.amount_milli_satoshis();
      if (invoiceSome instanceof Option_u64Z_Some) {
        amt_msat = invoiceSome.some;
        console.log(amt_msat);
      }

      if (amt_msat === 0n) {
        throw Error(
          "[LightningClient.ts/sendPayment]: Invalid or zero value invoice"
        );
      }

      const recipient_onion = RecipientOnionFields.constructor_new(
        invoice.payment_secret(),
        invoice.payment_metadata()
      );

      let route: Route;

      let payment_params = PaymentParameters.constructor_from_node_id(
        invoice.recover_payee_pub_key(),
        Number(invoice.min_final_cltv_expiry_delta())
      );
      let route_params = RouteParameters.constructor_new(
        payment_params,
        amt_msat
      );

      console.log(
        "[LightningClient.ts/sendPayment]: USABLE CHANNELS",
        this.channelManager.list_usable_channels()
      );
      const route_res = this.router.find_route(
        this.channelManager.get_our_node_id(),
        route_params,
        this.channelManager.list_usable_channels(),
        InFlightHtlcs.constructor_new()
      );

      let payment_id = new Uint8Array(Math.random() * 1000);

      if (route_res instanceof Result_RouteLightningErrorZ_OK) {
        route = route_res.res;
        console.log(route);
        const payment_res = this.channelManager.send_payment_with_route(
          route,
          invoice.payment_hash(),
          recipient_onion,
          payment_id
        );
        console.log(payment_res);
        return payment_res;
      }
    } else if (
      parsed_invoice instanceof Result_InvoiceParseOrSemanticErrorZ_Err
    ) {
      return parsed_invoice.err.to_str();
    }

    throw Error("Error occured in [LightningClient.ts/sendPayment] method");
  }

  // This function runs after createNewPeer->connectToPeer
  async connectToPeer(pubkeyHex: string, host: string, port: number) {
    let pubkey = hexToUint8Array(pubkeyHex);
    if (pubkey) {
      const peerDetails: PeerDetails = {
        pubkey,
        host,
        port,
        id: this.currentConnections.length + 1,
      };
      try {
        let socket = await this.create_socket(peerDetails);
        return true; // return true if the connection is successful
      } catch (e) {
        console.error("[LightningClient.ts]: error on create_socket", e);
        throw e; // re-throw the error to the parent function
      }
    }
    throw new Error("Was not able to convert pubkeyHex to a uint8array");
  }

  // This function runs after createNewChannel->createChannel
  async createChannel(
    pubkey: Uint8Array,
    amount: number,
    push_msat: number,
    channelId: number,
    channelType: boolean,
    funding_txid: string,

    hostProperties: {
      host: string;
      port: number;
      channel_name: string;
      wallet_name: string;
      privkey: string;
      paid: boolean;
      payment_address: string;
    }
  ) {
    const {
      host,
      port,
      channel_name,
      wallet_name,
      privkey,
      paid,
      payment_address,
    } = hostProperties;

    // Set the txid of the channel
    this.setEventTxData(funding_txid);

    console.log("[LightningClient.ts]: pubkey found:", pubkey);

    await this.updateBestBlockHeight();
    await this.updateLatestBlockHeader(this.blockHeight);

    let channelValSatoshis = BigInt(amount);
    let pushMsat = BigInt(push_msat);
    let userChannelId = BigInt(channelId);
    let pubkeyHex = uint8ArrayToHexString(pubkey);

    // create the override_config
    let override_config: UserConfig = UserConfig.constructor_default();
    override_config
      .get_channel_handshake_config()
      .set_announced_channel(channelType);

    let channelCreateResponse;
    console.log(
      "[LightningClient.ts]: Reached here ready to create channel..."
    );
    try {
      const channelExists = await checkIfChannelExists(pubkeyHex);
      if (!channelExists) {
        const result = await savePeerAndChannelToDatabase(
          amount,
          pubkeyHex,
          host,
          port,
          channel_name,
          wallet_name,
          channelType,
          privkey,
          paid,
          payment_address
        );
        if (result && result.status === 201) {
          channelCreateResponse = this.channelManager.create_channel(
            pubkey,
            channelValSatoshis,
            pushMsat,
            userChannelId,
            override_config
          );
        }
      } else {
        throw new Error(
          "Channel already exists with this pubkey - " + pubkeyHex
        );
      }
    } catch (e) {
      if (pubkey.length !== 33) {
        console.log("[LightningClient.ts]: Entered incorrect pubkey - ", e);
      } else {
        console.log(
          `[LightningClient.ts]: Lightning node with pubkey ${pubkeyHex} unreachable - `,
          e
        );
      }
    }
    if (this.blockHeight && this.latestBlockHeader) {
      for (let i = 0; i++; i <= this.blockHeight) {
        await this.updateLatestBlockHeader(i + 1);
        this.channelManager
          .as_Listen()
          .block_connected(this.latestBlockHeader, this.blockHeight);
        this.chainMonitor
          .as_Listen()
          .block_connected(this.latestBlockHeader, this.blockHeight);
      }
    }

    console.log(
      "[LightningClient.ts]: Channel Create Response: ",
      channelCreateResponse
    );
    // Should return Ok response to display to user
    return true;
  }

  // Forces a channel to close
  forceCloseChannel(pubkey: string): boolean {
    const channels: ChannelDetails[] = this.getChannels();

    console.log(
      "[LightningClient.ts/forceCloseChannel]: channels found->",
      channels
    );

    let channelClosed = false;

    for (const chn of channels) {
      const hexId = uint8ArrayToHexString(chn.get_channel_id());
      console.log(
        "[LightningClient.ts/forceCloseChannel]: channelId found->",
        hexId
      );

      if (hexId === pubkey) {
        const result: Result_NoneAPIErrorZ =
          this.channelManager.force_close_broadcasting_latest_txn(
            chn.get_channel_id(),
            chn.get_counterparty().get_node_id()
          );

        if (result.is_ok()) {
          channelClosed = true;
          break;
        }
      }
    }

    if (channelClosed) {
      return true;
    } else {
      throw new Error("Trying to close a channel that doesn't exist on LDK");
    }
  }

  // Mutual close a channel
  mutualCloseChannel(pubkey: string): boolean {
    const channels: ChannelDetails[] = this.getChannels();

    console.log(
      "[LightningClient.ts/mutualCloseChannel]: channels found->",
      channels
    );

    for (const chn of channels) {
      const hexId = uint8ArrayToHexString(chn.get_channel_id());
      console.log(
        "[LightningClient.ts/mutualCloseChannel]: channelId found->",
        hexId
      );
      if (hexId === pubkey) {
        const result: Result_NoneAPIErrorZ = this.channelManager.close_channel(
          chn.get_channel_id(),
          chn.get_counterparty().get_node_id()
        );

        if (result.is_ok()) {
          return true;
        } else {
          return false;
        }
      }
    }

    throw new Error(
      "[LightningClient.ts/mutualCloseChannel]: Trying to close a channel that doesn't exist on LDK"
    );
  }

  async create_socket(peerDetails: PeerDetails) {
    // Create Socket for outbound connection: check NodeNet LDK docs for inbound
    const { pubkey, host, port } = peerDetails;
    try {
      await this.netHandler.connect_peer(host, port, pubkey);
    } catch (e) {
      console.log(
        "[LightningClient.ts/create_socket]: Error connecting to peer: ",
        e
      );
      throw e; // or handle the error in a different way
    }

    await new Promise<void>((resolve) => {
      // Wait until the peers are connected and have exchanged the initial handshake
      var timer: any;
      timer = setInterval(() => {
        if (this.peerManager.get_peer_node_ids().length == 1) {
          resolve();
          clearInterval(timer);
        }
      }, 1000);
    });
  }

  getOurNodeId() {
    return this.channelManager.get_our_node_id();
  }

  getChainMonitor(): ChainMonitor {
    return this.chainMonitor;
  }

  getPeerManager(): PeerManager {
    return this.peerManager;
  }

  getChannels() {
    return this.channelManager.list_channels();
  }

  getUsableChannels() {
    return this.channelManager.list_usable_channels();
  }

  getTxBroadCaster() {
    return this.txBroadcasted;
  }

  listPeers() {
    return this.peerManager.get_peer_node_ids();
  }

  async sync() {
    // sync the client
    return await this.syncClient.sync([
      this.channelManager.as_Confirm(),
      this.chainMonitor.as_Confirm(),
    ]);
  }

  // starts the lightning LDK
  async start() {
    console.log(
      "[LightningClient.ts/start]: Calling ChannelManager's timer_tick_occurred on startup"
    );
    this.channelManager.timer_tick_occurred();

    console.log("[LightningClient.ts/start]: Listening for events");
    setInterval(async () => {
      // processes events on ChannelManager and ChainMonitor
      await this.processPendingEvents();
    }, 2000);

    // sync up LDK with chain every 10seconds
    setInterval(async () => {
      await this.sync();
    }, 10000);
  }

  async processPendingEvents() {
    this.channelManager
      .as_EventsProvider()
      .process_pending_events(this.eventHandler);

    this.chainMonitor
      .as_EventsProvider()
      .process_pending_events(this.eventHandler);

    this.peerManager.process_events();

    // every 100 milli seconds persist channel manager to disk
    setInterval(async () => {
      this.persister.persist_manager(this.channelManager);
    }, 100);

    // 60 seconds after start prune
  }
}
