CREATE TABLE achievements (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    code VARCHAR(64) NOT NULL,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL,
    source_id CHAR(36) NOT NULL,
    earned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY achievements_source_unique (student_id, code, source_id),
    KEY achievements_student_time_idx (student_id, earned_at),
    CONSTRAINT achievements_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT achievements_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('011_achievements');
