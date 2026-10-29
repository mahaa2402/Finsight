-- FinSight IQ -- MySQL Schema
USE finsight;

CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(120)  NOT NULL,
    email       VARCHAR(200)  NOT NULL UNIQUE,
    password    VARCHAR(255)  NOT NULL,
    created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT             NULL,
    type         ENUM('income','expense') NOT NULL,
    category     VARCHAR(80)     NOT NULL,
    payment_mode VARCHAR(60)     NOT NULL DEFAULT 'Cash',
    description  VARCHAR(255)    NOT NULL DEFAULT '',
    amount       DECIMAL(12,2)   NOT NULL,
    date         DATE            NOT NULL,
    source       ENUM('ui','iot','import') NOT NULL DEFAULT 'ui',
    created_at   DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_date (date),
    INDEX idx_type (type),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS budgets (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT            NULL,
    category    VARCHAR(80)    NOT NULL,
    amount      DECIMAL(12,2)  NOT NULL,
    month       TINYINT        NOT NULL,
    year        SMALLINT       NOT NULL,
    created_at  DATETIME       DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_budget (user_id, category, month, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iot_devices (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    device_id    VARCHAR(64)    NOT NULL UNIQUE,
    device_name  VARCHAR(120)   NOT NULL,
    api_key      VARCHAR(128)   NOT NULL,
    is_active    TINYINT(1)     NOT NULL DEFAULT 1,
    created_at   DATETIME       DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
