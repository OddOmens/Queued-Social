# Media Library Feature

A comprehensive media management system for viewing, uploading, and deleting images stored in Cloudflare R2 and Supabase Storage.

## Features

### 📸 View All Media
- Grid view of all uploaded images and media files
- Visual preview thumbnails for images
- File metadata display (size, upload date, storage provider)
- Automatic signed URL generation for secure access
- Support for both R2 and Supabase Storage files

### ⬆️ Upload Media
- Drag-and-drop or click to upload
- Multiple file upload support
- Automatic image compression (max 1920px, 0.8 quality)
- Progress indicators during upload
- Automatic R2 upload with Supabase Storage fallback

### 🗑️ Delete Media
- One-click deletion with confirmation
- Hover overlay for delete button
- Removes files from both storage and database
- Visual feedback during deletion
- Automatic UI update after deletion

## User Interface

### Layout
- **Header**: Title, description, and upload button
- **Grid View**: Responsive grid (1-4 columns based on screen size)
- **Empty State**: Helpful message when no media exists
- **Error Handling**: Clear error messages with retry options

### Card Design
Each media card displays:
- Image preview (or placeholder for non-images)
- Original filename
- File size (formatted: B, KB, MB)
- Storage provider badge (R2 or Supabase)
- Upload timestamp
- Delete button (on hover)

### Visual Feedback
- Loading spinners during operations
- Hover effects on cards
- Delete button overlay with smooth transitions
- Provider badges with color coding:
  - **Blue**: R2 Storage
  - **Purple**: Supabase Storage

## Technical Implementation

### Frontend Components

**MediaLibraryPage.tsx**
- Main page component with state management
- Handles media loading, uploading, and deletion
- Manages preview URL generation
- Responsive grid layout

### Backend Services

**storage.ts**
- `getMediaLibrary(userId, limit)` - Fetch user's media files
- `uploadMedia(file, userId)` - Upload with compression and R2 fallback
- `deleteMedia(fileId, filePath)` - Delete from storage and database
- `getSignedUrl(path)` - Generate secure access URLs

**upload-media Edge Function**
- `action: 'upload'` - Generate presigned upload URL
- `action: 'get'` - Generate presigned download URL
- `action: 'delete'` - Delete object from R2

### Database Schema

**media_files table**
```sql
{
  id: uuid (primary key)
  user_id: uuid (foreign key)
  filename: string
  original_filename: string
  file_path: string
  file_size: number
  mime_type: string
  storage_bucket: string
  metadata: jsonb
  created_at: timestamp
}
```

## Usage

### Accessing Media Library
1. Navigate to the sidebar
2. Click on **Media Library** (between Templates and Analytics)
3. View all your uploaded media files

### Uploading Files
1. Click the **Upload Media** button
2. Select one or more image/video files
3. Wait for upload completion
4. Files appear automatically in the grid

### Deleting Files
1. Hover over any media card
2. Click the **Delete** button that appears
3. Confirm the deletion
4. File is removed from storage and UI

## File Processing

### Image Compression
All uploaded images are automatically compressed:
- **Max Dimension**: 1920px (maintains aspect ratio)
- **Quality**: 0.8 (JPEG)
- **Format**: Converted to JPEG
- **Benefit**: Reduces storage costs and improves load times

### Storage Priority
1. **Primary**: Cloudflare R2 (cost-effective, scalable)
2. **Fallback**: Supabase Storage (legacy support)

## Error Handling

The system handles various error scenarios:
- Network failures during upload/delete
- Storage quota exceeded
- Invalid file types
- Missing permissions
- R2 service unavailability

All errors are displayed to users with clear, actionable messages.

## Performance Optimizations

- **Lazy Loading**: Preview URLs loaded on-demand
- **Batch Operations**: Multiple files uploaded in sequence
- **Caching**: Signed URLs cached in component state
- **Compression**: Reduces file sizes before upload
- **Pagination**: Limits initial load to 100 files

## Security

- **Authentication**: All operations require valid user session
- **Authorization**: Users can only access their own media
- **Signed URLs**: Temporary, expiring access URLs (24 hours)
- **CORS**: Proper headers for cross-origin requests
- **Input Validation**: File type and size validation

## Future Enhancements

Potential improvements:
- [ ] Bulk delete functionality
- [ ] Search and filter capabilities
- [ ] Folder organization
- [ ] Image editing tools
- [ ] Video preview support
- [ ] Usage analytics
- [ ] Storage quota display
- [ ] Drag-and-drop reordering
- [ ] Share/copy URL functionality
- [ ] Advanced metadata editing

## Troubleshooting

### Images not loading
- Check R2 credentials in Supabase Edge Function secrets
- Verify signed URL generation in browser console
- Ensure CORS is properly configured

### Upload failures
- Check file size limits
- Verify R2 bucket permissions
- Check network connectivity
- Review browser console for errors

### Delete not working
- Ensure edge function is deployed with delete action
- Check database permissions
- Verify R2 delete permissions

## Related Files

- `/src/pages/MediaLibraryPage.tsx` - Main UI component
- `/src/services/storage.ts` - Storage service functions
- `/supabase/functions/upload-media/index.ts` - Edge function
- `/src/components/Layout.tsx` - Navigation integration
- `/src/App.tsx` - Route configuration
