ALTER TABLE students ADD UNIQUE KEY students_id_family_unique (id, family_id);

CREATE TABLE curricula (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    title VARCHAR(160) NOT NULL,
    school_year VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    UNIQUE KEY curricula_student_year_unique (student_id, school_year),
    UNIQUE KEY curricula_id_family_unique (id, family_id),
    CONSTRAINT curricula_student_family_fk FOREIGN KEY (student_id, family_id)
        REFERENCES students (id, family_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subjects (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#2563EB',
    is_custom BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    UNIQUE KEY subjects_family_title_unique (family_id, title),
    UNIQUE KEY subjects_id_family_unique (id, family_id),
    CONSTRAINT subjects_family_fk FOREIGN KEY (family_id) REFERENCES families (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE curriculum_subjects (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    curriculum_id CHAR(36) NOT NULL,
    subject_id CHAR(36) NOT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY curriculum_subject_unique (curriculum_id, subject_id),
    UNIQUE KEY curriculum_subjects_id_family_unique (id, family_id),
    CONSTRAINT curriculum_subjects_curriculum_fk FOREIGN KEY (curriculum_id, family_id)
        REFERENCES curricula (id, family_id) ON DELETE CASCADE,
    CONSTRAINT curriculum_subjects_subject_fk FOREIGN KEY (subject_id, family_id)
        REFERENCES subjects (id, family_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sections (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    curriculum_subject_id CHAR(36) NOT NULL,
    title VARCHAR(160) NOT NULL,
    description TEXT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    UNIQUE KEY sections_id_family_unique (id, family_id),
    KEY sections_order_idx (curriculum_subject_id, position),
    CONSTRAINT sections_curriculum_subject_fk FOREIGN KEY (curriculum_subject_id, family_id)
        REFERENCES curriculum_subjects (id, family_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE topics (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    section_id CHAR(36) NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    UNIQUE KEY topics_id_family_unique (id, family_id),
    KEY topics_order_idx (section_id, position),
    CONSTRAINT topics_section_fk FOREIGN KEY (section_id, family_id)
        REFERENCES sections (id, family_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE competencies (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    topic_id CHAR(36) NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    UNIQUE KEY competencies_id_family_unique (id, family_id),
    CONSTRAINT competencies_topic_fk FOREIGN KEY (topic_id, family_id)
        REFERENCES topics (id, family_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE competency_prerequisites (
    competency_id CHAR(36) NOT NULL,
    prerequisite_id CHAR(36) NOT NULL,
    family_id CHAR(36) NOT NULL,
    PRIMARY KEY (competency_id, prerequisite_id),
    CONSTRAINT prerequisites_competency_fk FOREIGN KEY (competency_id, family_id)
        REFERENCES competencies (id, family_id) ON DELETE CASCADE,
    CONSTRAINT prerequisites_required_fk FOREIGN KEY (prerequisite_id, family_id)
        REFERENCES competencies (id, family_id) ON DELETE CASCADE,
    CONSTRAINT prerequisites_not_self_check CHECK (competency_id <> prerequisite_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lessons (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    topic_id CHAR(36) NOT NULL,
    title VARCHAR(180) NOT NULL,
    summary TEXT NULL,
    estimated_minutes SMALLINT UNSIGNED NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    UNIQUE KEY lessons_id_family_unique (id, family_id),
    KEY lessons_order_idx (topic_id, position),
    CONSTRAINT lessons_topic_fk FOREIGN KEY (topic_id, family_id)
        REFERENCES topics (id, family_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE content_blocks (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    lesson_id CHAR(36) NOT NULL,
    block_type ENUM('markdown', 'link', 'video', 'image', 'example') NOT NULL,
    content_json JSON NOT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY content_blocks_id_family_unique (id, family_id),
    KEY content_blocks_order_idx (lesson_id, position),
    CONSTRAINT content_blocks_lesson_fk FOREIGN KEY (lesson_id, family_id)
        REFERENCES lessons (id, family_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activities (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    lesson_id CHAR(36) NOT NULL,
    activity_type ENUM('practice', 'quiz', 'open_work', 'file_upload') NOT NULL,
    title VARCHAR(180) NOT NULL,
    instructions TEXT NULL,
    settings_json JSON NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    KEY activities_order_idx (lesson_id, position),
    CONSTRAINT activities_lesson_fk FOREIGN KEY (lesson_id, family_id)
        REFERENCES lessons (id, family_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('002_curriculum');
