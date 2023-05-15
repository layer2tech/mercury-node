import request from "supertest";
import express from "express";
import router from "../src/routes/channelRoutes";
import { describe, expect, it, beforeAll } from "@jest/globals";
import LDKClientFactory from "../src/LDK/init/LDKClientFactory";
import { uint8ArrayToHexString } from "../src/LDK/utils/utils";
import { MOCK_DATA } from "./mocks/MockLightningClient";

describe("Channel Routes", () => {
  let app: any;
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(router);
    await LDKClientFactory.createLDKClient("test");
  });

  it("GET /nodeID", async () => {
    const response = await request(app).get("/nodeID");

    expect(response.body).toEqual({ nodeID: uint8ArrayToHexString(MOCK_DATA.NODE_ID) });
  });

  it("GET /liveChannels", async () => {
    const response = await request(app).get("/liveChannels");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("POST /createChannel with valid parameters", async () => {
    const response = await request(app).post("/createChannel").send({
      pubkey: MOCK_DATA.PUBKEY,
      amount: MOCK_DATA.AMOUNT,
      push_msat: MOCK_DATA.PUSH_MSAT,
      channelId: MOCK_DATA.CHANNEL_ID,
      channelType: MOCK_DATA.CHANNEL_TYPE,
    });

    expect(response.statusCode).toBe(200);
    expect(response.text).toBe("Created Channel on LDK");
  });

  it("POST /createChannel with valid parameters", async () => {
    const response = await request(app).post("/createChannel").send({});

    expect(response.statusCode).toBe(500);
    expect(response.text).toBe("Missing required parameters");
  });

  it("GET /usableChannels", async () => {
    const response = await request(app).get("/liveChannels");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("GET /allChannels", async () => {
    const response = await request(app).get("/allChannels");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.any(Array));
  });

  it("GET /loadChannels should return 200 and the list of channels for a given wallet name", async () => {
    const response = await request(app).get("/loadChannels/ldk1");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.any(Array));
  });

  it("GET /loadChannels if the wallet with the given name does not exist", async () => {
    const response = await request(app).get("/loadChannels/nonexistentWallet");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("PUT /updateChannelName should update a channel name by id", async () => {
    const response = await request(app).put("/updateChannelName/1").send({
      name: MOCK_DATA.CHANNEL_NAME
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Channel name updated successfully" });
  });

  it("PUT /updateChannelName with invalid channel id", async () => {
    const response = await request(app).put("/updateChannelName/abc").send({
      name: MOCK_DATA.CHANNEL_NAME
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "Invalid channel ID" });
  });

  it("PUT /updateChannelPaid should update a channel paid status by id", async () => {
    const response = await request(app).put("/updateChannelName/1").send({
      paid: MOCK_DATA.PAID
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Channel name updated successfully" });
  });

  it("PUT /updateChannelPaid with invalid channel id", async () => {
    const response = await request(app).put("/updateChannelPaid/abc").send({
      paid: MOCK_DATA.PAID
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "Invalid channel ID" });
  });

  it('PUT /updateChannel should update a channel by id', async () => {
    const response = await request(app)
      .put('/updateChannel/1')
      .send({
        name: MOCK_DATA.CHANNEL_NAME,
        amount: MOCK_DATA.AMOUNT,
        push_msat: MOCK_DATA.PUSH_MSAT,
        wallet_name: "Test Wallet",
        peer_id: 1,
        privkey: MOCK_DATA.PRIVKEY,
        txid: MOCK_DATA.TXID,
        vout: MOCK_DATA.VOUT,
        paid: MOCK_DATA.PAID,
        payment_address: MOCK_DATA.PAYMENT_ADDRESS,
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: 'Channel updated successfully' });
  });

  it('PUT /updateChannel with invalid channel id', async () => {
    const response = await request(app)
      .put('/updateChannel/abc')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid channel ID' });
  });

  it("GET /removeDuplicateChannels", async () => {
    const response = await request(app).get("/removeDuplicateChannels");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Duplicate channels removed successfully" });
  });

  it("DELETE /forceCloseChannel", async () => {
    const response = await request(app).delete(`/forceCloseChannel/${MOCK_DATA.CHANNEL_ID}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Success", status: 200 });
  });

  it("DELETE /mutualCloseChannel", async () => {
    const response = await request(app).delete(`/mutualCloseChannel/${MOCK_DATA.CHANNEL_ID}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Success", status: 200 });
  });

  it("DELETE /deleteChannelByPaymentAddr", async () => {
    const response = await request(app).delete(`/deleteChannelByPaymentAddr/${MOCK_DATA.PAYMENT_ADDRESS}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Data deleted successfully" });
  });
});
