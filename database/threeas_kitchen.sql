-- ============================================================
--  3A's Kitchen Database — Updated Schema
--  Import this in XAMPP phpMyAdmin
--  Database: threeas_kitchendb
-- ============================================================

CREATE DATABASE IF NOT EXISTS threeas_kitchendb
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE threeas_kitchendb;

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80)         NOT NULL,
  last_name  VARCHAR(80)         NOT NULL,
  email      VARCHAR(191)        NOT NULL UNIQUE,
  password   VARCHAR(255)        NOT NULL,
  role       ENUM('c','a','r')   NOT NULL DEFAULT 'c',
  created_at TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Riders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS riders (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED        NOT NULL UNIQUE,
  mobile     VARCHAR(20)         NOT NULL,
  status     ENUM('Active','Resigned') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Menu Items ───────────────────────────────────────────────
-- is_bundle = 1 means this item appears under Bundles filter
CREATE TABLE IF NOT EXISTS items (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(191)   NOT NULL,
  description TEXT,
  price       DECIMAL(10,2)  NOT NULL,
  cost        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  available   TINYINT(1)     NOT NULL DEFAULT 1,
  is_bundle   TINYINT(1)     NOT NULL DEFAULT 0,
  image       MEDIUMTEXT,
  deleted     TINYINT(1)     NOT NULL DEFAULT 0,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Orders ───────────────────────────────────────────────────
-- delivery_fee stores barangay fee + rush fee (if any)
-- is_rush = 1 means customer requested rush delivery (+₱80)
CREATE TABLE IF NOT EXISTS orders (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED       NOT NULL,
  customer_name  VARCHAR(120)       NOT NULL,
  address        TEXT               NOT NULL,
  want_date      DATE               NOT NULL,
  is_rush        TINYINT(1)         NOT NULL DEFAULT 0,
  subtotal       DECIMAL(10,2)      NOT NULL,
  discount       DECIMAL(10,2)      NOT NULL DEFAULT 0.00,
  promo_code     VARCHAR(50)        NULL,
  delivery_fee   DECIMAL(10,2)      NOT NULL DEFAULT 80.00,
  total          DECIMAL(10,2)      NOT NULL,
  status         ENUM('Pending','Accepted','Out for delivery','Delivered','Declined')
                                    NOT NULL DEFAULT 'Pending',
  decline_reason TEXT               NULL,
  rider_id       INT UNSIGNED       NULL,
  cash_collected TINYINT(1)         NOT NULL DEFAULT 0,
  proof_image    MEDIUMTEXT         NULL,
  created_at     TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES users(id),
  FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE SET NULL
);

-- ── Order Items ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id  INT UNSIGNED  NOT NULL,
  item_id   INT UNSIGNED  NOT NULL,
  quantity  INT UNSIGNED  NOT NULL DEFAULT 1,
  price     DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id)  REFERENCES items(id)
);

-- ── Order Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_logs (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id  INT UNSIGNED  NOT NULL,
  note      VARCHAR(255)  NOT NULL,
  logged_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ── Promo Codes ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promos (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(50)           NOT NULL UNIQUE,
  type          ENUM('%','₱')         NOT NULL DEFAULT '%',
  value         DECIMAL(10,2)         NOT NULL,
  min_order     DECIMAL(10,2)         NOT NULL DEFAULT 0.00,
  expires_on    DATE                  NOT NULL,
  enabled       TINYINT(1)            NOT NULL DEFAULT 1,
  usage_limit   INT UNSIGNED          NULL,
  used_count    INT UNSIGNED          NOT NULL DEFAULT 0,
  once_per_user TINYINT(1)            NOT NULL DEFAULT 1,
  created_at    TIMESTAMP             NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Expenses ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  description  VARCHAR(255)  NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  expense_date DATE          NOT NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Feedback ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id   INT UNSIGNED  NOT NULL UNIQUE,
  user_id    INT UNSIGNED  NOT NULL,
  rating     TINYINT       NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT          NULL,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id)
);

-- ── Seed: Default Admin Account ──────────────────────────────
-- Password: Admin@3a2024  (bcrypt hash)
INSERT IGNORE INTO users (first_name, last_name, email, password, role) VALUES (
  'Admin', '3A',
  'admin@3akitchen.com',
  '$2b$10$EeZH3QF1JGCDTJD3JqpQyeoMhctNlOo4MjrRA7Zvy7zoj817pBL/2',
  'a'
);

-- ── Seed: Sample Menu Items ──────────────────────────────────
INSERT IGNORE INTO items (id, name, description, price, cost, available, is_bundle) VALUES
  (1, 'Beef Caldereta',  'Rich tomato-based beef stew',         650, 300, 1, 0),
  (2, 'Pancit Canton',   'Stir-fried noodles with vegetables',  450, 200, 1, 0),
  (3, 'Steamed Rice',    'Per serving',                          50,  20, 1, 0),
  (4, 'Lumpia Shanghai', '24 pieces per order',                 380, 150, 1, 0),
  (5, 'Chicken Adobo',   'Classic Filipino adobo',              600, 280, 1, 0),
  (6, 'Family Fiesta Tray', 'Serves 8–10: adobo, pancit, lumpia, rice', 1850, 900, 1, 1),
  (7, 'Birthday Party Set', 'Serves 15–20: four mains and dessert',     3400, 1700, 1, 1);
