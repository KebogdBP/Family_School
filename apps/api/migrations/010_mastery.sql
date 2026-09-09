CREATE TABLE mastery_evidence (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    topic_id CHAR(36) NOT NULL,
    evidence_type ENUM('quiz','homework','review') NOT NULL,
    source_id CHAR(36) NOT NULL,
    is_successful BOOLEAN NOT NULL,
    score TINYINT UNSIGNED NULL,
    explanation VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY mastery_evidence_source_unique (student_id, evidence_type, source_id),
    KEY mastery_evidence_topic_idx (student_id, topic_id, created_at),
    CONSTRAINT mastery_evidence_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT mastery_evidence_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT mastery_evidence_topic_fk FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mastery_states (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    topic_id CHAR(36) NOT NULL,
    status ENUM('learning','needs_reinforcement','mastered') NOT NULL DEFAULT 'learning',
    evidence_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    successful_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    score TINYINT UNSIGNED NOT NULL DEFAULT 0,
    last_evidence_at DATETIME NOT NULL,
    next_review_at DATE NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY mastery_state_student_topic_unique (student_id, topic_id),
    KEY mastery_state_review_idx (student_id, next_review_at),
    CONSTRAINT mastery_state_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT mastery_state_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT mastery_state_topic_fk FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE review_schedule (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    topic_id CHAR(36) NOT NULL,
    due_date DATE NOT NULL,
    reason VARCHAR(500) NOT NULL,
    status ENUM('pending','completed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    UNIQUE KEY review_schedule_topic_unique (student_id, topic_id),
    CONSTRAINT review_schedule_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT review_schedule_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT review_schedule_topic_fk FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('010_mastery');
