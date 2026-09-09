CREATE TABLE review_attempts (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    review_schedule_id CHAR(36) NOT NULL,
    score TINYINT UNSIGNED NOT NULL,
    is_successful BOOLEAN NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY review_attempts_student_idx (student_id, created_at),
    CONSTRAINT review_attempts_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT review_attempts_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT review_attempts_schedule_fk FOREIGN KEY (review_schedule_id) REFERENCES review_schedule(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE review_attempt_answers (
    id CHAR(36) PRIMARY KEY,
    review_attempt_id CHAR(36) NOT NULL,
    question_id CHAR(36) NOT NULL,
    answer_json JSON NOT NULL,
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT review_answers_attempt_fk FOREIGN KEY (review_attempt_id) REFERENCES review_attempts(id) ON DELETE CASCADE,
    CONSTRAINT review_answers_question_fk FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('013_review_attempts');
