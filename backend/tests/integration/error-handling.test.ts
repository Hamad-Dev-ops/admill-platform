import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AppError } from "../../src/errors/AppError";
import { errorMiddleware } from "../../src/middlewares/error.middleware";
import { requestLogger } from "../../src/middlewares/logger.middleware";

function buildTestApp() {
  const app = express();

  app.use(requestLogger);

  app.get("/test/operational-error", () => {
    throw new AppError(409, "This is a deliberate operational error");
  });

  app.get("/test/unhandled-error", () => {
    throw new Error("This is a deliberate unhandled error");
  });

  app.use(errorMiddleware);

  return app;
}

describe("errorMiddleware", () => {
  const app = buildTestApp();

  it("returns the AppError's status code and real message for operational errors", async () => {
    const res = await request(app).get("/test/operational-error");

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      message: "This is a deliberate operational error",
    });
  });

  it("returns a generic 500 message for unexpected errors, without leaking internal details", async () => {
    const res = await request(app).get("/test/unhandled-error");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      message: "Something went wrong",
    });
    expect(JSON.stringify(res.body)).not.toContain("deliberate unhandled error");
  });
});
