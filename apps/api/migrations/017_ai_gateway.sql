CREATE TABLE ai_quiz_drafts (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    lesson_id CHAR(36) NOT NULL,
    created_by CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    prompt TEXT NOT NULL,
    options_json JSON NOT NULL,
    correct_option TINYINT UNSIGNED NOT NULL,
    explanation TEXT NOT NULL,
    status ENUM('draft','approved') NOT NULL DEFAULT 'draft',
    approved_activity_id CHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    CONSTRAINT ai_draft_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT ai_draft_lesson_fk FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    CONSTRAINT ai_draft_user_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT ai_draft_activity_fk FOREIGN KEY (approved_activity_id) REFERENCES activities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_interactions (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    student_id CHAR(36) NULL,
    lesson_id CHAR(36) NOT NULL,
    interaction_type ENUM('hint','quiz_draft') NOT NULL,
    provider VARCHAR(40) NOT NULL,
    request_excerpt VARCHAR(500) NOT NULL,
    response_json JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ai_interactions_student_idx (student_id, created_at),
    CONSTRAINT ai_interaction_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT ai_interaction_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT ai_interaction_lesson_fk FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('017_ai_gateway');
