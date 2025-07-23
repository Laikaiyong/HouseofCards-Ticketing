const { google } = require('googleapis');

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
    this.initializeAuth();
  }

  initializeAuth() {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDS);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive']
      });
      
      this.drive = google.drive({ version: 'v3', auth });
    } catch (error) {
      console.error('Failed to initialize Google Drive auth:', error);
      throw error;
    }
  }

  async findOrCreateFolder(name, parentId) {
    try {
      // Search for existing folder
      const searchResponse = await this.drive.files.list({
        q: `name='${name}' and parents in '${parentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)'
      });

      if (searchResponse.data.files.length > 0) {
        return searchResponse.data.files[0].id;
      }

      // Create new folder if not found
      const createResponse = await this.drive.files.create({
        requestBody: {
          name: name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        },
        fields: 'id'
      });

      return createResponse.data.id;
    } catch (error) {
      console.error(`Error finding/creating folder ${name}:`, error);
      throw error;
    }
  }

  async getNextTicketNumber(requestType, quarterFolderId) {
    try {
      // Search for existing tickets with the same request type
      const searchResponse = await this.drive.files.list({
        q: `parents in '${quarterFolderId}' and name contains '${requestType}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)'
      });

      const existingTickets = searchResponse.data.files;
      let maxNumber = 0;

      // Extract numbers from existing ticket folders
      existingTickets.forEach(ticket => {
        const match = ticket.name.match(/^(\d+)_/);
        if (match) {
          const number = parseInt(match[1], 10);
          if (number > maxNumber) {
            maxNumber = number;
          }
        }
      });

      return String(maxNumber + 1).padStart(2, '0');
    } catch (error) {
      console.error('Error getting next ticket number:', error);
      throw error;
    }
  }

  getQuarter(date) {
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    return Math.ceil(month / 3);
  }

  async createTicketFolderStructure(ticketData) {
    try {
      const { date, requestType } = ticketData;
      const ticketDate = new Date(date);
      const year = ticketDate.getFullYear().toString();
      const quarter = `Q${this.getQuarter(ticketDate)}`;

      console.log(`Creating folder structure for: ${year}/${quarter}/${requestType}`);

      // Create/find year folder
      const yearFolderId = await this.findOrCreateFolder(year, this.parentFolderId);
      console.log(`Year folder ID: ${yearFolderId}`);

      // Create/find quarter folder
      const quarterFolderId = await this.findOrCreateFolder(quarter, yearFolderId);
      console.log(`Quarter folder ID: ${quarterFolderId}`);

      // Get next ticket number for this request type
      const ticketNumber = await this.getNextTicketNumber(requestType, quarterFolderId);
      
      // Create ticket folder with format: 00_[Request Type]
      const ticketFolderName = `${ticketNumber}_${requestType}`;
      const ticketFolderId = await this.findOrCreateFolder(ticketFolderName, quarterFolderId);
      
      console.log(`Created ticket folder: ${ticketFolderName} (ID: ${ticketFolderId})`);

      return {
        yearFolderId,
        quarterFolderId,
        ticketFolderId,
        ticketFolderName,
        folderPath: `${year}/${quarter}/${ticketFolderName}`
      };
    } catch (error) {
      console.error('Error creating ticket folder structure:', error);
      throw error;
    }
  }
}

module.exports = GoogleDriveService;
