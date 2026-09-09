ALTER TABLE quiz_questions
    ADD COLUMN question_type VARCHAR(32) NOT NULL DEFAULT 'single_choice' AFTER prompt,
    ADD COLUMN correct_answer_json JSON NULL AFTER correct_option,
    MODIFY COLUMN options_json JSON NULL,
    MODIFY COLUMN correct_option TINYINT UNSIGNED NULL;

UPDATE quiz_questions
SET correct_answer_json = JSON_OBJECT('options', JSON_ARRAY(correct_option))
WHERE correct_answer_json IS NULL;

ALTER TABLE quiz_answers
    ADD COLUMN answer_json JSON NULL AFTER selected_option,
    MODIFY COLUMN selected_option TINYINT UNSIGNED NULL;

UPDATE quiz_answers
SET answer_json = JSON_OBJECT('options', JSON_ARRAY(selected_option))
WHERE answer_json IS NULL;

INSERT INTO schema_migrations (version) VALUES ('009_quiz_question_types');
