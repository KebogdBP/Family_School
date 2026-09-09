ALTER TABLE mastery_evidence MODIFY evidence_type ENUM('quiz','homework','review','diagnostic') NOT NULL;

ALTER TABLE pilot_content_installs ADD COLUMN section_id CHAR(36) NULL AFTER curriculum_id;
UPDATE pilot_content_installs pci
JOIN sections se ON se.family_id=pci.family_id
JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id AND cs.curriculum_id=pci.curriculum_id
SET pci.section_id=se.id
WHERE (pci.route_code='david-fractions-grade-4-v1' AND se.title='Дроби')
   OR (pci.route_code='sara-common-fractions-grade-6-v1' AND se.title='Обыкновенные дроби');
ALTER TABLE pilot_content_installs ADD CONSTRAINT pilot_content_section_fk FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;

CREATE TABLE diagnostic_attempts (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    route_code VARCHAR(80) NOT NULL,
    score TINYINT UNSIGNED NOT NULL,
    answers_json JSON NOT NULL,
    recommended_topic_id CHAR(36) NOT NULL,
    recommended_lesson_id CHAR(36) NOT NULL,
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY diagnostic_student_route_unique (student_id, route_code),
    CONSTRAINT diagnostic_family_fk FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    CONSTRAINT diagnostic_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT diagnostic_topic_fk FOREIGN KEY (recommended_topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    CONSTRAINT diagnostic_lesson_fk FOREIGN KEY (recommended_lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('016_diagnostics');
