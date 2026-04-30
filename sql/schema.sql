CREATE TABLE games (
  npwr            VARCHAR(16) PRIMARY KEY,
  title_name      VARCHAR(255) NOT NULL,
  title_platform  VARCHAR(64)  NOT NULL,
  trophy_set_ver  VARCHAR(32)  NULL,
  has_groups      TINYINT(1)   NOT NULL DEFAULT 0,
  icon_url        TEXT         NULL,

  igdb_id         BIGINT       NULL,
  igdb_name       VARCHAR(255) NULL,
  first_release   DATE         NULL,

  first_seen_utc  DATETIME     NOT NULL,
  last_seen_utc   DATETIME     NOT NULL,
  last_scan_utc   DATETIME     NOT NULL,

  INDEX idx_last_seen (last_seen_utc),
  INDEX idx_platform (title_platform),
  INDEX idx_igdb (igdb_id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trophy_groups (
  npwr           VARCHAR(16) NOT NULL,
  group_id       VARCHAR(8)  NOT NULL,
  group_name     VARCHAR(255) NULL,
  detail         TEXT         NULL,
  icon_url       TEXT         NULL,
  defined_total  INT          NULL,

  PRIMARY KEY (npwr, group_id),
  CONSTRAINT fk_group_game FOREIGN KEY (npwr) REFERENCES games(npwr)
    ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trophies (
  npwr           VARCHAR(16) NOT NULL,
  group_id       VARCHAR(8)  NOT NULL,
  trophy_id      INT         NOT NULL,
  trophy_name    VARCHAR(255) NOT NULL,
  trophy_detail  TEXT         NULL,
  trophy_type    VARCHAR(16)  NOT NULL,
  hidden         TINYINT(1)   NOT NULL DEFAULT 0,
  icon_url       TEXT         NULL,

  PRIMARY KEY (npwr, group_id, trophy_id),
  CONSTRAINT fk_trophy_group FOREIGN KEY (npwr, group_id)
    REFERENCES trophy_groups(npwr, group_id)
    ON DELETE CASCADE,

  INDEX idx_type (trophy_type)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE scan_state (
  shard_index INT PRIMARY KEY,
  scan_cursor INT NOT NULL DEFAULT 0,
  updated_utc DATETIME NOT NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delisted_npwrs (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  npwr            VARCHAR(16) NOT NULL,
  reason          VARCHAR(255) NULL,
  removed_utc     DATETIME NOT NULL,

  INDEX idx_npwr (npwr),
  INDEX idx_removed (removed_utc)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
