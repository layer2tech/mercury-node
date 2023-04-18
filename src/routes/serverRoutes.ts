import express from "express";
const router = express.Router();
import { closeConnections } from '../LDK/utils/ldk-utils';
import { 
  Invoice, 
  Result_InvoiceParseOrSemanticErrorZ_OK, 
  Option_u64Z_Some, 
  PaymentParameters,
  Route,
  RouteParameters,
  Result_RouteLightningErrorZ_OK,
  InFlightHtlcs,
} from "lightningdevkit";
import { getLDKClient } from "../LDK/init/getLDK.js";

router.get("/closeConnections", async function (req, res) {
  // Closing all connections
  closeConnections();
  res.status(200).json({ message: "Connections closed" });
});

router.post("/send-payment", async function (req, res) {
  // send a payment with values posted into this route ->
  const invoice_str = req.body.invoice;
  const parsed_invoice = Invoice.constructor_from_str(invoice_str);

  if (parsed_invoice instanceof Result_InvoiceParseOrSemanticErrorZ_OK) {
    const invoice = parsed_invoice.res;
    console.log(invoice); // this will log the Invoice object

    let amt_msat = 0;

    if (invoice.amount_milli_satoshis() instanceof Option_u64Z_Some) {
      amt_msat = invoice.amount_milli_satoshis().some;
      console.log(amt_msat)
    }

    if (amt_msat == 0) {
      res.status(500).json({ error: "Invalid or zero value invoice" });
    }

    let route : Route;

    let payment_params = PaymentParameters.constructor_from_node_id(invoice.recover_payee_pub_key(), Number(invoice.min_final_cltv_expiry_delta()));
    let route_params = RouteParameters.constructor_new(payment_params, BigInt(amt_msat));

    try {
      console.log("USABLE CHANNELS")
      console.log(getLDKClient().channelManager.list_usable_channels());
      const route_res = getLDKClient().router.find_route(
        getLDKClient().channelManager.get_our_node_id(),
        route_params,
        getLDKClient().channelManager.list_usable_channels(),
        InFlightHtlcs.constructor_new()
      );

      let payment_id = new Uint8Array(Math.random()*1000);

      if (route_res instanceof Result_RouteLightningErrorZ_OK) {
        route =  route_res.res;
        console.log(route)
        const payment_res = getLDKClient().channelManager.send_payment(route, invoice.payment_hash(), invoice.payment_secret(), payment_id);
        console.log(payment_res)
      }
    } catch (err: any) {
      // Handle the error
      console.log(err)
      res.status(500).json({ error: err });
    }
  }
});

router.post("/receivePayment", async function (req, res) {
  // receive a payment
});

export default router;
