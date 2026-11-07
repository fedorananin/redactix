<?php
/**
 * Redactix Media Handler - DEMO VERSION
 *
 * This is a demo version that doesn't actually upload files.
 * Instead it always returns the default image (uploads/default.jpg)
 * for image uploads, and the default video (uploads/default.mp4) for
 * video uploads.
 *
 * Perfect for testing and demonstrations without cluttering your uploads folder.
 * Browse and delete functions work with real files in the uploads directory.
 *
 * Same protocol as redactix_images.php (see there for the full description):
 * - POST with 'image' file: Returns default.jpg (no real upload)
 * - POST with 'video' file: Returns default.mp4 (no real upload)
 * - POST with action=browse[&type=image|video][&offset=N&limit=N]: Lists files of that type
 * - POST with action=delete&file=...[&type=image|video]: Delete file (if enabled)
 */

// ============================================
// CONFIGURATION
// ============================================

// Upload directory
$uploadDir = __DIR__ . '/uploads/';

// URL prefix for uploaded files
$uploadUrlPrefix = '/uploads/';

// Default files returned on "upload"
$defaultFiles = [
    'image' => 'default.jpg',
    'video' => 'default.mp4',
];

// Enable delete functionality (set to true to allow deleting images / videos)
$allowDelete = false;

// Enable video uploads in the demo. Turned on so the /video command on
// the demo page (index.html) works end-to-end — real uploads are still
// mocked, every upload returns uploads/default.mp4.
$allowVideoUpload = true;

// Extensions listed by browse / accepted by delete (no SVG — see
// $allowSvg in redactix_images.php).
$extensions = [
    'image' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif'],
    'video' => ['mp4', 'm4v', 'webm', 'ogg', 'ogv', 'mov'],
];

// ============================================
// HEADERS
// ============================================
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// No CORS (same-origin demo): preflights are refused.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Allow: GET, POST');
    http_response_code(405);
    exit;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Send JSON response and exit
 */
function sendResponse($success, $data = []) {
    echo json_encode(array_merge(['success' => $success], $data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Send error response with message (and an optional machine-readable code)
 */
function sendError($message, $code = null) {
    $data = ['error' => $message];
    if ($code !== null) $data['code'] = $code;
    sendResponse(false, $data);
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
 * Get file extension from filename
 */
function getExtension($filename) {
    return strtolower(pathinfo($filename, PATHINFO_EXTENSION));
}

/**
 * php.ini shorthand ("8M", "1G") → bytes
 */
function iniBytes($value) {
    $value = trim((string)$value);
    if ($value === '') return 0;
    $num = (float)$value;
    switch (strtolower(substr($value, -1))) {
        case 'g': $num *= 1024;
        // no break
        case 'm': $num *= 1024;
        // no break
        case 'k': $num *= 1024;
    }
    return (int)$num;
}

/**
 * Message for a PHP upload error code
 */
function uploadErrorMessage($code) {
    $errors = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit (php.ini)',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds form size limit',
        UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Server error: missing temp folder',
        UPLOAD_ERR_CANT_WRITE => 'Server error: cannot write to disk',
        UPLOAD_ERR_EXTENSION  => 'Upload blocked by server extension'
    ];
    return $errors[$code] ?? ('Upload failed (error code: ' . $code . ')');
}

// ============================================
// ROUTING
// ============================================

// A body larger than post_max_size arrives as empty $_POST / $_FILES.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($_POST) && empty($_FILES)) {
    $length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    $limit = iniBytes(ini_get('post_max_size'));
    if ($length > 0 && $limit > 0 && $length > $limit) {
        http_response_code(413);
        sendError('File too large (server limit: ' . ini_get('post_max_size') . ')', 'tooLarge');
    }
}

$action = $_GET['action'] ?? ($_POST['action'] ?? null);
$type = (($_GET['type'] ?? ($_POST['type'] ?? 'image')) === 'video') ? 'video' : 'image';

if ($action === 'browse') {
    handleBrowse($type);
}

if ($action === 'delete') {
    handleDelete($type);
}

// Handle upload (POST without specific action, or with action=upload).
// Video upload is detected by the 'video' file field; image upload by
// the 'image' field.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === null || $action === 'upload')) {
    handleUpload(isset($_FILES['video']) ? 'video' : 'image');
}

// If nothing matched
sendError('Invalid request');

// ============================================
// BROWSE HANDLER
// ============================================
function handleBrowse($kind) {
    global $uploadDir, $uploadUrlPrefix, $allowDelete, $allowVideoUpload, $extensions;
    $listKey = $kind === 'video' ? 'videos' : 'images';

    $offset = max(0, (int)($_POST['offset'] ?? $_GET['offset'] ?? 0));
    $rawLimit = $_POST['limit'] ?? $_GET['limit'] ?? null;
    $limit = $rawLimit === null || $rawLimit === '' ? null : min(500, max(1, (int)$rawLimit));

    $empty = [$listKey => [], 'allowDelete' => $allowDelete, 'total' => 0, 'offset' => $offset, 'limit' => $limit];
    if ($kind === 'video' && !$allowVideoUpload) {
        $empty['allowDelete'] = false;
        sendResponse(true, $empty);
    }
    if (!is_dir($uploadDir)) {
        sendResponse(true, $empty);
    }

    $files = [];
    foreach (scandir($uploadDir, SCANDIR_SORT_NONE) as $file) {
        if ($file === '.' || $file === '..' || $file[0] === '.') continue;
        $filepath = $uploadDir . $file;
        if (!is_file($filepath)) continue;
        if (!in_array(getExtension($file), $extensions[$kind], true)) continue;
        $files[] = ['name' => $file, 'modified' => filemtime($filepath), 'size' => filesize($filepath)];
    }

    // Newest first (one sort).
    usort($files, function ($a, $b) {
        return $b['modified'] <=> $a['modified'] ?: strcmp($a['name'], $b['name']);
    });

    $total = count($files);
    $page = $limit === null ? array_slice($files, $offset) : array_slice($files, $offset, $limit);

    $items = [];
    foreach ($page as $f) {
        $item = [
            'src'       => $uploadUrlPrefix . rawurlencode($f['name']),
            'filename'  => $f['name'],
            'size'      => formatFileSize($f['size']),
            'sizeBytes' => $f['size'],
            'modified'  => $f['modified']
        ];
        if ($kind === 'image') {
            $item['srcset'] = '';
            $item['alt'] = '';
            $item['title'] = '';
        }
        $items[] = $item;
    }

    sendResponse(true, [
        $listKey      => $items,
        'allowDelete' => $allowDelete,
        'total'       => $total,
        'offset'      => $offset,
        'limit'       => $limit
    ]);
}

// ============================================
// DELETE HANDLER
// ============================================
function handleDelete($kind) {
    global $uploadDir, $allowDelete, $allowVideoUpload, $defaultFiles, $extensions;

    if ($kind === 'video' && !$allowVideoUpload) sendError('Video upload is disabled');
    if (!$allowDelete) sendError('Delete functionality is disabled');
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendError('Method not allowed');

    $file = $_POST['file'] ?? null;
    if (!is_string($file) || $file === '') sendError('No file specified');

    // Security: prevent directory traversal; only files of this kind.
    $file = basename($file);
    if ($file === '' || $file[0] === '.') sendError('Invalid file name');
    if (in_array($file, $defaultFiles, true)) sendError('Cannot delete the default file');
    if (!in_array(getExtension($file), $extensions[$kind], true)) sendError('Invalid file type');

    $filepath = $uploadDir . $file;
    if (!is_file($filepath)) sendError('File not found');
    if (!@unlink($filepath)) sendError('Failed to delete file');

    sendResponse(true, ['message' => 'File deleted successfully']);
}

// ============================================
// UPLOAD HANDLER (DEMO VERSION)
// ============================================
function handleUpload($kind) {
    global $uploadDir, $uploadUrlPrefix, $defaultFiles, $allowVideoUpload;
    $field = $kind === 'video' ? 'video' : 'image';

    if ($kind === 'video' && !$allowVideoUpload) {
        sendError('Video upload is disabled in this demo (set $allowVideoUpload = true)');
    }

    if (!isset($_FILES[$field]) || $_FILES[$field]['error'] === UPLOAD_ERR_NO_FILE) {
        sendError('No file uploaded');
    }
    $file = $_FILES[$field];
    if (is_array($file['error'])) sendError('One file per request');

    if ($file['error'] !== UPLOAD_ERR_OK) {
        $tooLarge = in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
        sendError(uploadErrorMessage($file['error']), $tooLarge ? 'tooLarge' : null);
    }

    if ($file['size'] === 0) sendError('File is empty');

    $default = $defaultFiles[$kind];
    if (!file_exists($uploadDir . $default)) {
        sendError('Default file not found. Please create uploads/' . $default);
    }

    // Simulate upload delay (makes it feel more realistic)
    usleep(300000); // 0.3 seconds

    // DEMO MODE: Always return the default file. In the real version the
    // file would be validated and saved here.
    $response = ['src' => $uploadUrlPrefix . $default, 'caption' => ''];
    if ($kind === 'image') {
        $response['srcset'] = '';
        $response['alt'] = '';
        $response['title'] = '';
    }
    sendResponse(true, $response);
}
