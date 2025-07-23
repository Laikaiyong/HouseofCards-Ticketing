# API Request Examples

## Create Single Folder Structure

### Basic Request
```bash
curl -X POST http://localhost:3000/create/folder \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "Bug Report"
  }'
```

### With Specific Date
```bash
curl -X POST http://localhost:3000/create/folder \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "Feature Request",
    "date": "2024-03-15"
  }'
```

### With Full ISO Date
```bash
curl -X POST http://localhost:3000/create/folder \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "Support Request",
    "date": "2024-06-20T10:30:00.000Z"
  }'
```

## Bulk Create Folder Structures

### Multiple Tickets
```bash
curl -X POST http://localhost:3000/create/folders/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "tickets": [
      {
        "requestType": "Bug Report",
        "date": "2024-01-15"
      },
      {
        "requestType": "Feature Request",
        "date": "2024-01-20"
      },
      {
        "requestType": "Bug Report",
        "date": "2024-02-10"
      },
      {
        "requestType": "Support Request",
        "date": "2024-03-05"
      }
    ]
  }'
```

### Mixed Quarters and Years
```bash
curl -X POST http://localhost:3000/create/folders/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "tickets": [
      {
        "requestType": "Bug Report",
        "date": "2023-12-15"
      },
      {
        "requestType": "Feature Request",
        "date": "2024-01-20"
      },
      {
        "requestType": "Bug Report",
        "date": "2024-04-10"
      },
      {
        "requestType": "Enhancement",
        "date": "2024-07-05"
      },
      {
        "requestType": "Bug Report",
        "date": "2024-10-15"
      }
    ]
  }'
```

## Expected Response Format

### Single Folder Creation Success
```json
{
  "success": true,
  "message": "Folder structure created successfully",
  "data": {
    "folderPath": "2024/Q1/01_Bug Report",
    "ticketFolderName": "01_Bug Report",
    "ticketFolderId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "year": 2024,
    "quarter": 1,
    "requestType": "Bug Report",
    "createdAt": "2024-03-15T10:30:00.000Z"
  }
}
```

### Bulk Creation Success
```json
{
  "success": true,
  "message": "Processed 4 tickets. 4 successful, 0 failed.",
  "data": {
    "successful": [
      {
        "index": 0,
        "ticket": {
          "requestType": "Bug Report",
          "date": "2024-01-15"
        },
        "result": {
          "folderPath": "2024/Q1/01_Bug Report",
          "ticketFolderName": "01_Bug Report",
          "ticketFolderId": "folder-id-1"
        }
      }
    ],
    "failed": [],
    "summary": {
      "total": 4,
      "successful": 4,
      "failed": 0
    }
  }
}
```

## Testing Scenarios

### Test Dynamic Numbering
Create multiple tickets of the same type in the same quarter:

```bash
# First Bug Report in Q1 2024 - should be 01_Bug Report
curl -X POST http://localhost:3000/create/folder \
  -H "Content-Type: application/json" \
  -d '{"requestType": "Bug Report", "date": "2024-01-15"}'

# Second Bug Report in Q1 2024 - should be 02_Bug Report
curl -X POST http://localhost:3000/create/folder \
  -H "Content-Type: application/json" \
  -d '{"requestType": "Bug Report", "date": "2024-02-20"}'

# Feature Request in Q1 2024 - should be 01_Feature Request
curl -X POST http://localhost:3000/create/folder \
  -H "Content-Type: application/json" \
  -d '{"requestType": "Feature Request", "date": "2024-03-10"}'
```

### Test Quarter Boundaries
```bash
# Q1 (Jan-Mar)
curl -X POST http://localhost:3000/create/folder \
  -H "Content-Type: application/json" \
  -d '{"requestType": "Bug Report", "date": "2024-03-31"}'

# Q2 (Apr-Jun) - numbering should reset
curl -X POST http://localhost:3000/create/folder \
  -H "Content-Type: application/json" \
  -d '{"requestType": "Bug Report", "date": "2024-04-01"}'
```

### Test Error Handling
```bash
# Missing requestType
curl -X POST http://localhost:3000/create/folder \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15"}'

# Invalid date
curl -X POST http://localhost:3000/create/folder \
  -H "Content-Type: application/json" \
  -d '{"requestType": "Bug Report", "date": "invalid-date"}'
```
