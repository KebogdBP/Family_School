CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE families (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    role ENUM('parent') NOT NULL DEFAULT 'parent',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    UNIQUE KEY users_email_unique (email),
    KEY users_family_idx (family_id),
    CONSTRAINT users_family_fk FOREIGN KEY (family_id) REFERENCES families(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE students (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    grade TINYINT UNSIGNED NOT NULL,
    age TINYINT UNSIGNED NULL,
    pin_hash VARCHAR(255) NOT NULL,
    avatar_color VARCHAR(20) NOT NULL DEFAULT '#DBEAFE',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    KEY students_family_idx (family_id),
    CONSTRAINT students_family_fk FOREIGN KEY (family_id) REFERENCES families(id),
    CONSTRAINT students_grade_check CHECK (grade BETWEEN 1 AND 11),
    CONSTRAINT students_age_check CHECK (age IS NULL OR age BETWEEN 5 AND 19)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE parent_student_links (
    parent_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (parent_id, student_id),
    CONSTRAINT links_parent_fk FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT links_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sessions (
    id CHAR(36) PRIMARY KEY,
    token_hash CHAR(64) NOT NULL,
    family_id CHAR(36) NOT NULL,
    user_id CHAR(36) NULL,
    student_id CHAR(36) NULL,
    role ENUM('parent', 'student') NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NULL,
    UNIQUE KEY sessions_token_unique (token_hash),
    KEY sessions_expiry_idx (expires_at),
    CONSTRAINT sessions_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT sessions_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT sessions_principal_check CHECK (
        (role = 'parent' AND user_id IS NOT NULL AND student_id IS NULL)
        OR (role = 'student' AND student_id IS NOT NULL AND user_id IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_attempts (
    identity_hash CHAR(64) PRIMARY KEY,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    window_started_at DATETIME NOT NULL,
    locked_until DATETIME NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_events (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    actor_role ENUM('parent', 'student', 'system') NOT NULL,
    actor_id CHAR(36) NULL,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NULL,
    entity_id CHAR(36) NULL,
    metadata_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY audit_family_time_idx (family_id, created_at),
    CONSTRAINT audit_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('001_initial');

