require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const TicketAutomationService = require('./services/ticketAutomationService');

// Register CORS plugin
fastify.register(require('@fastify/cors'), {
  origin: true
});

// Initialize services
const ticketAutomationService = new TicketAutomationService();

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Notion webhook endpoint
fastify.post('/webhook/notion', async (request, reply) => {
  try {
    const payload = request.body;
    
    // Log the incoming webhook for debugging
    fastify.log.info('Received Notion webhook:', JSON.stringify(payload, null, 2));

    // Process the webhook payload
    const result = await ticketAutomationService.processWebhookPayload(payload);
    
    if (result.success) {
      reply.code(200).send({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      reply.code(500).send({
        success: false,
        message: result.message,
        error: result.error?.message
      });
    }
  } catch (error) {
    fastify.log.error('Webhook processing error:', error);
    reply.code(500).send({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Manual trigger endpoint for testing
fastify.post('/trigger/status-change', async (request, reply) => {
  try {
    const { pageId, status } = request.body;
    
    if (!pageId || !status) {
      return reply.code(400).send({
        success: false,
        message: 'pageId and status are required'
      });
    }

    const result = await ticketAutomationService.processStatusChange(pageId, status);
    
    if (result.success) {
      reply.code(200).send(result);
    } else {
      reply.code(500).send(result);
    }
  } catch (error) {
    fastify.log.error('Manual trigger error:', error);
    reply.code(500).send({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Test Google Drive connection
fastify.get('/test/drive', async (request, reply) => {
  try {
    const GoogleDriveService = require('./services/googleDriveService');
    const driveService = new GoogleDriveService();
    
    // Test creating a simple folder structure
    const testResult = await driveService.createTicketFolderStructure({
      date: new Date().toISOString(),
      requestType: 'Test Request'
    });
    
    reply.send({
      success: true,
      message: 'Google Drive connection test successful',
      data: testResult
    });
  } catch (error) {
    fastify.log.error('Drive test error:', error);
    reply.code(500).send({
      success: false,
      message: 'Google Drive connection test failed',
      error: error.message
    });
  }
});

// Test Notion connection
fastify.get('/test/notion/:pageId', async (request, reply) => {
  try {
    const { pageId } = request.params;
    const NotionService = require('./services/notionService');
    const notionService = new NotionService();
    
    const pageData = await notionService.getPageDetails(pageId);
    
    reply.send({
      success: true,
      message: 'Notion connection test successful',
      data: pageData
    });
  } catch (error) {
    fastify.log.error('Notion test error:', error);
    reply.code(500).send({
      success: false,
      message: 'Notion connection test failed',
      error: error.message
    });
  }
});

// Create folder structure endpoint
fastify.post('/create/folder', async (request, reply) => {
  try {
    const { requestType, date } = request.body;
    
    // Validate required fields
    if (!requestType) {
      return reply.code(400).send({
        success: false,
        message: 'requestType is required'
      });
    }

    // Use provided date or current date
    const folderDate = date ? new Date(date) : new Date();
    
    // Validate date
    if (isNaN(folderDate.getTime())) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)'
      });
    }

    const GoogleDriveService = require('./services/googleDriveService');
    const driveService = new GoogleDriveService();
    
    // Create the folder structure
    const result = await driveService.createTicketFolderStructure({
      date: folderDate.toISOString(),
      requestType: requestType
    });
    
    reply.send({
      success: true,
      message: 'Folder structure created successfully',
      data: {
        folderPath: result.folderPath,
        ticketFolderName: result.ticketFolderName,
        ticketFolderId: result.ticketFolderId,
        year: folderDate.getFullYear(),
        quarter: Math.ceil((folderDate.getMonth() + 1) / 3),
        requestType: requestType,
        createdAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    fastify.log.error('Create folder error:', error);
    reply.code(500).send({
      success: false,
      message: 'Failed to create folder structure',
      error: error.message
    });
  }
});

// Bulk create folders endpoint
fastify.post('/create/folders/bulk', async (request, reply) => {
  try {
    const { tickets } = request.body;
    
    if (!Array.isArray(tickets) || tickets.length === 0) {
      return reply.code(400).send({
        success: false,
        message: 'tickets array is required and must not be empty'
      });
    }

    const GoogleDriveService = require('./services/googleDriveService');
    const driveService = new GoogleDriveService();
    
    const results = [];
    const errors = [];

    // Process each ticket
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      
      try {
        // Validate ticket data
        if (!ticket.requestType) {
          errors.push({
            index: i,
            ticket: ticket,
            error: 'requestType is required'
          });
          continue;
        }

        const folderDate = ticket.date ? new Date(ticket.date) : new Date();
        
        if (isNaN(folderDate.getTime())) {
          errors.push({
            index: i,
            ticket: ticket,
            error: 'Invalid date format'
          });
          continue;
        }

        // Create folder structure
        const result = await driveService.createTicketFolderStructure({
          date: folderDate.toISOString(),
          requestType: ticket.requestType
        });

        results.push({
          index: i,
          ticket: ticket,
          result: {
            folderPath: result.folderPath,
            ticketFolderName: result.ticketFolderName,
            ticketFolderId: result.ticketFolderId
          }
        });

      } catch (error) {
        errors.push({
          index: i,
          ticket: ticket,
          error: error.message
        });
      }
    }

    reply.send({
      success: errors.length === 0,
      message: `Processed ${tickets.length} tickets. ${results.length} successful, ${errors.length} failed.`,
      data: {
        successful: results,
        failed: errors,
        summary: {
          total: tickets.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });

  } catch (error) {
    fastify.log.error('Bulk create folders error:', error);
    reply.code(500).send({
      success: false,
      message: 'Failed to process bulk folder creation',
      error: error.message
    });
  }
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    console.log(`Server running on http://${host}:${port}`);
    console.log('Available endpoints:');
    console.log('  GET  /health - Health check');
    console.log('  POST /webhook/notion - Notion webhook handler');
    console.log('  POST /trigger/status-change - Manual trigger for testing');
    console.log('  POST /create/folder - Create single folder structure');
    console.log('  POST /create/folders/bulk - Create multiple folder structures');
    console.log('  GET  /test/drive - Test Google Drive connection');
    console.log('  GET  /test/notion/:pageId - Test Notion connection');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
