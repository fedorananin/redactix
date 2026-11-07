<?php
/**
 * Redactix Media Handler
 *
 * Unified script for image AND video upload, browse, and delete operations.
 * Video upload is OFF by default — flip $allowVideoUpload to true and pass
 * `videoUploadUrl: '/redactix_images.php'` (and optionally `videoBrowseUrl`)
 * in the editor config.
 *
 * Actions (protocol shared with redactix_images_demo.php and the JS client
 * in redactix/core/media-client.js):
 * - POST with 'image' file: Upload new image
 * - POST with 'video' file: Upload new video (if $allowVideoUpload = true)
 * - POST with action=browse[&type=image|video][&offset=N&limit=N]:
 *   List uploaded files, newest first. Response: { success, images|videos,
 *   allowDelete, total, offset, limit } — without limit, everything from
 *   offset on is returned (backward compatible).
 * - POST with action=delete&file=filename[&type=image|video]: Delete file (if enabled)
 *
 * Errors: { success: false, error: "...", code?: "tooLarge" }. A request
 * larger than post_max_size is answered with HTTP 413.
 *
 * Customize security measures according to your project needs:
 * - Add authentication (session check, JWT, etc.)
 * - Add CSRF protection
 * - Configure allowed origins
 * - Add rate limiting
 * Also deploy uploads/.htaccess (or the equivalent for your web server):
 * it makes uploaded files download-only / non-sniffable.
 */

// ============================================
// CONFIGURATION
// ============================================

// Upload directory (relative to this script or absolute path)
$uploadDir = __DIR__ . '/uploads/';

// URL prefix for uploaded files (how they'll be accessed via web)
$uploadUrlPrefix = '/uploads/';

// Maximum image size in bytes (5MB)
$maxFileSize = 5 * 1024 * 1024;

// Enable delete functionality (set to true to allow deleting files).
// The editor shows the delete button only when its own allowImageDelete /
// allowVideoDelete option is ALSO true.
$allowDelete = false;

// SVG uploads are OFF by default. An SVG is an XML document that can carry
// <script> and event handlers: served from your domain it runs with your
// origin (stored XSS). Only enable it if you trust every uploader AND the
// uploads directory is served with the headers from uploads/.htaccess
// (Content-Security-Policy: sandbox, Content-Disposition: attachment).
$allowSvg = false;

// ---- VIDEO UPLOAD (off by default) ---------------------------------
// Flip to true to accept native HTML5 video uploads from the editor's
// /video command. Then pass the same script URL as `videoUploadUrl`
// (and optionally `videoBrowseUrl`) in the Redactix constructor.
$allowVideoUpload = false;

// Maximum video size in bytes (50MB by default — bump up if needed,
// and remember to lift `upload_max_filesize` / `post_max_size` in php.ini).
$maxVideoSize = 50 * 1024 * 1024;

// Accepted formats: detected MIME type => extension the file is saved with.
// finfo reports some valid files under alternative names (audio/ogg for an
// .ogv, video/x-m4v for an .m4v …), so each format lists all of them.
$imageFormats = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/gif'  => 'gif',
    'image/webp' => 'webp',
    'image/avif' => 'avif',
    'image/heic' => 'heic',
    'image/heif' => 'heif',
];
$imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif'];
if ($allowSvg) {
    $imageFormats['image/svg+xml'] = 'svg';
    $imageExtensions[] = 'svg';
}

$videoFormats = [
    'video/mp4'       => 'mp4',
    'application/mp4' => 'mp4',
    'video/x-m4v'     => 'm4v',
    'video/webm'      => 'webm',
    'audio/webm'      => 'webm',
    'video/ogg'       => 'ogv',
    'application/ogg' => 'ogv',
    'audio/ogg'       => 'ogv',
    'video/quicktime' => 'mov',
];
$videoExtensions = ['mp4', 'm4v', 'webm', 'ogg', 'ogv', 'mov'];

// ============================================
// HEADERS
// ============================================
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// No CORS by default: the editor posts from the same origin. If you serve
// this script from another origin, answer the preflight here with the
// Access-Control-Allow-* headers for YOUR origin (never "*" together with
// cookies) — until then, preflights are refused.
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

/**
 * ISO-BMFF brand check for HEIC / HEIF / AVIF — getimagesize() can't read
 * them (or only some of them), so at least verify the container header.
 */
function hasIsoBmffBrand($filepath, array $brands) {
    $head = @file_get_contents($filepath, false, null, 0, 64);
    if ($head === false || strlen($head) < 16 || substr($head, 4, 4) !== 'ftyp') return false;
    $boxSize = unpack('N', substr($head, 0, 4))[1];
    $end = min(strlen($head), max(16, $boxSize));
    // major brand at 8..12, compatible brands from 16 on
    $candidates = [substr($head, 8, 4)];
    for ($i = 16; $i + 4 <= $end; $i += 4) $candidates[] = substr($head, $i, 4);
    return count(array_intersect($candidates, $brands)) > 0;
}

/**
 * Validate that a file really is the image its MIME type claims
 */
function isValidImage($filepath, $mimeType) {
    if ($mimeType === 'image/svg+xml') {
        // Only reachable with $allowSvg = true. Well-formed XML without
        // scripts, event handlers or embedded foreign content.
        $content = file_get_contents($filepath);
        if ($content === false) return false;
        if (preg_match('/<\s*(script|foreignObject|iframe|embed|object)\b|\bon[a-z]+\s*=|javascript:|<!ENTITY/i', $content)) {
            return false;
        }
        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($content, 'SimpleXMLElement', LIBXML_NONET);
        libxml_clear_errors();
        return $xml !== false;
    }

    if (in_array($mimeType, ['image/heic', 'image/heif'], true)) {
        return hasIsoBmffBrand($filepath, ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);
    }
    if ($mimeType === 'image/avif') {
        return hasIsoBmffBrand($filepath, ['avif', 'avis']) || @getimagesize($filepath) !== false;
    }

    // Raster images - check with getimagesize
    return @getimagesize($filepath) !== false;
}

/**
 * Configuration for one media kind ('image' | 'video')
 */
function mediaConfig($kind) {
    global $imageFormats, $imageExtensions, $videoFormats, $videoExtensions, $maxFileSize, $maxVideoSize;
    if ($kind === 'video') {
        return ['formats' => $videoFormats, 'extensions' => $videoExtensions, 'maxSize' => $maxVideoSize, 'field' => 'video', 'list' => 'videos'];
    }
    return ['formats' => $imageFormats, 'extensions' => $imageExtensions, 'maxSize' => $maxFileSize, 'field' => 'image', 'list' => 'images'];
}

// ============================================
// ROUTING
// ============================================

// A body larger than post_max_size arrives as empty $_POST / $_FILES —
// which used to surface as a puzzling "No file uploaded".
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
// the 'image' field — so the JS clients don't need a `type=` switch.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === null || $action === 'upload')) {
    handleUpload(isset($_FILES['video']) ? 'video' : 'image');
}

// If nothing matched
sendError('Invalid request');

// ============================================
// BROWSE HANDLER
// ============================================
function handleBrowse($kind) {
    global $uploadDir, $uploadUrlPrefix, $allowDelete, $allowVideoUpload;
    $config = mediaConfig($kind);

    $offset = max(0, (int)($_POST['offset'] ?? $_GET['offset'] ?? 0));
    $rawLimit = $_POST['limit'] ?? $_GET['limit'] ?? null;
    $limit = $rawLimit === null || $rawLimit === '' ? null : min(500, max(1, (int)$rawLimit));

    $empty = [$config['list'] => [], 'allowDelete' => $allowDelete, 'total' => 0, 'offset' => $offset, 'limit' => $limit];
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
        if (!in_array(getExtension($file), $config['extensions'], true)) continue;
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
            // Optional fields - can be customized (e.g. from a metadata
            // store); the editor fills the modal with them.
            $item['srcset'] = '';
            $item['alt'] = '';
            $item['title'] = '';
        }
        $items[] = $item;
    }

    sendResponse(true, [
        $config['list'] => $items,
        'allowDelete'   => $allowDelete,
        'total'         => $total,
        'offset'        => $offset,
        'limit'         => $limit
    ]);
}

// ============================================
// DELETE HANDLER
// ============================================
function handleDelete($kind) {
    global $uploadDir, $allowDelete, $allowVideoUpload;
    $config = mediaConfig($kind);

    if ($kind === 'video' && !$allowVideoUpload) sendError('Video upload is disabled');
    if (!$allowDelete) sendError('Delete functionality is disabled');
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendError('Method not allowed');

    $file = $_POST['file'] ?? null;
    if (!is_string($file) || $file === '') sendError('No file specified');

    // Security: prevent directory traversal; only files of this kind.
    $file = basename($file);
    if ($file === '' || $file[0] === '.') sendError('Invalid file name');
    if (!in_array(getExtension($file), $config['extensions'], true)) sendError('Invalid file type');

    $filepath = $uploadDir . $file;
    if (!is_file($filepath)) sendError('File not found');
    if (!@unlink($filepath)) sendError('Failed to delete file');

    sendResponse(true, ['message' => 'File deleted successfully']);
}

// ============================================
// UPLOAD HANDLER
// ============================================
function handleUpload($kind) {
    global $uploadDir, $uploadUrlPrefix, $allowVideoUpload;
    $config = mediaConfig($kind);
    $field = $config['field'];

    if ($kind === 'video' && !$allowVideoUpload) {
        sendError('Video upload is disabled (enable $allowVideoUpload in PHP config)');
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
    if ($file['size'] > $config['maxSize']) {
        $maxMB = round($config['maxSize'] / 1024 / 1024);
        sendError("File too large (max {$maxMB}MB)", 'tooLarge');
    }

    // Extension of the original name AND the detected content type must
    // both be acceptable; the file is saved with the extension that matches
    // its content.
    $extension = getExtension($file['name']);
    if (!in_array($extension, $config['extensions'], true)) {
        sendError('Invalid file extension. Allowed: ' . implode(', ', $config['extensions']));
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    if (!isset($config['formats'][$mimeType])) {
        sendError('Invalid file type. Allowed: ' . implode(', ', $config['extensions']));
    }

    if ($kind === 'image' && !isValidImage($file['tmp_name'], $mimeType)) {
        sendError('File is not a valid image');
    }

    if (!is_dir($uploadDir) && !@mkdir($uploadDir, 0755, true)) {
        sendError('Server error: cannot create upload directory');
    }
    if (!is_writable($uploadDir)) {
        sendError('Server error: upload directory is not writable');
    }

    $filename = generateFilename($config['formats'][$mimeType]);
    if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
        sendError('Server error: failed to save file');
    }

    $response = ['src' => $uploadUrlPrefix . $filename, 'caption' => ''];
    if ($kind === 'image') {
        // Customize as needed
        $response['srcset'] = '';
        $response['alt'] = '';
        $response['title'] = '';
    }
    sendResponse(true, $response);
}
