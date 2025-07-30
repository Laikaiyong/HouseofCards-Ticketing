const { Client } = require("@notionhq/client");

class NotionService {
  constructor() {
    this.notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });
    this.databaseId = process.env.NOTION_DATABASE_ID;
  }

  async getPageDetails(pageId) {
    try {
      const response = await this.notion.pages.retrieve({
        page_id: pageId,
      });

      return this.extractTicketData(response);
    } catch (error) {
      console.error("Error fetching page details:", error);
      throw error;
    }
  }

  extractTicketData(page) {
    const properties = page.properties;

    // Extract relevant data - adjust property names based on your Notion database schema
    const ticketData = {
      id: page.id,
      status: this.getPropertyValue(properties.Status),
      requestType: this.getPropertyValue(properties["Request Type"]),
      date: this.getPropertyValue(properties["Due Date"]),
      title: this.getPropertyValue(properties["Ticket ID"]),
    };

    // Use current date if no date is specified
    if (!ticketData.date) {
      ticketData.date = new Date().toISOString();
    }

    return ticketData;
  }

  getPropertyValue(property) {
    if (!property) return null;

    switch (property.type) {
      case "title":
        return property.title?.[0]?.plain_text || null;
      case "rich_text":
        return property.rich_text?.[0]?.plain_text || null;
      case "select":
        return property.select?.name || null;
      case "multi_select":
        return (
          property.multi_select?.map((item) => item.name).join(", ") || null
        );
      case "date":
        return property.date?.start || null;
      case "number":
        return property.number;
      case "checkbox":
        return property.checkbox;
      case "url":
        return property.url;
      case "email":
        return property.email;
      case "phone_number":
        return property.phone_number;
      default:
        return null;
    }
  }

  async updatePageProperty(pageId, propertyName, value) {
    try {
      const updateData = {
        page_id: pageId,
        properties: {},
      };

      // Set the property based on type - this is a simple text/rich_text update
      updateData.properties[propertyName] = {
        rich_text: [
          {
            text: {
              content: value,
            },
          },
        ],
      };

      await this.notion.pages.update(updateData);
      console.log(`Updated page ${pageId} with ${propertyName}: ${value}`);
    } catch (error) {
      console.error("Error updating page property:", error);
      throw error;
    }
  }
}

module.exports = NotionService;
