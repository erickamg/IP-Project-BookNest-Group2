USE booknest;

ALTER TABLE users
  ADD COLUMN role ENUM('borrower', 'librarian', 'administrator') NOT NULL DEFAULT 'borrower',
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE books
  ADD COLUMN subject VARCHAR(100) NOT NULL DEFAULT '' AFTER category,
  ADD COLUMN isbn VARCHAR(20) DEFAULT NULL AFTER subject,
  ADD COLUMN archived_at DATETIME DEFAULT NULL AFTER copies_total,
  ADD UNIQUE KEY uq_books_isbn (isbn);

UPDATE books SET subject = category WHERE subject = '';

ALTER TABLE loans
  ADD COLUMN renewals_used SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER returned_on;

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

UPDATE users SET role = 'administrator' WHERE email = 'admin@test.test';
