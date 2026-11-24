USE booknest;

ALTER TABLE users
  ADD COLUMN profile_photo_path VARCHAR(255) DEFAULT NULL AFTER is_active;
