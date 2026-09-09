CREATE TABLE submission_files (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    submission_id CHAR(36) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    storage_name VARCHAR(100) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY submission_files_storage_unique (storage_name),
    KEY submission_files_submission_idx (submission_id),
    CONSTRAINT submission_files_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT submission_files_submission_fk FOREIGN KEY (submission_id) REFERENCES homework_submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('008_submission_files');
