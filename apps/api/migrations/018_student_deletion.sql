ALTER TABLE curricula DROP FOREIGN KEY curricula_student_family_fk;
ALTER TABLE curricula ADD CONSTRAINT curricula_student_family_fk
    FOREIGN KEY (student_id, family_id) REFERENCES students (id, family_id) ON DELETE CASCADE;

INSERT INTO schema_migrations (version) VALUES ('018_student_deletion');
