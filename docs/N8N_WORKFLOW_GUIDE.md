# n8n Workflow Setup Guide for Scheduler App

This guide walks you through setting up an n8n workflow to receive notifications when posts are successfully published or when they fail.

## Prerequisites

- An [n8n](https://n8n.io/) instance (self-hosted or cloud).
- Admin access to your Supabase project (to set secrets).

## Step 1: Create the Webhook Node

1.  Open your n8n editor and create a new workflow.
2.  Add a **Webhook** node.
3.  Configure the Webhook node:
    - **HTTP Method**: `POST`
    - **Path**: `scheduler-notifications` (or any path you prefer)
    - **Authentication**: `None` (or configure Header Auth if you want extra security, but start with None for testing).
    - **Response Mode**: `On Received`
4.  **Save the workflow** and activate it (or use "Listen for Test Event" while testing).
5.  Copy your **Production URL** (or Test URL for testing).
    - It should look like: `https://your-n8n-domain.com/webhook/scheduler-notifications`

## Step 2: Configure Supabase Secret

You need to tell the Scheduler App where to send these notifications.

1.  Open your terminal.
2.  Run the following command (replace the URL with your copied Webhook URL):

```bash
npx supabase secrets set N8N_WEBHOOK_URL="https://your-copied-webhook-url"
```

## Step 3: Handle the Data

The webhook will receive data in the following JSON format.

### Success Payload
When a post is published successfully:
```json
{
  "event": "post_published",
  "post": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "platform": "threads",
    "account_name": "Odd Omens",
    "content": {
      "text": "Hello world!",
      "mediaUrls": ["..."]
    },
    "scheduled_time": "2024-02-02T12:00:00.000Z"
  },
  "error": null,
  "timestamp": "2024-02-02T12:00:05.123Z"
}
```

### Failure Payload
When a post fails to publish:
```json
{
  "event": "post_failed",
  "post": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "platform": "threads",
    "account_name": "Odd Omens",
     "content": { ... } // May be present depending on where failure occurred
  },
  "error": "Detailed error message from the platform",
  "timestamp": "2024-02-02T12:00:05.123Z"
}
```

## Step 4: Add Routing Logic (The Switch Node)

1.  Add a **Switch** node connected to your Webhook.
2.  Configure it to route based on the `event` field.
    *   *Note: Your data seems to be nested in `body`, so we use `$json.body.event`*
    - **Rule 1**: Expression `{{ $json.body.event }}` Is Equal to `post_published`
    - **Rule 2**: Expression `{{ $json.body.event }}` Is Equal to `post_failed`

## Step 5: Configure WAHA (WhatsApp) Notifications

We will use the **HTTP Request** node in n8n to send WhatsApp messages via your WAHA instance.

### 1. Prerequisites
- You need your WAHA API URL (e.g., `https://your-waha-instance.com`).
- You need your session name (usually `default`).
- **Recipient chatId**:
    - **Personal**: `[CountryCode][PhoneNumber]@c.us` (e.g., `15551234567@c.us`)
    - **Group**: `[GroupId]@g.us` (e.g., `123456789-123456@g.us`). See "Sending to a Group" below to find this ID.

### 2. Configure Success Notification (Switch Output 0)
1.  **Rename Node**: Change the name of the top HTTP Request node to `WhatsApp (Success)`.
2.  **Method**: `POST`
3.  **URL**: `https://your-waha-url/api/sendText`
4.  **Add Header Parameter** (Under "Headers" or "Options"):
    - Name: `X-Api-Key`
    - Value: `your-waha-api-key`
5.  **Send Body**: Toggle `On`.
6.  **Body Content Type**: `JSON`.
7.  **Body Parameters**: Paste the following:

```json
{
  "chatId": "your-recipient-chat-id@c.us",
  "text": "✅ *Post Published!*\n\n*Account:* {{ $json.body.post.account_name }}\n*Platform:* {{ $json.body.post.platform }}\n\n*Content:*\n{{ $json.body.post.content.text.slice(0, 100) }}...",
  "session": "default"
}
```

### 3. Configure Failure Notification (Switch Output 1)
1.  **Rename Node**: Change the name of the bottom HTTP Request node to `WhatsApp (Failed)`.
2.  **Method**: `POST`
3.  **URL**: `https://your-waha-url/api/sendText`
4.  **Add Header Parameter**:
    - Name: `X-Api-Key`
    - Value: `your-waha-api-key`
5.  **Send Body**: Toggle `On`.
6.  **Body Content Type**: `JSON`.
7.  **Body Parameters**:

```json
{
  "chatId": "your-recipient-chat-id@c.us",
  "text": "❌ *Post Failed!*\n\n*Platform:* {{ $json.body.post.platform }}\n*Error:* {{ $json.body.error }}\n\nView in Dashboard: https://supabase.com/dashboard/project/_/editor/29484?filter=id%3Aeq%3A{{$json.body.post.id}}",
  "session": "default"
}
```

## Step 6: Sending to a Group (Optional)

If you prefer to send these notifications to a specific WhatsApp Group:

1.  **Create a Group** on your phone (add one person, then remove them if you want it to be just you).
2.  **Find the Group ID**:
    - Send a message to the group from your phone.
    - Use the WAHA API endpoint `GET /api/groups` in your Swaggger/API docs.
    - Look for your group name and copy the `id` (it looks like `123456789-1234@g.us`).
3.  **Update n8n**:
    - Replace the `chatId` in your JSON body with this Group ID.
    - That's it! Notifications will now land in that group.

## Step 6: Securing the Webhook (Recommended)

To prevent unauthorized users from triggering your webhook, you should enable Header Authentication.

### 1. Generate a Secret
Create a strong random string (e.g., using a password generator).

### 2. Add Secret to Supabase
Run the following command:

```bash
npx supabase secrets set N8N_WEBHOOK_SECRET="your-super-strong-secret-string"
```

The Scheduler App is pre-configured to look for this secret. If it exists, it will send a header `x-webhook-secret` with every request.

### 3. Configure n8n Webhook Node
1.  Open your **Webhook** node in n8n.
2.  Set **Authentication** to `Header Auth`.
3.  Click "Create New Credential" (or select existing).
4.  In the credential settings:
    - **Header Name**: `x-webhook-secret`
    - **Header Value**: `your-super-strong-secret-string` (must match the one in Supabase).
5.  Save the node.

Now, n8n will reject any request that doesn't contain the correct secret key.

## Step 7: Testing

1.  Click **Listen for Test Event** in your Webhook node.
2.  Go to your Scheduler App and click "Post Now" on a scheduled post, or wait for the scheduler to establish a connection.
3.  You should see the data appear in n8n.

## Troubleshooting

### WhatsApp Error: "Can't link new devices"
This comes from the WhatsApp app on your phone.
1.  **Device Limit Reached**: You can only have **4** linked devices. Go to **Settings > Linked Devices** on your phone and remove an old one (like "Google Chrome" or "Windows").
2.  **Connection**: Ensure your phone has good signal.
3.  **Refresh**: Reload the WAHA dashboard to get a new QR code (they expire quickly).

### WAHA Session Error (422)
If you see `Session status is not as expected`, it means the session isn't "Linked" yet. Scan the QR code as above to fix it.
