CREATE TABLE subject_mastery_settings (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    curriculum_subject_id CHAR(36) NOT NULL,
    min_evidence_count TINYINT UNSIGNED NOT NULL DEFAULT 2,
    min_successful_types TINYINT UNSIGNED NOT NULL DEFAULT 2,
    review_interval_days TINYINT UNSIGNED NOT NULL DEFAULT 3,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY mastery_settings_assignment_unique (curriculum_subject_id),
    CONSTRAINT mastery_settings_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT mastery_settings_assignment_fk FOREIGN KEY (curriculum_subject_id) REFERENCES curriculum_subjects(id) ON DELETE CASCADE,
    CONSTRAINT mastery_settings_evidence_check CHECK (min_evidence_count BETWEEN 1 AND 10),
    CONSTRAINT mastery_settings_types_check CHECK (min_successful_types BETWEEN 1 AND 3),
    CONSTRAINT mastery_settings_interval_check CHECK (review_interval_days BETWEEN 1 AND 60)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('012_mastery_settings');
