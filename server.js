require("dotenv").config();
const fastify = require("fastify")({ logger: true });
const TicketAutomationService = require("./services/ticketAutomationService");

// Register CORS plugin
// fastify.register(require("@fastify/cors"), {
//   origin: true,
// });

// Initialize services
const ticketAutomationService = new TicketAutomationService();

// Health check endpoint
fastify.get("/health", async (request, reply) => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

fastify.addHook("preHandler", (request, reply, done) => {
  // if (request.body) {
  //   request.log.info({ body: request.body }, "parsed body");
  // }
  done();
});

// Notion webhook endpoint
fastify.post("/webhook/notion", async (request, reply) => {
  try {
    const payload = request.body; // Use request.body directly

    // Log the incoming webhook for debugging
    fastify.log.info(
      "Received Notion webhook:",
      JSON.stringify(payload, null, 2)
    );

    // Extract pageId and status from the webhook payload
    const pageId = payload.data?.id;
    const statusProperty = payload.data?.properties?.["Status (FOR CBP ONLY)"];
    fastify.log.info({ statusProperty }, "Extracted status property");

    let status = null;
    if (statusProperty) {
      if (statusProperty.type === "select" && statusProperty.select) {
        status = statusProperty.select.name;
      } else if (statusProperty.type === "status" && statusProperty.status) {
        status = statusProperty.status.name;
      }
    }
    fastify.log.info({ pageId, status }, "Extracted pageId and status");

    if (!pageId || !status) {
      return reply.code(400).send({
        success: false,
        message: "pageId and status are required in webhook payload",
      });
    }

    if (!pageId || !status) {
      return reply.code(400).send({
        success: false,
        message: "pageId and status are required in webhook payload",
      });
    }

    // Directly trigger the status change workflow
    const result = await ticketAutomationService.processStatusChange(
      pageId,
      status
    );

    if (result.success) {
      reply.code(200).send({
        success: true,
        message: result.message,
        data: result.data,
      });
    } else {
      reply.code(500).send({
        success: false,
        message: result.message,
        error: result.error?.message,
      });
    }
  } catch (error) {
    fastify.log.error("Webhook processing error:", error);
    reply.code(500).send({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || "0.0.0.0";

    await fastify.listen({ port, host });
    console.log(`Server running on http://${host}:${port}`);
    console.log("Available endpoints:");
    console.log("  GET  /health - Health check");
    console.log("  POST /webhook/notion - Notion webhook handler");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
