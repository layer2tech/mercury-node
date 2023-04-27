import express from "express";
const router = express.Router();
import { closeConnections, createInvoice } from "../LDK/utils/ldk-utils";
import { getLDKClient } from "../LDK/init/getLDK";

router.get("/closeConnections", async function (req, res) {
  // Closing all connections
  closeConnections();
  res.status(200).json({ message: "Connections closed" });
});

router.post("/generate_invoice", async function (req, res) {
  try {
    const { amt_in_sats, invoice_expiry_secs, description, privkey_hex } =
      req.body;

    let invoice = getLDKClient().createInvoice(
      amt_in_sats,
      invoice_expiry_secs,
      description,
      privkey_hex
    );

    let response = invoice;
    console.log(response);
    res.status(200).json({ status: 200, response });
  } catch (err) {
    const err_msg = `Bad request: ${err}`;
    console.log(err_msg);
  }
});

router.post("/send-payment", async function (req, res) {
  // send a payment with values posted into this route ->
  const invoice_str = req.body.invoice;
  try {
    const payment_res = await getLDKClient().sendPayment(invoice_str);
    if (payment_res) {
      res.status(200).json({ payment_res });
    } else {
      res.status(500).json({ error: "Payment failed" });
    }
  } catch (err: any) {
    // Handle the error
    console.log(err);
    res.status(500).json({ error: err });
  }
});

router.post("/receivePayment", async function (req, res) {
  // receive a payment
});

export default router;
