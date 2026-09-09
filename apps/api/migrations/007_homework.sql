CREATE TABLE homework_submissions (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    activity_id CHAR(36) NOT NULL,
    response_text TEXT NOT NULL,
    status ENUM('draft','submitted','needs_revision','reviewed') NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY homework_student_activity_unique (student_id, activity_id),
    KEY homework_review_queue_idx (family_id, status, submitted_at),
    CONSTRAINT homework_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT homework_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT homework_activity_fk FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE submission_reviews (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    submission_id CHAR(36) NOT NULL,
    reviewer_id CHAR(36) NOT NULL,
    decision ENUM('accepted','needs_revision') NOT NULL,
    grade TINYINT UNSIGNED NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY reviews_submission_idx (submission_id, created_at),
    CONSTRAINT reviews_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT reviews_submission_fk FOREIGN KEY (submission_id) REFERENCES homework_submissions(id) ON DELETE CASCADE,
    CONSTRAINT reviews_reviewer_fk FOREIGN KEY (reviewer_id) REFERENCES users(id),
    CONSTRAINT reviews_grade_check CHECK (grade IS NULL OR grade BETWEEN 2 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('007_homework');
