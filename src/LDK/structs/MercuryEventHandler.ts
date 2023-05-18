import {
  Event,
  EventsProvider,
  Event_FundingGenerationReady,
  // Event_PaymentReceived,
  Event_PaymentSent,
  Event_PaymentPathFailed,
  Event_PendingHTLCsForwardable,
  Event_SpendableOutputs,
  Event_PaymentForwarded,
  Event_ChannelClosed,
  Event_OpenChannelRequest,
  Event_ChannelPending,
  Result_NoneAPIErrorZ,
  Result_NoneAPIErrorZ_OK,
  EventHandlerInterface,
  ChannelManager,
  Event_ChannelReady,
  Event_PaymentClaimed,
  Option_PaymentFailureReasonZ_Some,
  Result_PaymentPreimageAPIErrorZ_OK,
  Result_PaymentPreimageAPIErrorZ,
  PaymentPurpose_InvoicePayment,
  PaymentPurpose,
  PaymentPurpose_SpontaneousPayment,
  Result_PaymentSecretAPIErrorZ,
  Event_PaymentClaimable,
} from "lightningdevkit";

import * as bitcoin from "bitcoinjs-lib";
import {
  uint8ArrayToHexString,
  hexToUint8Array,
  validateSigFunction,
} from "../utils/utils.js";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import crypto from "crypto";
import chalk from "chalk";
import { Transaction } from "bitcoinjs-lib";
import fs from "fs";
import { regtest } from "bitcoinjs-lib/src/networks.js";
import { saveChannelIdToDb } from "../utils/ldk-utils.js";

const ECPair = ECPairFactory(ecc);

enum HTLCStatus {
  Pending,
  Succeeded,
  Failed,
}

class MillisatAmount {
  value: bigint | undefined;
  constructor(value: bigint | undefined) {
    this.value = value;
  }
}

interface PaymentInfo {
  preimage: any;
  secret: any;
  status: HTLCStatus;
  amt_msat: MillisatAmount;
}

class MercuryEventHandler implements EventHandlerInterface {
  channelManager: ChannelManager;
  privateKey: Buffer;

  static vout: any;
  static txid: any;
  static sequence: any;

  payments!: Map<Uint8Array, PaymentInfo>;
  static value: number;

  constructor(_channelManager: ChannelManager) {
    this.channelManager = _channelManager;

    // REMOVE THIS, NEEDS TO BE PASSED IN ON ROUTES.

    const privateKeyFilePath = "private_key.txt";
    // Check if the private key file exists
    if (fs.existsSync(privateKeyFilePath)) {
      // Private key file exists, read the contents
      const privateKeyBuffer = fs.readFileSync(privateKeyFilePath);
      this.privateKey = privateKeyBuffer;
      console.log(
        chalk.red(
          "[MercuryEventHandler.ts/constructor]: Private key:",
          this.privateKey
        )
      );
      console.log(
        chalk.red(
          "[MercuryEventHandler.ts/constructor]: privateKeyBuffer",
          privateKeyBuffer.toString("hex")
        )
      );
    } else {
      // Private key file doesn't exist, generate a new private key
      const privateKeyBuffer = crypto.randomBytes(32);
      this.privateKey = privateKeyBuffer;
      // Save the private key to a file
      fs.writeFileSync(privateKeyFilePath, privateKeyBuffer);
      console.log(
        chalk.red("New private key generated and saved:", this.privateKey)
      );
    }

    this.payments = new Map();
  }

  handle_event(e: any) {
    switch (true) {
      case e instanceof Event_FundingGenerationReady:
        this.handleFundingGenerationReadyEvent_Auto(e);
        break;
      case e instanceof Event_ChannelPending:
        this.handleChannelPendingEvent(e);
        break;
      case e instanceof Event_PaymentClaimed:
        this.handlePaymentClaimed(e);
        break;
      case e instanceof Event_PaymentClaimable:
        this.handlePaymentClaimable(e);
        break;
      case e instanceof Event_PaymentSent:
        this.handlePaymentSentEvent(e);
        break;
      case e instanceof Event_PaymentPathFailed:
        this.handlePaymentPathFailedEvent(e);
        break;
      case e instanceof Event_PendingHTLCsForwardable:
        this.handlePendingHTLCsForwardableEvent(e);
        break;
      case e instanceof Event_SpendableOutputs:
        this.handleSpendableOutputsEvent(e);
        break;
      case e instanceof Event_PaymentForwarded:
        this.handlePaymentForwardedEvent(e);
        break;
      case e instanceof Event_OpenChannelRequest:
        this.handleOpenChannelRequestEvent(e);
        break;
      case e instanceof Event_ChannelClosed:
        this.handleChannelClosedEvent(e);
        break;
      case e instanceof Event_ChannelReady:
        this.handleChannelReadyEvent(e);
        break;
      default:
        console.debug("[MercuryEventHandler.ts]: Event not handled: ", e);
    }
  }

  handlePaymentClaimable(e: Event_PaymentClaimable) {
    const { payment_hash, amount_msat, purpose } = e;

    console.log(
      `[MercuryEventHandler.ts/handlePaymentClaimable]: received payment from payment hash ${uint8ArrayToHexString(
        payment_hash
      )} of ${amount_msat} millisatoshis`
    );

    let payment_preimage: any;
    if (purpose instanceof PaymentPurpose_InvoicePayment) {
      payment_preimage = PaymentPurpose.constructor_invoice_payment(
        purpose.payment_preimage,
        purpose.payment_secret
      );
    } else if (purpose instanceof PaymentPurpose_SpontaneousPayment) {
      payment_preimage = PaymentPurpose.constructor_spontaneous_payment(
        purpose.spontaneous_payment
      );
    }
    this.channelManager.claim_funds(payment_preimage.write());
  }

  handlePaymentClaimed(e: Event_PaymentClaimed) {
    const { payment_hash, purpose, amount_msat, receiver_node_id, clone_ptr } =
      e;
    console.log(
      `[MercuryEventHandler.ts]: EVENT: claimed payment from payment hash ${uint8ArrayToHexString(
        payment_hash
      )} of ${amount_msat} millisatoshis`
    );
    const { payment_preimage, payment_secret } = (() => {
      if (purpose instanceof PaymentPurpose_InvoicePayment) {
        return {
          payment_preimage: purpose.payment_preimage,
          payment_secret: purpose.payment_secret,
        };
      } else if (purpose instanceof PaymentPurpose_SpontaneousPayment) {
        return {
          payment_preimage: purpose.spontaneous_payment,
          payment_secret: null,
        };
      } else {
        throw new Error("Invalid payment purpose");
      }
    })();

    if (this.payments.has(e.payment_hash)) {
      const payment = this.payments.get(e.payment_hash);
      if (payment) {
        payment.status = HTLCStatus.Succeeded;
        payment.preimage = payment_preimage;
        payment.secret = payment_secret;
      }
    } else {
      this.payments.set(e.payment_hash, {
        preimage: payment_preimage,
        secret: payment_secret,
        status: HTLCStatus.Succeeded,
        amt_msat: new MillisatAmount(amount_msat),
      });
    }

    console.log(payment_preimage, payment_secret);
  }

  setChannelManager(channelManager: ChannelManager) {
    this.channelManager = channelManager;
  }

  static validateTx(txData: any): void {
    // validate txData
    if (!txData || typeof txData !== "object") {
      throw new Error("Invalid transaction data provided");
    }
    if (txData.vout === undefined) {
      throw new Error("Invalid vout was set in txid");
    }
    if (txData.txid === undefined) {
      throw new Error("Invalid txid was set in txid");
    }
    if (txData.sequence === undefined) {
      throw new Error("Invalid sequence was set in txid");
    }
  }

  static setInputTx(txData: any, payment_address: string) {
    this.validateTx(txData);
    let matchingVoutIndex = -1; // Initialize with -1 if no match is found
    let amount = 0;

    for (let i = 0; i < txData.vout.length; i++) {
      if (txData.vout[i].scriptpubkey_address === payment_address) {
        matchingVoutIndex = i;
        amount = txData.vout[i].value;
        break; // Exit the loop once a match is found
      }
    }

    if (matchingVoutIndex === -1) {
      throw new Error(
        `No matching vout found for payment address: ${payment_address}`
      );
    }

    // vout is equal to the one with the same payment address we passed in
    MercuryEventHandler.vout = matchingVoutIndex;
    MercuryEventHandler.value = amount;
    MercuryEventHandler.txid = txData.txid;
    MercuryEventHandler.sequence = txData.sequence;
  }

  resetInputTx() {
    MercuryEventHandler.vout = null;
    MercuryEventHandler.txid = null;
    MercuryEventHandler.sequence = null;
  }

  handleFundingGenerationReadyEvent_Manual(
    event: Event_FundingGenerationReady
  ) {
    const {
      temporary_channel_id,
      counterparty_node_id,
      channel_value_satoshis,
      output_script,
    } = event;

    // create funding transaction
    const witness_pos = output_script.length + 58;
    const funding_tx = new Uint8Array(witness_pos + 7);
    funding_tx[0] = 2; // 4-byte tx version 2
    funding_tx[4] = 0;
    funding_tx[5] = 1; // segwit magic bytes
    funding_tx[6] = 1; // 1-byte input count 1
    // 36 bytes previous outpoint all-0s
    funding_tx[43] = 0; // 1-byte input script length 0
    funding_tx[44] = 0xff;
    funding_tx[45] = 0xff;
    funding_tx[46] = 0xff;
    funding_tx[47] = 0xff; // 4-byte nSequence
    funding_tx[48] = 1; // one output
    const channelValueBuffer = Buffer.alloc(8);
    const channelValueNumber = parseInt(channel_value_satoshis.toString(), 10);
    channelValueBuffer.writeUInt32LE(channelValueNumber, 0);
    funding_tx.set(channelValueBuffer, 49);
    funding_tx[57] = output_script.length; // 1-byte output script length
    funding_tx.set(output_script, 58);
    funding_tx[witness_pos] = 1;
    funding_tx[witness_pos + 1] = 1;
    funding_tx[witness_pos + 2] = 0xff; // one witness element of size 1 with contents 0xff
    funding_tx[witness_pos + 3] = 0;
    funding_tx[witness_pos + 4] = 0;
    funding_tx[witness_pos + 5] = 0;
    funding_tx[witness_pos + 6] = 0; // lock time 0

    console.log(
      "[MercuryEventHandler.ts]: funding_tx->",
      uint8ArrayToHexString(funding_tx)
    );

    let fund = this.channelManager.funding_transaction_generated(
      temporary_channel_id,
      counterparty_node_id,
      funding_tx
    );
  }

  validator = (pubkey: Buffer, msghash: Buffer, signature: Buffer): boolean =>
    ECPair.fromPublicKey(pubkey).verify(msghash, signature);

  validateFundingEvent(output_script: Uint8Array) {
    // validate event
    if (
      output_script.length !== 34 &&
      output_script[0] !== 0 &&
      output_script[1] !== 32
    ) {
      return;
    }
  }

  async handleFundingGenerationReadyEvent_Auto(
    event: Event_FundingGenerationReady
  ) {
    const {
      temporary_channel_id,
      counterparty_node_id,
      channel_value_satoshis,
      output_script,
    } = event;

    const network = bitcoin.networks.regtest;

    if (this.privateKey === undefined)
      throw Error("[MercuryEventHandler.ts]: private key is undefined");

    let electrum_wallet = ECPair.fromPrivateKey(this.privateKey, {
      network: network,
    });
    if (electrum_wallet === undefined)
      throw Error("[MercuryEventHandler.ts]: electrum wallet is undefined");

    /*
    console.log(
      "[MercuryEventHandler.ts]: ECPair.fromPrivateKey:",
      ECPair.fromPrivateKey(this.privateKey, { network: network })
    );*/

    // Create the psbt transaction
    const psbt = new bitcoin.Psbt({ network: network });
    psbt.setVersion(2);
    psbt.setLocktime(0);
    const p2wpkh = bitcoin.payments.p2wpkh({
      pubkey: electrum_wallet.publicKey,
      network: network,
    });
    let address = p2wpkh.address;
    if (address === undefined) throw Error("No address found.");

    /*
    console.log(
      chalk.red(
        "[MercuryEventHandler.ts]: SEND TO THIS ADDRESS --------->",
        address
      )
    );*/

    // validation again
    if (p2wpkh.output === undefined) {
      throw Error("[MercuryEventHandler.ts]: p2wpkh output is undefined");
    }
    if (MercuryEventHandler.txid === null) {
      throw Error("[MercuryEventHandler.ts]: No TXID was set");
    }
    if (MercuryEventHandler.vout === null) {
      throw Error("[MercuryEventHandler.ts]: No VOUT was set");
    }
    if (MercuryEventHandler.sequence === null) {
      throw Error("[MercuryEventHandler.ts]: No sequence was set");
    }

    let funding_input = 101000;
    let funding_output = parseInt(channel_value_satoshis.toString(), 10);

    /*
    console.log(
      chalk.red("[MercuryEventHandler.ts]: funding_input ->", funding_input)
    );
    console.log(
      chalk.red("[MercuryEventHandler.ts]: funding_output ->", funding_output)
    );*/

    psbt.addInput({
      hash: MercuryEventHandler.txid,
      index: MercuryEventHandler.vout,
      witnessUtxo: {
        script: bitcoin.address.toOutputScript(address, regtest),
        value: MercuryEventHandler.value,
      },
    });
    psbt.addOutput({
      script: Buffer.from(output_script),
      value: funding_output,
    });

    //psbt.signInput(0, electrum_wallet);
    //psbt.validateSignaturesOfInput(0, this.validator);
    //psbt.finalizeInput(0);

    psbt.signAllInputs(electrum_wallet);
    psbt.validateSignaturesOfAllInputs(this.validator);
    psbt.finalizeAllInputs();

    let funding: Transaction = psbt.extractTransaction();
    let funding_tx: Uint8Array = funding.toBuffer();

    /*
    console.log(
      "[MercuryEventHandler.ts]: output_script ->",
      uint8ArrayToHexString(output_script)
    );
    console.log("[MercuryEventHandler.ts]: privateKey ->", this.privateKey);
    console.log("[MercuryEventHandler.ts]: funding_tx ->", funding_tx);
    console.log("[MercuryEventHandler.ts]: funding_tx_hex->", funding.toHex());*/

    try {
      console.log(
        chalk.red("Send the funding transaction to the channel manager!!!")
      );
      // Send the funding transaction to the channel manager
      let result: any = this.channelManager.funding_transaction_generated(
        temporary_channel_id,
        counterparty_node_id,
        funding_tx
      );

      console.log("RESULT WAS->", result);
    } catch (e) {
      console.log(
        "[MercuryEventHandler.ts]: error occured in funding transaction generated method.."
      );
    }
  }

  handleChannelReadyEvent(e: Event_ChannelReady) {
    console.log(`[MercuryEventHandler.ts]: Channel ready ${e}`);
    console.log(
      `[MercuryEventHandler.ts]: EVENT: Channel ${uint8ArrayToHexString(
        e.channel_id
      )} with peer ${uint8ArrayToHexString(
        e.counterparty_node_id
      )} is ready to be used!`
    );
  }

  handleChannelPendingEvent(event: Event_ChannelPending) {
    const {
      channel_id,
      user_channel_id,
      former_temporary_channel_id,
      counterparty_node_id,
      funding_txo,
    } = event;
    const node_id = uint8ArrayToHexString(counterparty_node_id);
    const pubkey = node_id.split("@")[0];

    const channel_id_str = uint8ArrayToHexString(channel_id);
    if (pubkey !== undefined && channel_id_str !== undefined) {
      saveChannelIdToDb(channel_id_str, pubkey);
    }
  }

  handlePaymentSentEvent(e: Event_PaymentSent) {
    console.log(
      `[MercuryEventHandler.ts]: Payment with preimage '${uint8ArrayToHexString(
        e.payment_preimage
      )}' sent.`
    );
  }

  handlePaymentPathFailedEvent(e: Event_PaymentPathFailed) {
    console.log(
      `[MercuryEventHandler.ts]: Payment with payment hash '${uint8ArrayToHexString(
        e.payment_hash
      )}' failed.`
    );
  }

  handlePendingHTLCsForwardableEvent(e: Event_PendingHTLCsForwardable) {
    this.channelManager.process_pending_htlc_forwards();
  }

  handleSpendableOutputsEvent(e: Event_SpendableOutputs) {
    // var tx = this.keyManager.spend_spendable_outputs(
    //   e.outputs,
    //   [],
    //   Hex.decode(refundAddress),
    //   feeEstimator.get_est_sat_per_1000_weight(
    //     ConfirmationTarget.LDKConfirmationTarget_HighPriority
    //   )
    // );
    // if (tx instanceof Result_TransactionNoneZ.Result_TransactionNoneZ_OK) {
    //   chainBackend.publish(tx.res);
    // }
  }

  handlePaymentForwardedEvent(event: Event_PaymentForwarded) {
    const {
      prev_channel_id, //: Uint8Array;
      next_channel_id, //: Uint8Array;
      fee_earned_msat, //: Option_u64Z;
      claim_from_onchain_tx, //: boolean;
    } = event;

    console.log(
      "[MercuryEventHandler.ts]: Received payment forwarded event",
      event
    );
  }

  handleOpenChannelRequestEvent(event: Event_OpenChannelRequest) {
    const {
      temporary_channel_id, // Uint8Array
      counterparty_node_id, // Uint8Array
      funding_satoshis, // bigint
      push_msat, // bigint
      channel_type, // ChannelTypeFeatures
    } = event;

    console.log(
      "[MercuryEventHandler.ts]: Received open channel request:",
      event
    );
  }

  handleChannelClosedEvent(event: Event_ChannelClosed) {
    console.log("[MercuryEventHandler.ts]: Event Channel Closed!", event);
  }
}

export default MercuryEventHandler;
