import request from "supertest";
import express from "express";
import router from "../src/routes/peerRoutes.js";
import LDKClientFactory from "../src/LDK/init/LDKClientFactory";
import { MOCK_DATA } from "./mocks/MockLightningClient";

describe("Peer Routes", () => {
  let app: any;
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(router);
    await LDKClientFactory.createLDKClient(MOCK_DATA.WALLET_NAME, "mock");
  });

  // it("GET /liveChainMonitors", async () => {
  //   const response = await request(app).get("/liveChainMonitors");

  //   expect(response.statusCode).toBe(500);
  //   expect(response.body).toEqual("Failed to get chain monitor");
  // });

  it("GET /livePeers", async () => {
    const response = await request(app).get("/livePeers");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ status: 500, message: "Failed to get peermanager" });
  });


  it("POST /connectToPeer with valid parameters", async () => {
    const res = await request(app).post("/connectToPeer").send({
      pubkey: MOCK_DATA.PUBKEY,
      host: MOCK_DATA.HOST,
      port: MOCK_DATA.PORT,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 200, message: "Connected to peer" });
  });

  it("POST /connectToPeer with missing parameters", async () => {
    const res = await request(app).post("/connectToPeer").send({});

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ status: 500, message: "Missing required parameters" });
  });

  it("POST /savePeerAndChannelToDb with valid parameters", async () => {
    const res = await request(app).post("/savePeerAndChannelToDb").send({
      amount: MOCK_DATA.AMOUNT,
      pubkey: MOCK_DATA.PUBKEY,
      host: MOCK_DATA.HOST,
      port: MOCK_DATA.PORT,
      channel_name: MOCK_DATA.CHANNEL_NAME,
      wallet_name: MOCK_DATA.WALLET_NAME,
      channelType: MOCK_DATA.CHANNEL_TYPE,
      privkey: MOCK_DATA.PRIVKEY,
      paid: MOCK_DATA.PAID,
      payment_addr: MOCK_DATA.PAYMENT_ADDRESS
    });

    expect(res.statusCode === 200 || res.statusCode === 409).toBeTruthy();
  });

  it("POST /savePeerAndChannelToDb with invalid parameters", async () => {
    const res = await request(app).post("/savePeerAndChannelToDb").send({});

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ status: 500, message: "Couldn't insert into DB: undefined" });
  });

  it("POST /setTxData", async () => {
    const res = await request(app).post("/setTxData").send({
      txid: MOCK_DATA.TXID,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 200, message: "Txid was set correctly." });
  });

  it("POST /saveChannelPaymentInfoToDb with valid parameters", async () => {
    const res = await request(app).post("/saveChannelPaymentInfoToDb").send({
      amount: MOCK_DATA.AMOUNT,
      paid: MOCK_DATA.PAID,
      txid: MOCK_DATA.TXID,
      vout: MOCK_DATA.VOUT,
      address: MOCK_DATA.PAYMENT_ADDRESS
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 200, message: "Channel funding saved to DB" });
  });

  it("POST /saveChannelPaymentInfoToDb with invalid parameters", async () => {
    const res = await request(app).post("/saveChannelPaymentInfoToDb").send({});

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ status: 500, message: "No address was posted to peer/saveChannelPaymentInfoToDb" });
  });

  it("GET /getPeer returns a peer if found", async () => {
    const response = await request(app).get("/getPeer/1");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("node");
    expect(response.body).toHaveProperty("host");
    expect(response.body).toHaveProperty("port");
    expect(response.body).toHaveProperty("pubkey");
  });

  it("GET /getPeer returns 404 if peer is not found", async () => {
    const response = await request(app).get("/getPeer/not-found");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ error: "Peer not found" });
  });

  it("GET /default_peerlist", async () => {
    const response = await request(app).get("/default_peerlist");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.any(Array));
  });

  it("GET /peers", async () => {
    const response = await request(app).get("/peers");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.any(Array));
  });
});
