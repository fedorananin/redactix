<?php
/**
 * Redactix Media Handler
 *
 * Unified script for image AND video upload, browse, and delete operations.
 * Video upload is OFF by default — flip $allowVideoUpload to true and pass
 * `videoUploadUrl: '/redactix_images.php'` (and optionally `videoBrowseUrl`)
 * in the editor config.
 *
 * Actions:
 * - POST with 'image' file: Upload new image
 * - POST with 'video' file: Upload new video (if $allowVideoUpload = true)
 * - POST with action=browse[&type=image|video]: List uploaded files
 * - POST with action=delete&file=filename[&type=image|video]: Delete file (if enabled)
 *
 * Customize security measures according to your project needs:
 * - Add authentication (session check, JWT, etc.)
 * - Add CSRF protection
 * - Configure allowed origins
 * - Add rate limiting
 */

// ============================================
// CONFIGURATION
// ============================================

// Upload directory (relative to this script or absolute path)
$uploadDir = __DIR__ . '/uploads/';

// URL prefix for uploaded files (how they'll be accessed via web)
$uploadUrlPrefix = '/uploads/';

// Maximum file size in bytes (5MB)
$maxFileSize = 5 * 1024 * 1024;

// Allowed MIME types
$allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/heic',
    'image/heif',
    'image/svg+xml'
];

// Allowed extensions
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif', 'svg'];

// Enable delete functionality (set to true to allow deleting images)
$allowDelete = false;

// ---- VIDEO UPLOAD (off by default) ---------------------------------
// Flip to true to accept native HTML5 video uploads from the editor's
// /video command. Then pass the same script URL as `videoUploadUrl`
// (and optionally `videoBrowseUrl`) in the Redactix constructor.
$allowVideoUpload = false;

// Maximum video size in bytes (50MB by default — bump up if needed,
// and remember to lift `upload_max_filesize` / `post_max_size` in php.ini).
$maxVideoSize = 50 * 1024 * 1024;

// Allowed video MIME types
$allowedVideoMimeTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime'
];

// Allowed video extensions
$allowedVideoExtensions = ['mp4', 'webm', 'ogg', 'ogv', 'mov'];

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
 * Generate random filename
 */
function generateFilename($extension) {
    return bin2hex(random_bytes(16)) . '.' . $extension;
}

/**
 * Get file extension from filename
 */
function getExtension($filename) {
    return strtolower(pathinfo($filename, PATHINFO_EXTENSION));
}

/**
 * Validate that file is a real image
 */
function isValidImage($filepath, $mimeType) {
    // SVG - check for valid XML
    if ($mimeType === 'image/svg+xml') {
        libxml_use_internal_errors(true);
        $xml = simplexml_load_string(file_get_contents($filepath));
        libxml_clear_errors();
        return $xml !== false;
    }
    
    // HEIC/HEIF - getimagesize doesn't support them, skip deep validation
    if (in_array($mimeType, ['image/heic', 'image/heif'])) {
        return true; // Trust MIME type validation
    }
    
    // Raster images - check with getimagesize
    return @getimagesize($filepath) !== false;
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
    global $allowedExtensions;
    return in_array(strtolower($extension), $allowedExtensions);
}

/**
 * Check if file is a video based on extension
 */
function isVideoExtension($extension) {
    global $allowedVideoExtensions;
    return in_array(strtolower($extension), $allowedVideoExtensions);
}

// ============================================
// ROUTING
// ============================================

$action = $_GET['action'] ?? ($_POST['action'] ?? null);
$type = $_GET['type'] ?? ($_POST['type'] ?? 'image'); // 'image' (default) or 'video'

// Handle browse request
if ($action === 'browse') {
    if ($type === 'video') {
        handleVideoBrowse();
    } else {
        handleBrowse();
    }
}

// Handle delete request
if ($action === 'delete') {
    if ($type === 'video') {
        handleVideoDelete();
    } else {
        handleDelete();
    }
}

// Handle upload (POST without specific action, or with action=upload).
// Video upload is detected by the 'video' file field; image upload by
// the 'image' field — so the JS clients don't need a `type=` switch.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === null || $action === 'upload')) {
    if (isset($_FILES['video'])) {
        handleVideoUpload();
    } else {
        handleUpload();
    }
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
            'modified' => $modified
        ];
        
        // Optional fields - can be customized
        // You could store metadata in a separate JSON file or database
        // For now, we just provide empty optional fields
        $imageData['srcset'] = '';
        $imageData['alt'] = '';
        $imageData['title'] = '';
        
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
    global $uploadDir, $allowDelete;
    
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
// UPLOAD HANDLER
// ============================================
function handleUpload() {
    global $uploadDir, $uploadUrlPrefix, $maxFileSize, $allowedMimeTypes, $allowedExtensions;
    
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
    
    // Check file size
    if ($file['size'] === 0) {
        sendError('File is empty');
    }
    
    if ($file['size'] > $maxFileSize) {
        $maxMB = round($maxFileSize / 1024 / 1024);
        sendError("File too large (max {$maxMB}MB)");
    }
    
    // Check MIME type
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    
    if (!in_array($mimeType, $allowedMimeTypes)) {
        sendError('Invalid file type. Allowed: ' . implode(', ', $allowedExtensions));
    }
    
    // Check extension
    $extension = getExtension($file['name']);
    if (!in_array($extension, $allowedExtensions)) {
        sendError('Invalid file extension');
    }
    
    // Validate image content
    if (!isValidImage($file['tmp_name'], $mimeType)) {
        sendError('File is not a valid image');
    }
    
    // Create upload directory
    if (!is_dir($uploadDir)) {
        if (!@mkdir($uploadDir, 0755, true)) {
            sendError('Server error: cannot create upload directory');
        }
    }
    
    // Check if directory is writable
    if (!is_writable($uploadDir)) {
        sendError('Server error: upload directory is not writable');
    }
    
    // Map MIME to extension
    $mimeToExt = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'image/avif' => 'avif',
        'image/heic' => 'heic',
        'image/heif' => 'heif',
        'image/svg+xml' => 'svg'
    ];
    $ext = $mimeToExt[$mimeType] ?? $extension;
    
    // Generate filename and move file
    $filename = generateFilename($ext);
    $destination = $uploadDir . $filename;
    
    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        sendError('Server error: failed to save file');
    }
    
    // Success response
    sendResponse(true, [
        'src'     => $uploadUrlPrefix . $filename,
        'srcset'  => '',  // Customize as needed
        'alt'     => '',  // Customize as needed
        'title'   => '',  // Customize as needed
        'caption' => ''   // Customize as needed
    ]);
}

// ============================================
// VIDEO BROWSE HANDLER
// ============================================
function handleVideoBrowse() {
    global $uploadDir, $uploadUrlPrefix, $allowVideoUpload, $allowDelete;

    if (!$allowVideoUpload) {
        sendResponse(true, ['videos' => [], 'allowDelete' => false]);
    }

    if (!is_dir($uploadDir)) {
        sendResponse(true, ['videos' => [], 'allowDelete' => $allowDelete]);
    }

    $videos = [];
    foreach (scandir($uploadDir, SCANDIR_SORT_DESCENDING) as $file) {
        if ($file === '.' || $file === '..') continue;
        $filepath = $uploadDir . $file;
        if (is_dir($filepath)) continue;
        if (!isVideoExtension(getExtension($file))) continue;

        $videos[] = [
            'src'       => $uploadUrlPrefix . $file,
            'filename'  => $file,
            'size'      => formatFileSize(filesize($filepath)),
            'sizeBytes' => filesize($filepath),
            'modified'  => filemtime($filepath)
        ];
    }

    usort($videos, function ($a, $b) {
        return $b['modified'] - $a['modified'];
    });

    sendResponse(true, [
        'videos'      => $videos,
        'allowDelete' => $allowDelete
    ]);
}

// ============================================
// VIDEO DELETE HANDLER
// ============================================
function handleVideoDelete() {
    global $uploadDir, $allowDelete, $allowVideoUpload;

    if (!$allowVideoUpload) sendError('Video upload is disabled');
    if (!$allowDelete) sendError('Delete functionality is disabled');
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendError('Method not allowed');

    $file = $_POST['file'] ?? $_GET['file'] ?? null;
    if (!$file) sendError('No file specified');
    $file = basename($file);

    if (!isVideoExtension(getExtension($file))) sendError('Invalid file type');

    $filepath = $uploadDir . $file;
    if (!file_exists($filepath)) sendError('File not found');
    if (!@unlink($filepath)) sendError('Failed to delete file');

    sendResponse(true, ['message' => 'File deleted successfully']);
}

// ============================================
// VIDEO UPLOAD HANDLER
// ============================================
function handleVideoUpload() {
    global $uploadDir, $uploadUrlPrefix, $maxVideoSize, $allowedVideoMimeTypes,
           $allowedVideoExtensions, $allowVideoUpload;

    if (!$allowVideoUpload) {
        sendError('Video upload is disabled (enable $allowVideoUpload in PHP config)');
    }

    if (!isset($_FILES['video']) || $_FILES['video']['error'] === UPLOAD_ERR_NO_FILE) {
        sendError('No file uploaded');
    }

    $file = $_FILES['video'];

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

    if ($file['size'] === 0) sendError('File is empty');

    if ($file['size'] > $maxVideoSize) {
        $maxMB = round($maxVideoSize / 1024 / 1024);
        sendError("File too large (max {$maxMB}MB)");
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    if (!in_array($mimeType, $allowedVideoMimeTypes)) {
        sendError('Invalid file type. Allowed: ' . implode(', ', $allowedVideoExtensions));
    }

    $extension = getExtension($file['name']);
    if (!in_array($extension, $allowedVideoExtensions)) {
        sendError('Invalid file extension');
    }

    if (!is_dir($uploadDir) && !@mkdir($uploadDir, 0755, true)) {
        sendError('Server error: cannot create upload directory');
    }
    if (!is_writable($uploadDir)) {
        sendError('Server error: upload directory is not writable');
    }

    $mimeToExt = [
        'video/mp4'        => 'mp4',
        'video/webm'       => 'webm',
        'video/ogg'        => 'ogv',
        'video/quicktime'  => 'mov'
    ];
    $ext = $mimeToExt[$mimeType] ?? $extension;

    $filename = generateFilename($ext);
    $destination = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        sendError('Server error: failed to save file');
    }

    sendResponse(true, [
        'src'     => $uploadUrlPrefix . $filename,
        'caption' => ''
    ]);
}
