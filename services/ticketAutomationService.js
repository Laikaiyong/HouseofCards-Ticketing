const NotionService = require("./notionService");
const GoogleDriveService = require("./googleDriveService");

class TicketAutomationService {
  constructor() {
    this.notionService = new NotionService();
    this.googleDriveService = new GoogleDriveService();
  }

  async processStatusChange(pageId, newStatus) {
    try {
      console.log(
        `Processing status change for page ${pageId} to ${newStatus}`
      );

      if (newStatus !== "Active") {
        return {
          success: true,
          message: "Status change does not trigger automation",
        };
      }

      // Get ticket details from Notion
      const ticketData = await this.notionService.getPageDetails(pageId);

      // Validate required data
      if (!ticketData.requestType) throw new Error("Request Type is required");
      if (!ticketData.id) throw new Error("Ticket ID is required");

      // Use new folder structure
      const folderResult =
        await this.googleDriveService.createTicketFolderStructureV2({
          date: ticketData.date,
          requestType: ticketData.requestType,
          ticketId: ticketData.id,
        });

      // Update Notion with the 07_Delivery folder link
      try {
        await this.notionService.updatePageProperty(
          pageId,
          "Drive Delivery Folder", // Adjust property name as needed
          folderResult.deliveryFolderLink
        );
      } catch (updateError) {
        console.warn(
          "Could not update Notion page with delivery folder link:",
          updateError.message
        );
      }

      return {
        success: true,
        message: "Ticket automation completed successfully",
        data: {
          ticketData,
          folderResult,
        },
      };
    } catch (error) {
      console.error("Error in ticket automation:", error);
      return {
        success: false,
        message: error.message,
        error: error,
      };
    }
  }

  async processWebhookPayload(payload) {
    try {
      // Handle different types of Notion webhook events
      if (
        payload.object === "page" &&
        payload.type === "page.property_values.updated"
      ) {
        const pageId = payload.page.id;

        // Check if status property was updated
        const statusProperty =
          payload.properties?.Status || payload.properties?.status;
        if (statusProperty) {
          const newStatus = this.extractStatusFromProperty(statusProperty);
          if (newStatus) {
            return await this.processStatusChange(pageId, newStatus);
          }
        }
      }

      return {
        success: true,
        message: "Webhook processed but no action taken",
      };
    } catch (error) {
      console.error("Error processing webhook payload:", error);
      return {
        success: false,
        message: error.message,
        error: error,
      };
    }
  }

  extractStatusFromProperty(statusProperty) {
    if (statusProperty.type === "select" && statusProperty.select) {
      return statusProperty.select.name;
    }
    return null;
  }
}

module.exports = TicketAutomationService;
