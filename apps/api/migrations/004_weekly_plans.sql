CREATE TABLE weekly_plans (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    week_start DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY weekly_plans_student_week_unique (student_id, week_start),
    CONSTRAINT weekly_plans_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT weekly_plans_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE plan_items (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    weekly_plan_id CHAR(36) NOT NULL,
    lesson_id CHAR(36) NOT NULL,
    scheduled_date DATE NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY plan_items_lesson_date_unique (weekly_plan_id, lesson_id, scheduled_date),
    KEY plan_items_date_idx (scheduled_date, position),
    CONSTRAINT plan_items_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT plan_items_plan_fk FOREIGN KEY (weekly_plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE,
    CONSTRAINT plan_items_lesson_fk FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('004_weekly_plans');
