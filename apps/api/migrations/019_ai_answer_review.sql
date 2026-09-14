ALTER TABLE ai_interactions
    MODIFY COLUMN interaction_type ENUM('hint','quiz_draft','answer_review') NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('019_ai_answer_review');
