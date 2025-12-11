<?php
/**
 * Redactix Image Handler - DEMO VERSION
 * 
 * This is a demo version that doesn't actually upload images.
 * Instead, it always returns the default image (uploads/default.jpg).
 * 
 * Perfect for testing and demonstrations without cluttering your uploads folder.
 * Browse and delete functions work with real files in the uploads directory.
 * 
 * Actions:
 * - POST with 'image' file: Returns default.jpg (no real upload)
 * - GET with action=browse: Lists all images in upload directory
 * - POST with action=delete&file=filename: Delete image (if enabled)
 */

// ============================================
// CONFIGURATION
// ============================================

// Upload directory
$uploadDir = __DIR__ . '/uploads/';

// URL prefix for uploaded files
$uploadUrlPrefix = '/uploads/';

// Default image to return on "upload"
$defaultImage = 'default.jpg';

// Enable delete functionality (set to true to allow deleting images)
$allowDelete = false;

// ============================================
// HEADERS
// ============================================
header('Content-Type: application/json; charset=utf-8');

// Handle preflight requests (for CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Send JSON response and exit
 */
function sendResponse($success, $data = []) {
    echo json_encode(array_merge(['success' => $success], $data), JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Send error response with message
 */
function sendError($message) {
    sendResponse(false, ['error' => $message]);
}

/**
 * Get human-readable file size
 */
function formatFileSize($bytes) {
    if ($bytes >= 1048576) {
        return round($bytes / 1048576, 1) . ' MB';
    } elseif ($bytes >= 1024) {
        return round($bytes / 1024, 1) . ' KB';
    }
    return $bytes . ' B';
}

/**
 * Check if file is an image based on extension
 */
function isImageExtension($extension) {
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif', 'svg'];
    return in_array(strtolower($extension), $allowedExtensions);
}

/**
 * Get file extension from filename
 */
function getExtension($filename) {
    return strtolower(pathinfo($filename, PATHINFO_EXTENSION));
}

// ============================================
// ROUTING
// ============================================

$action = $_GET['action'] ?? ($_POST['action'] ?? null);

// Handle browse request
if ($action === 'browse') {
    handleBrowse();
}

// Handle delete request
if ($action === 'delete') {
    handleDelete();
}

// Handle upload (POST without specific action, or with action=upload)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === null || $action === 'upload')) {
    handleUpload();
}

// If nothing matched
sendError('Invalid request');

// ============================================
// BROWSE HANDLER
// ============================================
function handleBrowse() {
    global $uploadDir, $uploadUrlPrefix, $allowDelete;
    
    // Check if directory exists
    if (!is_dir($uploadDir)) {
        sendResponse(true, [
            'images' => [],
            'allowDelete' => $allowDelete
        ]);
    }
    
    $images = [];
    $files = scandir($uploadDir, SCANDIR_SORT_DESCENDING);
    
    foreach ($files as $file) {
        // Skip . and ..
        if ($file === '.' || $file === '..') continue;
        
        $filepath = $uploadDir . $file;
        
        // Skip directories
        if (is_dir($filepath)) continue;
        
        // Check if it's an image
        $extension = getExtension($file);
        if (!isImageExtension($extension)) continue;
        
        // Get file info
        $filesize = filesize($filepath);
        $modified = filemtime($filepath);
        
        $imageData = [
            'src' => $uploadUrlPrefix . $file,
            'filename' => $file,
            'size' => formatFileSize($filesize),
            'sizeBytes' => $filesize,
            'modified' => $modified,
            'srcset' => '',
            'alt' => '',
            'title' => ''
        ];
        
        $images[] = $imageData;
    }
    
    // Sort by modification time (newest first)
    usort($images, function($a, $b) {
        return $b['modified'] - $a['modified'];
    });
    
    sendResponse(true, [
        'images' => $images,
        'allowDelete' => $allowDelete
    ]);
}

// ============================================
// DELETE HANDLER
// ============================================
function handleDelete() {
    global $uploadDir, $allowDelete, $defaultImage;
    
    // Check if delete is enabled
    if (!$allowDelete) {
        sendError('Delete functionality is disabled');
    }
    
    // Only POST allowed for delete
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendError('Method not allowed');
    }
    
    // Get filename from request
    $file = $_POST['file'] ?? $_GET['file'] ?? null;
    
    if (!$file) {
        sendError('No file specified');
    }
    
    // Security: prevent directory traversal
    $file = basename($file);
    
    // Prevent deleting the default image
    if ($file === $defaultImage) {
        sendError('Cannot delete default image');
    }
    
    // Check extension
    $extension = getExtension($file);
    if (!isImageExtension($extension)) {
        sendError('Invalid file type');
    }
    
    $filepath = $uploadDir . $file;
    
    // Check if file exists
    if (!file_exists($filepath)) {
        sendError('File not found');
    }
    
    // Delete file
    if (!@unlink($filepath)) {
        sendError('Failed to delete file');
    }
    
    sendResponse(true, ['message' => 'File deleted successfully']);
}

// ============================================
// UPLOAD HANDLER (DEMO VERSION)
// ============================================
function handleUpload() {
    global $uploadDir, $uploadUrlPrefix, $defaultImage;
    
    // Check if file exists
    if (!isset($_FILES['image']) || $_FILES['image']['error'] === UPLOAD_ERR_NO_FILE) {
        sendError('No file uploaded');
    }
    
    $file = $_FILES['image'];
    
    // Handle upload errors
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errors = [
            UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit (php.ini)',
            UPLOAD_ERR_FORM_SIZE  => 'File exceeds form size limit',
            UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Server error: missing temp folder',
            UPLOAD_ERR_CANT_WRITE => 'Server error: cannot write to disk',
            UPLOAD_ERR_EXTENSION  => 'Upload blocked by server extension'
        ];
        sendError($errors[$file['error']] ?? 'Upload failed (error code: ' . $file['error'] . ')');
    }
    
    // Check if file is not empty
    if ($file['size'] === 0) {
        sendError('File is empty');
    }
    
    // Check if default image exists
    $defaultPath = $uploadDir . $defaultImage;
    if (!file_exists($defaultPath)) {
        sendError('Default image not found. Please create uploads/default.jpg');
    }
    
    // Simulate upload delay (optional, makes it feel more realistic)
    usleep(300000); // 0.3 seconds
    
    // DEMO MODE: Always return the default image
    // In real version, the file would be saved here
    
    sendResponse(true, [
        'src'     => $uploadUrlPrefix . $defaultImage,
        'srcset'  => '',
        'alt'     => '',
        'title'   => '',
        'caption' => ''
    ]);
}
