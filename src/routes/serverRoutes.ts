import express from "express";
const router = express.Router();
import { closeConnections } from '../LDK/utils/ldk-utils';
import { getLDKClient } from "../LDK/init/getLDK.js";

router.get("/closeConnections", async function (req, res) {
  // Closing all connections
  closeConnections();
  res.status(200).json({ message: "Connections closed" });
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
    console.log(err)
    res.status(500).json({ error: err });
  }
});

router.post("/receivePayment", async function (req, res) {
  // receive a payment
});

export default router;
