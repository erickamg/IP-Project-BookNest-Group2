<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

function respond(array $body, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

function database(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $pdo = new PDO(
        'mysql:host=127.0.0.1;dbname=booknest;charset=utf8mb4',
        'root',
        '',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
    return $pdo;
}

function payload(): array
{
    $decoded = json_decode(file_get_contents('php://input'), true);
    return is_array($decoded) ? $decoded : [];
}

function requireUser(): array
{
    if (!isset($_SESSION['user_id'])) {
        respond(['error' => 'Please sign in to continue.'], 401);
    }

    $statement = database()->prepare('SELECT id, role, is_active FROM users WHERE id = ?');
    $statement->execute([(int) $_SESSION['user_id']]);
    $user = $statement->fetch();
    if (!$user || !(int) $user['is_active']) {
        $_SESSION = [];
        session_destroy();
        respond(['error' => 'This account is inactive. Contact a library administrator.'], 403);
    }
    return ['id' => (int) $user['id'], 'role' => $user['role']];
}

function requireRole(array $roles): array
{
    $user = requireUser();
    if (!in_array($user['role'], $roles, true)) {
        respond(['error' => 'You do not have permission to perform this action.'], 403);
    }
    return $user;
}

function bookCode(mixed $value): string
{
    if (!is_string($value) || !preg_match('/^bk-[a-zA-Z0-9]{2,9}$/', $value)) {
        respond(['error' => 'Invalid book selection.'], 422);
    }
    return strtolower($value);
}

function libraryRules(): array
{
    $rules = database()->query(
        'SELECT loan_period_days, max_active_loans, renewal_limit, fine_rate_pesos
         FROM library_rules WHERE id = 1'
    )->fetch();
    if (!$rules) {
        throw new RuntimeException('Library rules have not been configured.');
    }
    return [
        'loanPeriodDays' => (int) $rules['loan_period_days'],
        'maxActiveLoans' => (int) $rules['max_active_loans'],
        'renewalLimit' => (int) $rules['renewal_limit'],
        'fineRatePesos' => (float) $rules['fine_rate_pesos'],
    ];
}

function catalogRows(bool $includeArchived = false): array
{
    $where = $includeArchived ? '' : 'WHERE b.archived_at IS NULL';
    $statement = database()->query(
        "SELECT b.book_code, b.title, b.author, b.category, b.subject, b.isbn,
            b.publication_year, b.copies_total, b.archived_at,
            b.copies_total - COUNT(active.id) AS copies_available
         FROM books b
         LEFT JOIN loans active ON active.book_id = b.id AND active.returned_on IS NULL
         {$where}
         GROUP BY b.id
         ORDER BY b.title"
    );
    return array_map(static function (array $book): array {
        return [
            'id' => $book['book_code'],
            'title' => $book['title'],
            'author' => $book['author'],
            'category' => $book['category'],
            'subject' => $book['subject'],
            'isbn' => $book['isbn'] ?? '',
            'year' => (int) $book['publication_year'],
            'available' => (int) $book['copies_available'],
            'total' => (int) $book['copies_total'],
            'archived' => $book['archived_at'] !== null,
        ];
    }, $statement->fetchAll());
}

function getLibraryData(array $user): array
{
    $pdo = database();
    $userQuery = $pdo->prepare('SELECT full_name, email, phone, role, profile_photo_path FROM users WHERE id = ?');
    $userQuery->execute([$user['id']]);
    $profile = $userQuery->fetch();
    if (!$profile) {
        respond(['error' => 'Your account could not be found. Please sign in again.'], 401);
    }

    $rules = libraryRules();
    $loansQuery = $pdo->prepare(
        'SELECT l.id AS loan_id, b.book_code, l.borrowed_on, l.due_on, l.returned_on,
            l.renewals_used,
            GREATEST(DATEDIFF(COALESCE(l.returned_on, CURDATE()), l.due_on), 0) AS late_days
         FROM loans l
         JOIN books b ON b.id = l.book_id
         WHERE l.user_id = ?
         ORDER BY l.borrowed_on DESC, l.id DESC'
    );
    $loansQuery->execute([$user['id']]);
    $borrowed = [];
    $history = [];
    $fineTotal = 0.0;
    foreach ($loansQuery->fetchAll() as $loan) {
        $fine = (float) $loan['late_days'] * $rules['fineRatePesos'];
        $fineTotal += $fine;
        $record = [
            'loanId' => (int) $loan['loan_id'],
            'bookId' => $loan['book_code'],
            'borrowedOn' => $loan['borrowed_on'],
            'dueOn' => $loan['due_on'],
            'renewalsUsed' => (int) $loan['renewals_used'],
            'fineAmount' => number_format($fine, 2, '.', ''),
        ];
        if ($loan['returned_on'] === null) {
            $borrowed[] = $record;
            continue;
        }
        $record['returnedOn'] = $loan['returned_on'];
        $record['status'] = $loan['returned_on'] > $loan['due_on'] ? 'Late' : 'Returned';
        $history[] = $record;
    }

    $reservationsQuery = $pdo->prepare(
        'SELECT r.id, b.book_code, b.title, r.status, r.requested_at
         FROM reservations r
         JOIN books b ON b.id = r.book_id
         WHERE r.user_id = ? AND r.status IN (\'pending\', \'approved\')
         ORDER BY r.requested_at DESC'
    );
    $reservationsQuery->execute([$user['id']]);

    $overview = $pdo->query(
        'SELECT
            (SELECT COUNT(*) FROM users WHERE is_active = 1 AND role = \'borrower\') AS active_borrowers,
            (SELECT COUNT(*) FROM books WHERE archived_at IS NULL) AS active_books,
            (SELECT COUNT(*) FROM loans WHERE returned_on IS NULL) AS active_loans,
            (SELECT COUNT(*) FROM loans WHERE returned_on IS NULL AND due_on < CURDATE()) AS overdue_loans,
            (SELECT COUNT(*) FROM reservations WHERE status = \'pending\') AS pending_reservations'
    )->fetch();

    return [
        'profile' => [
            'name' => $profile['full_name'],
            'email' => $profile['email'],
            'phone' => $profile['phone'] ?? '',
            'photoUrl' => $profile['profile_photo_path'] ?? '',
        ],
        'role' => $profile['role'],
        'books' => catalogRows(),
        'borrowed' => $borrowed,
        'history' => $history,
        'reservations' => $reservationsQuery->fetchAll(),
        'fineTotal' => number_format($fineTotal, 2, '.', ''),
        'rules' => $rules,
        'overview' => array_map('intval', $overview),
    ];
}

function storedProfilePhotoPath(?string $relativePath): ?string
{
    if ($relativePath === null || !preg_match('/^uploads\/profile\/[a-f0-9]{32}\.(jpg|png|webp)$/', $relativePath)) {
        return null;
    }
    return __DIR__ . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
}

function removeStoredProfilePhoto(?string $relativePath): void
{
    $path = storedProfilePhotoPath($relativePath);
    if ($path !== null && is_file($path) && !unlink($path)) {
        error_log('BookNest could not remove profile photo: ' . $path);
    }
}

function staffOverview(): array
{
    return database()->query(
        'SELECT
            (SELECT COUNT(*) FROM users WHERE is_active = 1 AND role = \'borrower\') AS active_borrowers,
            (SELECT COUNT(*) FROM books WHERE archived_at IS NULL) AS active_books,
            (SELECT COUNT(*) FROM loans WHERE returned_on IS NULL) AS active_loans,
            (SELECT COUNT(*) FROM loans WHERE returned_on IS NULL AND due_on < CURDATE()) AS overdue_loans,
            (SELECT COUNT(*) FROM reservations WHERE status = \'pending\') AS pending_reservations'
    )->fetch();
}

function createBookCode(): string
{
    return 'bk-' . bin2hex(random_bytes(4));
}

function validateBookInput(array $input): array
{
    $title = trim((string) ($input['title'] ?? ''));
    $author = trim((string) ($input['author'] ?? ''));
    $subject = trim((string) ($input['subject'] ?? ''));
    $category = trim((string) ($input['category'] ?? $subject));
    $isbn = trim((string) ($input['isbn'] ?? ''));
    $year = filter_var($input['year'] ?? null, FILTER_VALIDATE_INT);
    $copies = filter_var($input['total'] ?? null, FILTER_VALIDATE_INT);
    if ($title === '' || $author === '' || $subject === '' || $category === ''
        || mb_strlen($title) > 200 || mb_strlen($author) > 200
        || mb_strlen($subject) > 100 || mb_strlen($category) > 100) {
        respond(['error' => 'Enter a title, author, subject, and category within the field limits.'], 422);
    }
    if ($isbn !== '' && (!preg_match('/^[0-9Xx-]{10,20}$/', $isbn) || mb_strlen($isbn) > 20)) {
        respond(['error' => 'Enter a valid ISBN (10–20 digits, X, or hyphens).'], 422);
    }
    if ($year === false || $year < 1000 || $year > (int) date('Y') + 1
        || $copies === false || $copies < 0 || $copies > 1000) {
        respond(['error' => 'Enter a valid publication year and copy count.'], 422);
    }
    return [
        'title' => $title,
        'author' => $author,
        'subject' => $subject,
        'category' => $category,
        'isbn' => $isbn === '' ? null : $isbn,
        'year' => $year,
        'total' => $copies,
    ];
}

try {
    $action = $_GET['action'] ?? '';
    $method = $_SERVER['REQUEST_METHOD'];

    if ($action === 'signup' && $method === 'POST') {
        $input = payload();
        $name = $input['name'] ?? null;
        $email = $input['email'] ?? null;
        $password = $input['password'] ?? null;
        if (!is_string($name) || !is_string($email) || !is_string($password)) {
            respond(['error' => 'Enter your name, email address, and password.'], 422);
        }
        $name = trim($name);
        $email = strtolower(trim($email));
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respond(['error' => 'Enter your name and a valid email address.'], 422);
        }
        if (mb_strlen($name) > 120 || mb_strlen($email) > 190) {
            respond(['error' => 'Your name or email address is too long.'], 422);
        }
        if (strlen($password) < 8 || strlen($password) > 72) {
            respond(['error' => 'Your password must be between 8 and 72 characters.'], 422);
        }

        $statement = database()->prepare('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)');
        $statement->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) database()->lastInsertId();
        respond(['ok' => true, 'role' => 'borrower'], 201);
    }

    if ($action === 'login' && $method === 'POST') {
        $input = payload();
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
            respond(['error' => 'Enter a valid email address and password.'], 422);
        }
        $statement = database()->prepare('SELECT id, password_hash, role, is_active FROM users WHERE email = ?');
        $statement->execute([$email]);
        $user = $statement->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            respond(['error' => 'Email or password is incorrect.'], 401);
        }
        if (!(int) $user['is_active']) {
            respond(['error' => 'This account is inactive. Contact a library administrator.'], 403);
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        respond(['ok' => true, 'role' => $user['role']]);
    }

    if ($action === 'logout' && $method === 'POST') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $cookie = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $cookie['path'], $cookie['domain'], $cookie['secure'], $cookie['httponly']);
        }
        session_destroy();
        respond(['ok' => true]);
    }

    if ($action === 'data' && $method === 'GET') {
        respond(getLibraryData(requireUser()));
    }

    if ($action === 'profile' && $method === 'PUT') {
        $user = requireUser();
        $input = payload();
        $name = $input['name'] ?? null;
        $email = $input['email'] ?? null;
        $phone = $input['phone'] ?? '';
        if (!is_string($name) || !is_string($email) || !is_string($phone)) {
            respond(['error' => 'Enter a valid name, email address, and phone number.'], 422);
        }
        $name = trim($name);
        $email = strtolower(trim($email));
        $phone = trim($phone);
        if ($name === '' || mb_strlen($name) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)
            || mb_strlen($email) > 190 || mb_strlen($phone) > 40) {
            respond(['error' => 'Enter a valid name, email address, and phone number within the field limits.'], 422);
        }
        $update = database()->prepare('UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?');
        try {
            $update->execute([$name, $email, $phone === '' ? null : $phone, $user['id']]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                respond(['error' => 'That email address is already associated with another account.'], 409);
            }
            throw $error;
        }
        $profile = database()->prepare('SELECT full_name, email, phone, role, profile_photo_path FROM users WHERE id = ?');
        $profile->execute([$user['id']]);
        $record = $profile->fetch();
        respond([
            'ok' => true,
            'profile' => [
                'name' => $record['full_name'],
                'email' => $record['email'],
                'phone' => $record['phone'] ?? '',
                'photoUrl' => $record['profile_photo_path'] ?? '',
                'role' => $record['role'],
            ],
        ]);
    }

    if ($action === 'profile-photo' && $method === 'POST') {
        $user = requireUser();
        $upload = $_FILES['photo'] ?? null;
        if (!is_array($upload) || !isset($upload['error'], $upload['tmp_name'], $upload['size'])) {
            respond(['error' => 'Choose a JPEG, PNG, or WebP image to upload.'], 422);
        }
        if ((int) $upload['error'] !== UPLOAD_ERR_OK) {
            $status = in_array((int) $upload['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 413 : 422;
            respond(['error' => 'The image upload failed. Choose an image smaller than 5 MB and try again.'], $status);
        }
        if ((int) $upload['size'] < 1 || (int) $upload['size'] > 5 * 1024 * 1024
            || !is_uploaded_file($upload['tmp_name'])) {
            respond(['error' => 'Choose an image smaller than 5 MB.'], 422);
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($upload['tmp_name']);
        $image = getimagesize($upload['tmp_name']);
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!is_string($mime) || !isset($extensions[$mime]) || $image === false
            || $image[0] > 6000 || $image[1] > 6000) {
            respond(['error' => 'Use a valid JPEG, PNG, or WebP image no larger than 6000 × 6000 pixels.'], 422);
        }

        $directory = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'profile';
        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            throw new RuntimeException('Could not create the profile image directory.');
        }
        $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
        $relativePath = 'uploads/profile/' . $filename;
        $absolutePath = $directory . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($upload['tmp_name'], $absolutePath)) {
            throw new RuntimeException('Could not save the uploaded profile image.');
        }

        try {
            $pdo = database();
            $previous = $pdo->prepare('SELECT profile_photo_path FROM users WHERE id = ?');
            $previous->execute([$user['id']]);
            $oldPath = $previous->fetchColumn();
            $update = $pdo->prepare('UPDATE users SET profile_photo_path = ? WHERE id = ?');
            $update->execute([$relativePath, $user['id']]);
        } catch (Throwable $error) {
            if (is_file($absolutePath) && !unlink($absolutePath)) {
                error_log('BookNest could not clean up an unlinked profile photo: ' . $absolutePath);
            }
            throw $error;
        }

        removeStoredProfilePhoto(is_string($oldPath) ? $oldPath : null);
        respond(['ok' => true, 'photoUrl' => $relativePath]);
    }

    if ($action === 'profile-photo' && $method === 'DELETE') {
        $user = requireUser();
        $pdo = database();
        $query = $pdo->prepare('SELECT profile_photo_path FROM users WHERE id = ?');
        $query->execute([$user['id']]);
        $oldPath = $query->fetchColumn();
        $update = $pdo->prepare('UPDATE users SET profile_photo_path = NULL WHERE id = ?');
        $update->execute([$user['id']]);
        removeStoredProfilePhoto(is_string($oldPath) ? $oldPath : null);
        respond(['ok' => true]);
    }

    if ($action === 'change-password' && $method === 'POST') {
        $user = requireUser();
        $input = payload();
        $currentPassword = $input['currentPassword'] ?? null;
        $newPassword = $input['newPassword'] ?? null;
        if (!is_string($currentPassword) || !is_string($newPassword)
            || strlen($newPassword) < 8 || strlen($newPassword) > 72) {
            respond(['error' => 'Enter your current password and a new password between 8 and 72 characters.'], 422);
        }
        $query = database()->prepare('SELECT password_hash FROM users WHERE id = ?');
        $query->execute([$user['id']]);
        $passwordHash = $query->fetchColumn();
        if (!is_string($passwordHash) || !password_verify($currentPassword, $passwordHash)) {
            respond(['error' => 'Your current password is incorrect.'], 403);
        }
        $update = database()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $update->execute([password_hash($newPassword, PASSWORD_DEFAULT), $user['id']]);
        respond(['ok' => true]);
    }

    if ($action === 'request' && $method === 'POST') {
        $user = requireRole(['borrower']);
        $code = bookCode(payload()['bookId'] ?? null);
        $pdo = database();
        $pdo->beginTransaction();
        $bookQuery = $pdo->prepare('SELECT id FROM books WHERE book_code = ? AND archived_at IS NULL FOR UPDATE');
        $bookQuery->execute([$code]);
        $book = $bookQuery->fetch();
        if (!$book) {
            $pdo->rollBack();
            respond(['error' => 'That book is unavailable in the catalog.'], 404);
        }
        $memberLock = $pdo->prepare('SELECT id FROM users WHERE id = ? FOR UPDATE');
        $memberLock->execute([$user['id']]);
        $loanCount = $pdo->prepare('SELECT COUNT(*) FROM loans WHERE user_id = ? AND returned_on IS NULL');
        $loanCount->execute([$user['id']]);
        if ((int) $loanCount->fetchColumn() >= libraryRules()['maxActiveLoans']) {
            $pdo->rollBack();
            respond(['error' => 'You have reached the active loan limit.'], 409);
        }
        $duplicate = $pdo->prepare(
            'SELECT id FROM loans WHERE user_id = ? AND book_id = ? AND returned_on IS NULL
             UNION ALL
             SELECT id FROM reservations WHERE user_id = ? AND book_id = ? AND status IN (\'pending\', \'approved\')
             LIMIT 1'
        );
        $duplicate->execute([$user['id'], $book['id'], $user['id'], $book['id']]);
        if ($duplicate->fetch()) {
            $pdo->rollBack();
            respond(['error' => 'You already have this book on loan or requested.'], 409);
        }
        $insert = $pdo->prepare('INSERT INTO reservations (user_id, book_id) VALUES (?, ?)');
        $insert->execute([$user['id'], $book['id']]);
        $pdo->commit();
        respond(['ok' => true], 201);
    }

    if ($action === 'renew' && $method === 'POST') {
        $user = requireRole(['borrower']);
        $loanId = filter_var(payload()['loanId'] ?? null, FILTER_VALIDATE_INT);
        if (!$loanId || $loanId < 1) {
            respond(['error' => 'Invalid loan selection.'], 422);
        }
        $pdo = database();
        $rules = libraryRules();
        $pdo->beginTransaction();
        $loanQuery = $pdo->prepare('SELECT id, book_id, due_on, renewals_used FROM loans WHERE id = ? AND user_id = ? AND returned_on IS NULL FOR UPDATE');
        $loanQuery->execute([$loanId, $user['id']]);
        $loan = $loanQuery->fetch();
        if (!$loan) {
            $pdo->rollBack();
            respond(['error' => 'That active loan could not be found.'], 404);
        }
        if ($loan['due_on'] < date('Y-m-d')) {
            $pdo->rollBack();
            respond(['error' => 'Overdue loans cannot be renewed.'], 409);
        }
        if ((int) $loan['renewals_used'] >= $rules['renewalLimit']) {
            $pdo->rollBack();
            respond(['error' => 'This loan has reached its renewal limit.'], 409);
        }
        $holdQuery = $pdo->prepare('SELECT id FROM reservations WHERE book_id = ? AND user_id <> ? AND status IN (\'pending\', \'approved\') LIMIT 1');
        $holdQuery->execute([$loan['book_id'], $user['id']]);
        if ($holdQuery->fetch()) {
            $pdo->rollBack();
            respond(['error' => 'This book has another borrower waiting and cannot be renewed.'], 409);
        }
        $newDueDate = (new DateTimeImmutable($loan['due_on']))->modify('+' . $rules['loanPeriodDays'] . ' days')->format('Y-m-d');
        $update = $pdo->prepare('UPDATE loans SET due_on = ?, renewals_used = renewals_used + 1 WHERE id = ?');
        $update->execute([$newDueDate, $loan['id']]);
        $pdo->commit();
        respond(['ok' => true, 'dueOn' => $newDueDate]);
    }

    if ($action === 'librarian-data' && $method === 'GET') {
        requireRole(['librarian', 'administrator']);
        $pdo = database();
        $reservations = $pdo->query(
            'SELECT r.id, r.status, r.requested_at, b.book_code, b.title, b.author,
                u.id AS user_id, u.full_name, u.email
             FROM reservations r
             JOIN books b ON b.id = r.book_id
             JOIN users u ON u.id = r.user_id
             WHERE r.status IN (\'pending\', \'approved\')
             ORDER BY r.requested_at'
        )->fetchAll();
        $loans = $pdo->query(
            'SELECT l.id, b.book_code, b.title, b.author, l.borrowed_on, l.due_on,
                u.full_name, u.email,
                GREATEST(DATEDIFF(CURDATE(), l.due_on), 0) AS late_days
             FROM loans l
             JOIN books b ON b.id = l.book_id
             JOIN users u ON u.id = l.user_id
             WHERE l.returned_on IS NULL
             ORDER BY l.due_on'
        )->fetchAll();
        $members = $pdo->query(
            'SELECT id, full_name, email, is_active, created_at
             FROM users WHERE role = \'borrower\'
             ORDER BY full_name'
        )->fetchAll();
        respond([
            'reservations' => $reservations,
            'loans' => $loans,
            'members' => $members,
            'books' => catalogRows(true),
            'overview' => staffOverview(),
            'rules' => libraryRules(),
        ]);
    }

    if ($action === 'reservation-decision' && $method === 'POST') {
        $staff = requireRole(['librarian', 'administrator']);
        $input = payload();
        $reservationId = filter_var($input['reservationId'] ?? null, FILTER_VALIDATE_INT);
        $decision = $input['decision'] ?? '';
        if (!$reservationId || !in_array($decision, ['approved', 'rejected'], true)) {
            respond(['error' => 'Choose a valid reservation and decision.'], 422);
        }
        $pdo = database();
        $pdo->beginTransaction();
        $query = $pdo->prepare('SELECT id, status FROM reservations WHERE id = ? FOR UPDATE');
        $query->execute([$reservationId]);
        $reservation = $query->fetch();
        if (!$reservation || $reservation['status'] !== 'pending') {
            $pdo->rollBack();
            respond(['error' => 'That reservation is no longer pending.'], 409);
        }
        $update = $pdo->prepare('UPDATE reservations SET status = ?, decided_at = NOW(), decided_by = ? WHERE id = ?');
        $update->execute([$decision, $staff['id'], $reservationId]);
        $pdo->commit();
        respond(['ok' => true]);
    }

    if ($action === 'issue' && $method === 'POST') {
        requireRole(['librarian', 'administrator']);
        $reservationId = filter_var(payload()['reservationId'] ?? null, FILTER_VALIDATE_INT);
        if (!$reservationId || $reservationId < 1) {
            respond(['error' => 'Invalid approved reservation.'], 422);
        }
        $pdo = database();
        $rules = libraryRules();
        $pdo->beginTransaction();
        $reservationQuery = $pdo->prepare(
            'SELECT r.id, r.user_id, r.book_id, r.status, b.copies_total, b.archived_at
             FROM reservations r JOIN books b ON b.id = r.book_id
             WHERE r.id = ? FOR UPDATE'
        );
        $reservationQuery->execute([$reservationId]);
        $reservation = $reservationQuery->fetch();
        if (!$reservation || $reservation['status'] !== 'approved' || $reservation['archived_at'] !== null) {
            $pdo->rollBack();
            respond(['error' => 'Only approved requests for active books can be issued.'], 409);
        }
        $bookLock = $pdo->prepare('SELECT id, copies_total, archived_at FROM books WHERE id = ? FOR UPDATE');
        $bookLock->execute([$reservation['book_id']]);
        $book = $bookLock->fetch();
        $memberLock = $pdo->prepare('SELECT id, is_active FROM users WHERE id = ? FOR UPDATE');
        $memberLock->execute([$reservation['user_id']]);
        $member = $memberLock->fetch();
        if (!$member || !(int) $member['is_active'] || !$book || $book['archived_at'] !== null) {
            $pdo->rollBack();
            respond(['error' => 'This borrower or book is no longer active.'], 409);
        }
        $activeCopies = $pdo->prepare('SELECT COUNT(*) FROM loans WHERE book_id = ? AND returned_on IS NULL');
        $activeCopies->execute([$reservation['book_id']]);
        if ((int) $activeCopies->fetchColumn() >= (int) $book['copies_total']) {
            $pdo->rollBack();
            respond(['error' => 'There are no copies available to issue yet.'], 409);
        }
        $memberLoans = $pdo->prepare('SELECT COUNT(*) FROM loans WHERE user_id = ? AND returned_on IS NULL');
        $memberLoans->execute([$reservation['user_id']]);
        if ((int) $memberLoans->fetchColumn() >= $rules['maxActiveLoans']) {
            $pdo->rollBack();
            respond(['error' => 'This borrower has reached the active loan limit.'], 409);
        }
        $borrowedOn = new DateTimeImmutable('today');
        $dueOn = $borrowedOn->modify('+' . $rules['loanPeriodDays'] . ' days')->format('Y-m-d');
        $insert = $pdo->prepare('INSERT INTO loans (user_id, book_id, borrowed_on, due_on) VALUES (?, ?, ?, ?)');
        $insert->execute([$reservation['user_id'], $reservation['book_id'], $borrowedOn->format('Y-m-d'), $dueOn]);
        $update = $pdo->prepare('UPDATE reservations SET status = \'fulfilled\', decided_at = NOW() WHERE id = ?');
        $update->execute([$reservationId]);
        $pdo->commit();
        respond(['ok' => true, 'dueOn' => $dueOn], 201);
    }

    if ($action === 'return' && $method === 'POST') {
        requireRole(['librarian', 'administrator']);
        $loanId = filter_var(payload()['loanId'] ?? null, FILTER_VALIDATE_INT);
        if (!$loanId || $loanId < 1) {
            respond(['error' => 'Invalid loan selection.'], 422);
        }
        $pdo = database();
        $pdo->beginTransaction();
        $loanBook = $pdo->prepare('SELECT book_id FROM loans WHERE id = ? AND returned_on IS NULL');
        $loanBook->execute([$loanId]);
        $bookId = $loanBook->fetchColumn();
        if (!$bookId) {
            $pdo->rollBack();
            respond(['error' => 'That active loan could not be found.'], 404);
        }
        $bookLock = $pdo->prepare('SELECT id FROM books WHERE id = ? FOR UPDATE');
        $bookLock->execute([$bookId]);
        $loanLock = $pdo->prepare('SELECT id FROM loans WHERE id = ? AND returned_on IS NULL FOR UPDATE');
        $loanLock->execute([$loanId]);
        if (!$loanLock->fetch()) {
            $pdo->rollBack();
            respond(['error' => 'That active loan could not be found.'], 404);
        }
        $update = $pdo->prepare('UPDATE loans SET returned_on = CURDATE() WHERE id = ?');
        $update->execute([$loanId]);
        $pdo->commit();
        respond(['ok' => true]);
    }

    if ($action === 'catalog-save' && in_array($method, ['POST', 'PUT'], true)) {
        requireRole(['librarian', 'administrator']);
        $rawInput = payload();
        $code = $method === 'PUT' ? bookCode($rawInput['id'] ?? null) : null;
        $input = validateBookInput($rawInput);
        $pdo = database();
        if ($method === 'POST') {
            $statement = $pdo->prepare(
                'INSERT INTO books (book_code, title, author, category, subject, isbn, publication_year, copies_total)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([
                createBookCode(), $input['title'], $input['author'], $input['category'],
                $input['subject'], $input['isbn'], $input['year'], $input['total'],
            ]);
            respond(['ok' => true], 201);
        }

        $pdo->beginTransaction();
        $bookQuery = $pdo->prepare('SELECT id FROM books WHERE book_code = ? AND archived_at IS NULL FOR UPDATE');
        $bookQuery->execute([$code]);
        $book = $bookQuery->fetch();
        if (!$book) {
            $pdo->rollBack();
            respond(['error' => 'That book could not be found.'], 404);
        }
        $activeLoans = $pdo->prepare(
            'SELECT COUNT(*) FROM loans WHERE book_id = ? AND returned_on IS NULL'
        );
        $activeLoans->execute([$book['id']]);
        if ($input['total'] < (int) $activeLoans->fetchColumn()) {
            $pdo->rollBack();
            respond(['error' => 'Total copies cannot be lower than the number currently on loan.'], 409);
        }
        $statement = $pdo->prepare(
            'UPDATE books SET title = ?, author = ?, category = ?, subject = ?, isbn = ?,
                publication_year = ?, copies_total = ? WHERE book_code = ? AND archived_at IS NULL'
        );
        $statement->execute([
            $input['title'], $input['author'], $input['category'], $input['subject'],
            $input['isbn'], $input['year'], $input['total'], $code,
        ]);
        $pdo->commit();
        respond(['ok' => true]);
    }

    if ($action === 'catalog-archive' && $method === 'POST') {
        requireRole(['librarian', 'administrator']);
        $code = bookCode(payload()['bookId'] ?? null);
        $pdo = database();
        $pdo->beginTransaction();
        $check = $pdo->prepare(
            'SELECT b.id,
                (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.returned_on IS NULL) AS active_loans,
                (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status IN (\'pending\', \'approved\')) AS open_requests
             FROM books b WHERE b.book_code = ? AND b.archived_at IS NULL FOR UPDATE'
        );
        $check->execute([$code]);
        $book = $check->fetch();
        if (!$book) {
            $pdo->rollBack();
            respond(['error' => 'That book could not be found.'], 404);
        }
        if ((int) $book['active_loans'] > 0 || (int) $book['open_requests'] > 0) {
            $pdo->rollBack();
            respond(['error' => 'Return active loans and resolve open requests before archiving this book.'], 409);
        }
        $archive = $pdo->prepare('UPDATE books SET archived_at = NOW() WHERE id = ?');
        $archive->execute([$book['id']]);
        $pdo->commit();
        respond(['ok' => true]);
    }

    if ($action === 'admin-data' && $method === 'GET') {
        requireRole(['administrator']);
        $users = database()->query(
            'SELECT id, full_name, email, role, is_active, created_at
             FROM users ORDER BY role, full_name'
        )->fetchAll();
        $fineEstimate = database()->query(
            'SELECT COALESCE(SUM(GREATEST(DATEDIFF(COALESCE(returned_on, CURDATE()), due_on), 0)), 0) AS late_days
             FROM loans'
        )->fetch();
        $rules = libraryRules();
        $fineEstimate = (float) $fineEstimate['late_days'] * $rules['fineRatePesos'];
        respond([
            'users' => $users,
            'rules' => $rules,
            'overview' => staffOverview(),
            'estimatedFinesPesos' => number_format($fineEstimate, 2, '.', ''),
        ]);
    }

    if ($action === 'staff-create' && $method === 'POST') {
        requireRole(['administrator']);
        $input = payload();
        $name = is_string($input['name'] ?? null) ? trim($input['name']) : '';
        $email = is_string($input['email'] ?? null) ? strtolower(trim($input['email'])) : '';
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';
        $role = $input['role'] ?? '';
        if ($name === '' || mb_strlen($name) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)
            || mb_strlen($email) > 190 || !in_array($role, ['librarian', 'administrator'], true)
            || strlen($password) < 8 || strlen($password) > 72) {
            respond(['error' => 'Enter a valid name, email, staff role, and password (8–72 characters).'], 422);
        }
        $statement = database()->prepare(
            'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)'
        );
        $statement->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), $role]);
        respond(['ok' => true], 201);
    }

    if ($action === 'user-update' && $method === 'PUT') {
        $admin = requireRole(['administrator']);
        $input = payload();
        $userId = filter_var($input['userId'] ?? null, FILTER_VALIDATE_INT);
        $role = $input['role'] ?? '';
        $isActive = filter_var($input['isActive'] ?? null, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if (!$userId || !in_array($role, ['borrower', 'librarian', 'administrator'], true) || $isActive === null) {
            respond(['error' => 'Choose a valid user, role, and account status.'], 422);
        }
        if ($userId === $admin['id']) {
            respond(['error' => 'You cannot change your own role or deactivate your own account.'], 409);
        }
        $target = database()->prepare('SELECT role, is_active FROM users WHERE id = ?');
        $target->execute([$userId]);
        $current = $target->fetch();
        if (!$current) {
            respond(['error' => 'That account could not be found.'], 404);
        }
        if ($current['role'] === 'administrator' && (int) $current['is_active']
            && ($role !== 'administrator' || !$isActive)) {
            $activeAdmins = (int) database()->query(
                'SELECT COUNT(*) FROM users WHERE role = \'administrator\' AND is_active = 1'
            )->fetchColumn();
            if ($activeAdmins <= 1) {
                respond(['error' => 'At least one active administrator must remain.'], 409);
            }
        }
        $update = database()->prepare('UPDATE users SET role = ?, is_active = ? WHERE id = ?');
        $update->execute([$role, (int) $isActive, $userId]);
        respond(['ok' => true]);
    }

    if ($action === 'rules' && $method === 'PUT') {
        requireRole(['administrator']);
        $input = payload();
        $loanPeriod = filter_var($input['loanPeriodDays'] ?? null, FILTER_VALIDATE_INT);
        $maxLoans = filter_var($input['maxActiveLoans'] ?? null, FILTER_VALIDATE_INT);
        $renewals = filter_var($input['renewalLimit'] ?? null, FILTER_VALIDATE_INT);
        $fineRate = filter_var($input['fineRatePesos'] ?? null, FILTER_VALIDATE_FLOAT);
        if ($loanPeriod === false || $loanPeriod < 1 || $loanPeriod > 365
            || $maxLoans === false || $maxLoans < 1 || $maxLoans > 50
            || $renewals === false || $renewals < 0 || $renewals > 20
            || $fineRate === false || $fineRate < 0 || $fineRate > 9999) {
            respond(['error' => 'Enter a loan period (1–365), loan limit (1–50), renewal limit (0–20), and fine rate (0–9999 pesos).'], 422);
        }
        $update = database()->prepare(
            'UPDATE library_rules SET loan_period_days = ?, max_active_loans = ?,
                renewal_limit = ?, fine_rate_pesos = ? WHERE id = 1'
        );
        $update->execute([$loanPeriod, $maxLoans, $renewals, number_format($fineRate, 2, '.', '')]);
        respond(['ok' => true]);
    }

    respond(['error' => 'Unknown API action.'], 404);
} catch (PDOException $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('BookNest database error: ' . $error->getMessage());
    if ($error->getCode() === '23000') {
        respond(['error' => 'That email address or ISBN is already in use.'], 409);
    }
    respond(['error' => 'Could not connect to BookNest data. Check the database setup and try again.'], 500);
} catch (Throwable $error) {
    error_log('BookNest API error: ' . $error->getMessage());
    respond(['error' => 'The request could not be completed. Please try again.'], 500);
}
