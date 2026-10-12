import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("app", () => {
  const app = createApp();

  it("answers the health check", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
  });
});
