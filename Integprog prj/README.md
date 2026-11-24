# BookNest local database setup

## Requirements

- XAMPP Apache and MySQL (MariaDB) running
- PHP with PDO MySQL enabled (included with XAMPP)

## Install

1. Copy the contents of the `Integprog prj` folder into `C:\xampp\htdocs\booknest\`.
2. Open `http://localhost/phpmyadmin`.
3. For a fresh install, choose **Import**, select `booknest.sql`, and run it. It creates the database, role-aware tables, demo administrator, books, and sample loans.
4. If updating the earlier BookNest database, import `booknest-role-upgrade.sql` once instead. It adds roles, reservations, ISBN/subject, renewal, and rules fields, promotes the demo account to administrator, and creates the requested defaults.
5. If updating a database that already has the role-aware schema, import `booknest-profile-upgrade.sql` once to add profile photo storage. Do not import this migration on a fresh install; its column is already in `booknest.sql`.
6. Open `http://localhost/booknest/login.html` and sign in as `admin@test.test` / `admin123`.

Public sign-up always creates a borrower account. Administrators create librarian and administrator accounts from their dashboard and can change roles or deactivate accounts. Borrowers can upload JPEG, PNG, or WebP profile pictures up to 5 MB; uploaded files are stored under `uploads/profile/`. The default library rules are 14 loan days, 5 active loans, 2 renewals, and ₱30 per overdue day.

The PHP API connects to MySQL as `root` with an empty password, which is the XAMPP default. If your local MySQL root account has a password, update the connection settings in `api.php`.

The first role-based release includes borrower requests and renewals; librarian catalog maintenance, reservation decisions, check-outs/check-ins, and borrower lists, each in its own sidebar page; and administrator overview, rule management, staff account creation, and user/role management in separate sidebar pages. Fine amounts are estimates. Payment settlement, notifications, branches/shelves, audit logs, backups, and advanced reports are not included yet.

The browser must load the pages through Apache at `http://localhost/...`; opening the HTML files directly with `file://` will not run PHP or database requests. The schema import can be run again without duplicating its demo records.
