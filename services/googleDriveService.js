const { google } = require("googleapis");
const { JWT } = require("google-auth-library");

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
    this.initializeAuth();
  }

  async initializeAuth() {
    try {
      const credsRaw = process.env.GOOGLE_SERVICE_ACCOUNT_CREDS;
      if (!credsRaw) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_CREDS env var is missing");
      }
      const credentials = JSON.parse(credsRaw);
      if (!credentials.client_email) {
        throw new Error("Service account JSON missing client_email");
      }
      const auth = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ["https://www.googleapis.com/auth/drive"],
      });

      this.drive = google.drive({ version: "v3", auth });
      console.log(
        `[GoogleDriveService] Using service account: ${credentials.client_email}`
      );
      await this.listAllFiles();
    } catch (error) {
      console.error("Failed to initialize Google Drive auth:", error);
      throw error;
    }
  }

  async listAllFiles() {
    try {
      const res = await this.drive.files.list({
        q: "trashed=false",
        fields: "files(id, name, parents)",
        pageSize: 1000,
      });
      console.log(
        "[GoogleDriveService] All visible files:",
        res.data.files.filter(
          (item) =>
            Array.isArray(item.parents) &&
            item.parents[0] == process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID
        )
      );
      return res.data.files;
    } catch (error) {
      console.error("[GoogleDriveService] Error listing all files:", error);
      throw error;
    }
  }
  async findOrCreateFolder(name, parentId) {
    try {
      console.log(
        `[GoogleDriveService] Searching for folder "${name}" in parent "${parentId}"`
      );
      // Search for existing folder
      const searchResponse = await this.drive.files.list({
        q: `name='${name}' and parents in '${parentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, name)",
      });

      if (searchResponse.data.files.length > 0) {
        console.log(
          `[GoogleDriveService] Found existing folder "${name}" (${searchResponse.data.files[0].id})`
        );
        return searchResponse.data.files[0].id;
      }

      // Create new folder if not found
      console.log(
        `[GoogleDriveService] Creating folder "${name}" in parent "${parentId}"`
      );
      const createResponse = await this.drive.files.create({
        requestBody: {
          name: name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        },
        fields: "id",
      });

      console.log(
        `[GoogleDriveService] Created folder "${name}" (${createResponse.data.id})`
      );
      return createResponse.data.id;
    } catch (error) {
      if (
        error.errors &&
        error.errors[0] &&
        error.errors[0].reason === "notFound"
      ) {
        console.error(
          `[GoogleDriveService] Folder not found or no access. Make sure the parent folder (${parentId}) is shared with your service account email.`
        );
      }
      console.error(`Error finding/creating folder ${name}:`, error);
      throw error;
    }
  }

  async getNextTicketNumber(requestType, quarterFolderId) {
    try {
      // Search for existing tickets with the same request type
      const searchResponse = await this.drive.files.list({
        q: `parents in '${quarterFolderId}' and name contains '${requestType}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, name)",
      });

      const existingTickets = searchResponse.data.files;
      let maxNumber = 0;

      // Extract numbers from existing ticket folders
      existingTickets.forEach((ticket) => {
        const match = ticket.name.match(/^(\d+)_/);
        if (match) {
          const number = parseInt(match[1], 10);
          if (number > maxNumber) {
            maxNumber = number;
          }
        }
      });

      return String(maxNumber + 1).padStart(2, "0");
    } catch (error) {
      console.error("Error getting next ticket number:", error);
      throw error;
    }
  }

  getQuarter(date) {
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    return Math.ceil(month / 3);
  }

  async setFolderPermissions(folderId, role = 'reader', type = 'anyone') {
    try {
      console.log(`[GoogleDriveService] Setting permissions for folder ${folderId} to ${role} for ${type}`);
      
      const permission = {
        role: role,
        type: type,
      };

      const response = await this.drive.permissions.create({
        fileId: folderId,
        requestBody: permission,
      });

      console.log(`[GoogleDriveService] Successfully set permissions for folder ${folderId}`);
      return response.data;
    } catch (error) {
      console.error(`[GoogleDriveService] Error setting permissions for folder ${folderId}:`, error);
      throw error;
    }
  }

  async createTicketFolderStructureV2(ticketData) {
    try {
      const { date, requestType, title, ticketId } = ticketData;
      const ticketDate = new Date(date);
      const year = ticketDate.getFullYear().toString();
      const quarter = `Q${this.getQuarter(ticketDate)}`;

      // 1. Year folder
      const yearFolderId = await this.findOrCreateFolder(
        year,
        this.parentFolderId
      );

      // 2. Quarter folder
      const quarterFolderId = await this.findOrCreateFolder(
        quarter,
        yearFolderId
      );

      // 3. Ticket ID folder (from Notion)
      if (!title)
        throw new Error("ticketId is required for folder structure");
      const ticketIdFolderId = await this.findOrCreateFolder(
        title,
        quarterFolderId
      );

      // 4. Determine type (Video/Graphic)
      const isVideo = ["Green", "Blue"].includes(requestType);
      const typeFolderName = isVideo ? "Video" : "Graphic";
      const typeFolderId = await this.findOrCreateFolder(
        typeFolderName,
        ticketIdFolderId
      );

      // 5. Subfolders
      const graphicFolders = [
        "00_Pre Production",
        "01_Assets",
        "03_Project Files",
        "06_Output Files",
        "07_Delivery",
      ];
      const videoFolders = [
        "00_Pre Production",
        "01_Assets",
        "02_Audio",
        "03_Footage",
        "04_Project Files",
        "05_Output Files",
        "07_Delivery",
      ];
      const subfolders = isVideo ? videoFolders : graphicFolders;

      let deliveryFolderId = null;
      let deliveryFolderLink = null;
      for (const folderName of subfolders) {
        const subId = await this.findOrCreateFolder(folderName, typeFolderId);
        if (folderName === "07_Delivery") {
          deliveryFolderId = subId;
          // Set permissions for delivery folder to be accessible by anyone with the link
          await this.setFolderPermissions(subId, 'reader', 'anyone');
          deliveryFolderLink = `https://drive.google.com/drive/folders/${subId}`;
        }
      }

      return {
        yearFolderId,
        quarterFolderId,
        ticketIdFolderId,
        typeFolderId,
        folderPath: `${year}/${quarter}/${ticketId}/${typeFolderName}`,
        deliveryFolderId,
        deliveryFolderLink,
      };
    } catch (error) {
      console.error("Error creating ticket folder structure V2:", error);
      throw error;
    }
  }
}

module.exports = GoogleDriveService;
