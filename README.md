# Ticketing System Drive Automation

A Fastify-based automation system that creates Google Drive folder structures when Notion database tickets change status to "Active".

## Features

- **Notion Integration**: Listens for webhook events when ticket status changes
- **Google Drive Automation**: Creates organized folder structure based on ticket data
- **Dynamic Numbering**: Automatically assigns sequential numbers to tickets of the same type
- **Folder Structure**: `Year > Quarter > 00_[Request Type]`

## Folder Structure Created

```
Parent Folder/
├── 2024/
│   ├── Q1/
│   │   ├── 01_Bug Report
│   │   ├── 02_Feature Request
│   │   └── 03_Bug Report
│   ├── Q2/
│   │   ├── 01_Support Request
│   │   └── 02_Bug Report
│   └── ...
└── 2025/
    └── ...
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Fill in your environment variables:

```env
# Notion Configuration
NOTION_API_KEY=secret_your_notion_integration_token
NOTION_DATABASE_ID=your_database_id

# Google Drive Configuration
GOOGLE_SERVICE_ACCOUNT_CREDS={"type":"service_account","project_id":"your-project",...}
GOOGLE_DRIVE_PARENT_FOLDER_ID=your_parent_folder_id

# Server Configuration
PORT=3000
WEBHOOK_SECRET=your_webhook_secret
```

### 3. Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Drive API
4. Create a Service Account
5. Generate and download the JSON key file
6. Copy the entire JSON content to `GOOGLE_SERVICE_ACCOUNT_CREDS` in your `.env`
7. Share your Google Drive parent folder with the service account email

### 4. Notion Integration Setup

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Copy the Internal Integration Token to `NOTION_API_KEY`
4. Share your database with the integration
5. Copy the database ID from the URL to `NOTION_DATABASE_ID`

### 5. Database Schema Requirements

Your Notion database should have these properties (adjust names in code if different):
- **Status** (Select): Must include "Active" option
- **Request Type** (Select/Text): Type of request (e.g., "Bug Report", "Feature Request")
- **Date** (Date): Date for folder organization (optional, uses current date if not provided)

## Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## API Endpoints

### Health Check
```
GET /health
```

### Notion Webhook Handler
```
POST /webhook/notion
```
Configure this URL in your Notion integration webhook settings.

### Manual Testing
```
POST /trigger/status-change
Content-Type: application/json

{
  "pageId": "notion-page-id",
  "status": "Active"
}
```

### Create Folder Structure
```
POST /create/folder
Content-Type: application/json

{
  "requestType": "Bug Report",
  "date": "2024-03-15"  // optional, uses current date if not provided
}
```

### Bulk Create Folder Structures
```
POST /create/folders/bulk
Content-Type: application/json

{
  "tickets": [
    {
      "requestType": "Bug Report",
      "date": "2024-01-15"
    },
    {
      "requestType": "Feature Request",
      "date": "2024-02-20"
    }
  ]
}
```

### Test Connections
```
GET /test/drive
GET /test/notion/:pageId
```

## Webhook Setup in Notion

1. Go to your Notion integration settings
2. Add webhook URL: `https://your-domain.com/webhook/notion`
3. Subscribe to "Page property values updated" events
4. Select your database

## Troubleshooting

### Common Issues

1. **Google Drive Permission Error**
   - Ensure service account email has access to parent folder
   - Check if Google Drive API is enabled

2. **Notion API Error**
   - Verify integration token is correct
   - Ensure database is shared with integration
   - Check database ID format

3. **Property Not Found**
   - Adjust property names in `notionService.js` to match your database schema
   - Check property types match expected format

### Debugging

Enable detailed logging by checking server logs:
```bash
npm run dev
```

Test individual components:
```bash
# Test Google Drive
curl http://localhost:3000/test/drive

# Test Notion (replace with actual page ID)
curl http://localhost:3000/test/notion/your-page-id

# Manual trigger
curl -X POST http://localhost:3000/trigger/status-change \
  -H "Content-Type: application/json" \
  -d '{"pageId":"your-page-id","status":"Active"}'
```

## Customization

### Modify Folder Structure
Edit `googleDriveService.js` to change folder naming or structure.

### Add More Trigger Conditions
Modify `ticketAutomationService.js` to handle different status changes or conditions.

### Custom Properties
Update `notionService.js` to extract additional properties from your Notion database.

## Security Notes

- Keep your `.env` file secure and never commit it to version control
- Use HTTPS in production
- Consider implementing webhook signature verification
- Regularly rotate service account keys
