CREATE DATABASE IF NOT EXISTS booknest
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE booknest;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(40) DEFAULT NULL,
  role ENUM('borrower', 'librarian', 'administrator') NOT NULL DEFAULT 'borrower',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  profile_photo_path VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS books (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  book_code VARCHAR(12) NOT NULL,
  title VARCHAR(200) NOT NULL,
  author VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL,
  subject VARCHAR(100) NOT NULL DEFAULT '',
  isbn VARCHAR(20) DEFAULT NULL,
  publication_year SMALLINT UNSIGNED NOT NULL,
  copies_total SMALLINT UNSIGNED NOT NULL,
  archived_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_books_code (book_code),
  UNIQUE KEY uq_books_isbn (isbn)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  book_id INT UNSIGNED NOT NULL,
  borrowed_on DATE NOT NULL,
  due_on DATE NOT NULL,
  returned_on DATE DEFAULT NULL,
  renewals_used SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  seed_key VARCHAR(40) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_loans_seed_key (seed_key),
  KEY ix_loans_active_book (book_id, returned_on),
  KEY ix_loans_user_history (user_id, borrowed_on),
  CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_loans_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  book_id INT UNSIGNED NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'fulfilled', 'cancelled') NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at DATETIME DEFAULT NULL,
  decided_by INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (id),
  KEY ix_reservations_queue (status, requested_at),
  KEY ix_reservations_user (user_id, status),
  CONSTRAINT fk_reservations_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_reservations_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE RESTRICT,
  CONSTRAINT fk_reservations_staff FOREIGN KEY (decided_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS library_rules (
  id TINYINT UNSIGNED NOT NULL,
  loan_period_days SMALLINT UNSIGNED NOT NULL,
  max_active_loans SMALLINT UNSIGNED NOT NULL,
  renewal_limit SMALLINT UNSIGNED NOT NULL,
  fine_rate_pesos DECIMAL(8,2) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT IGNORE INTO library_rules (id, loan_period_days, max_active_loans, renewal_limit, fine_rate_pesos)
VALUES (1, 14, 5, 2, 30.00);

INSERT IGNORE INTO users (full_name, email, password_hash, phone, role)
VALUES (
  'Khen Lim',
  'admin@test.test',
  '$2y$10$EdIo0lqH3s5wHQDBs/zbMe9aMHTs28MYYq9q9hUIFEzbYrsVuutOK',
  '+1 (555) 014-2086',
  'administrator'
);
UPDATE users SET role = 'administrator' WHERE email = 'admin@test.test';

INSERT IGNORE INTO books (book_code, title, author, category, subject, publication_year, copies_total) VALUES
  ('bk-01', 'The Creative Act', 'Rick Rubin', 'Creativity', 'Creativity', 2023, 5),
  ('bk-02', 'Designing Your Life', 'Bill Burnett & Dave Evans', 'Design', 'Design', 2016, 4),
  ('bk-03', 'Atomic Habits', 'James Clear', 'Personal Growth', 'Personal Growth', 2018, 6),
  ('bk-04', 'The Design of Everyday Things', 'Don Norman', 'Design', 'Design', 2013, 5),
  ('bk-05', 'Educated', 'Tara Westover', 'Memoir', 'Memoir', 2018, 3),
  ('bk-06', 'Project Hail Mary', 'Andy Weir', 'Science Fiction', 'Science Fiction', 2021, 4),
  ('bk-07', 'The Midnight Library', 'Matt Haig', 'Fiction', 'Fiction', 2020, 4),
  ('bk-08', 'Thinking, Fast and Slow', 'Daniel Kahneman', 'Psychology', 'Psychology', 2011, 3);

INSERT IGNORE INTO loans (user_id, book_id, borrowed_on, due_on, seed_key)
SELECT u.id, b.id, DATE_SUB(CURDATE(), INTERVAL 12 DAY), DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'demo-active-01'
FROM users u JOIN books b ON b.book_code = 'bk-01'
WHERE u.email = 'admin@test.test';

INSERT IGNORE INTO loans (user_id, book_id, borrowed_on, due_on, seed_key)
SELECT u.id, b.id, DATE_SUB(CURDATE(), INTERVAL 9 DAY), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'demo-active-02'
FROM users u JOIN books b ON b.book_code = 'bk-02'
WHERE u.email = 'admin@test.test';

INSERT IGNORE INTO loans (user_id, book_id, borrowed_on, due_on, seed_key)
SELECT u.id, b.id, DATE_SUB(CURDATE(), INTERVAL 7 DAY), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'demo-active-03'
FROM users u JOIN books b ON b.book_code = 'bk-03'
WHERE u.email = 'admin@test.test';

INSERT IGNORE INTO loans (user_id, book_id, borrowed_on, due_on, returned_on, seed_key)
SELECT u.id, b.id, DATE_SUB(CURDATE(), INTERVAL 48 DAY), DATE_SUB(CURDATE(), INTERVAL 34 DAY), DATE_SUB(CURDATE(), INTERVAL 34 DAY), 'demo-history-01'
FROM users u JOIN books b ON b.book_code = 'bk-05'
WHERE u.email = 'admin@test.test';

INSERT IGNORE INTO loans (user_id, book_id, borrowed_on, due_on, returned_on, seed_key)
SELECT u.id, b.id, DATE_SUB(CURDATE(), INTERVAL 82 DAY), DATE_SUB(CURDATE(), INTERVAL 68 DAY), DATE_SUB(CURDATE(), INTERVAL 68 DAY), 'demo-history-02'
FROM users u JOIN books b ON b.book_code = 'bk-08'
WHERE u.email = 'admin@test.test';

INSERT IGNORE INTO loans (user_id, book_id, borrowed_on, due_on, returned_on, seed_key)
SELECT u.id, b.id, DATE_SUB(CURDATE(), INTERVAL 120 DAY), DATE_SUB(CURDATE(), INTERVAL 106 DAY), DATE_SUB(CURDATE(), INTERVAL 102 DAY), 'demo-history-03'
FROM users u JOIN books b ON b.book_code = 'bk-04'
WHERE u.email = 'admin@test.test';

INSERT IGNORE INTO loans (user_id, book_id, borrowed_on, due_on, returned_on, seed_key)
SELECT u.id, b.id, DATE_SUB(CURDATE(), INTERVAL 155 DAY), DATE_SUB(CURDATE(), INTERVAL 141 DAY), DATE_SUB(CURDATE(), INTERVAL 138 DAY), 'demo-history-04'
FROM users u JOIN books b ON b.book_code = 'bk-07'
WHERE u.email = 'admin@test.test';
