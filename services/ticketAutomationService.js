const NotionService = require('./notionService');
const GoogleDriveService = require('./googleDriveService');

class TicketAutomationService {
  constructor() {
    this.notionService = new NotionService();
    this.googleDriveService = new GoogleDriveService();
  }

  async processStatusChange(pageId, newStatus) {
    try {
      console.log(`Processing status change for page ${pageId} to ${newStatus}`);

      // Only process if status changed to "Active"
      if (newStatus !== 'Active') {
        console.log(`Status ${newStatus} does not trigger automation. Skipping.`);
        return { success: true, message: 'Status change does not trigger automation' };
      }

      // Get ticket details from Notion
      const ticketData = await this.notionService.getPageDetails(pageId);
      console.log('Ticket data:', ticketData);

      // Validate required data
      if (!ticketData.requestType) {
        throw new Error('Request Type is required but not found in ticket data');
      }

      // Create Google Drive folder structure
      const folderResult = await this.googleDriveService.createTicketFolderStructure({
        date: ticketData.date,
        requestType: ticketData.requestType
      });

      console.log('Folder structure created:', folderResult);

      // Optionally update the Notion page with the folder path or link
      try {
        await this.notionService.updatePageProperty(
          pageId, 
          'Drive Folder', // Adjust property name as needed
          folderResult.folderPath
        );
      } catch (updateError) {
        console.warn('Could not update Notion page with folder path:', updateError.message);
        // Don't fail the entire process if we can't update the page
      }

      return {
        success: true,
        message: 'Ticket automation completed successfully',
        data: {
          ticketData,
          folderResult
        }
      };

    } catch (error) {
      console.error('Error in ticket automation:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  async processWebhookPayload(payload) {
    try {
      // Handle different types of Notion webhook events
      if (payload.object === 'page' && payload.type === 'page.property_values.updated') {
        const pageId = payload.page.id;
        
        // Check if status property was updated
        const statusProperty = payload.properties?.Status || payload.properties?.status;
        if (statusProperty) {
          const newStatus = this.extractStatusFromProperty(statusProperty);
          if (newStatus) {
            return await this.processStatusChange(pageId, newStatus);
          }
        }
      }

      return { success: true, message: 'Webhook processed but no action taken' };
    } catch (error) {
      console.error('Error processing webhook payload:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  extractStatusFromProperty(statusProperty) {
    if (statusProperty.type === 'select' && statusProperty.select) {
      return statusProperty.select.name;
    }
    return null;
  }
}

module.exports = TicketAutomationService;
