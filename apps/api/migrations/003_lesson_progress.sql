CREATE TABLE lesson_progress (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    lesson_id CHAR(36) NOT NULL,
    status ENUM('in_progress', 'completed') NOT NULL DEFAULT 'in_progress',
    last_block_position INT UNSIGNED NOT NULL DEFAULT 0,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY lesson_progress_student_lesson_unique (student_id, lesson_id),
    KEY lesson_progress_family_idx (family_id),
    KEY lesson_progress_lesson_idx (lesson_id),
    CONSTRAINT lesson_progress_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT lesson_progress_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT lesson_progress_lesson_fk FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('003_lesson_progress');
