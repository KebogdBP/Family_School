<?php

declare(strict_types=1);

namespace HomeEdu;

use PDO;

final class FamilyExportApi
{
    public static function export(PDO $db): never
    {
        $session=Auth::requireRole($db,'parent');$familyId=(string)$session['family_id'];$actorId=(string)$session['user_id'];
        Audit::record($db,$familyId,'parent',$actorId,'family.exported','family',$familyId);
        $family=self::one($db,'SELECT id,name,created_at,updated_at FROM families WHERE id=:family_id',['family_id'=>$familyId]);
        if(!$family)Http::error('not_found','Семейное пространство не найдено',404);
        $collections=[
            'parents'=>self::rows($db,'SELECT id,family_id,email,display_name,role,created_at,updated_at,deleted_at FROM users WHERE family_id=:family_id',['family_id'=>$familyId]),
            'students'=>self::rows($db,'SELECT id,family_id,display_name,grade,age,avatar_color,is_active,created_at,updated_at,deleted_at FROM students WHERE family_id=:family_id',['family_id'=>$familyId]),
        ];
        $tables=[
            'curricula'=>'id,family_id,student_id,title,school_year,is_active,created_at,updated_at,deleted_at',
            'subjects'=>'id,family_id,title,description,color,is_custom,created_at,updated_at,deleted_at',
            'curriculumSubjects'=>'id,family_id,curriculum_id,subject_id,position,created_at',
            'sections'=>'id,family_id,curriculum_subject_id,title,description,position,created_at,updated_at,deleted_at',
            'topics'=>'id,family_id,section_id,title,description,position,created_at,updated_at,deleted_at',
            'competencies'=>'id,family_id,topic_id,title,description,created_at,updated_at,deleted_at',
            'competencyPrerequisites'=>'competency_id,prerequisite_id,family_id',
            'lessons'=>'id,family_id,topic_id,title,summary,estimated_minutes,position,status,created_at,updated_at,deleted_at',
            'contentBlocks'=>'id,family_id,lesson_id,block_type,content_json,position,created_at,updated_at',
            'activities'=>'id,family_id,lesson_id,activity_type,title,instructions,settings_json,position,created_at,updated_at,deleted_at',
            'lessonProgress'=>'id,family_id,student_id,lesson_id,status,last_block_position,started_at,completed_at,updated_at',
            'weeklyPlans'=>'id,family_id,student_id,week_start,created_at,updated_at',
            'planItems'=>'id,family_id,weekly_plan_id,lesson_id,scheduled_date,is_required,position,created_at',
            'studentReflections'=>'id,family_id,student_id,lesson_id,feeling,comment,created_at,updated_at',
            'quizQuestions'=>'id,family_id,activity_id,prompt,question_type,options_json,correct_option,correct_answer_json,explanation,created_at',
            'quizAttempts'=>'id,family_id,student_id,activity_id,score,created_at',
            'homeworkSubmissions'=>'id,family_id,student_id,activity_id,response_text,status,submitted_at,created_at,updated_at',
            'submissionFiles'=>'id,family_id,submission_id,original_name,mime_type,size_bytes,created_at',
            'submissionReviews'=>'id,family_id,submission_id,reviewer_id,decision,grade,comment,created_at',
            'masteryEvidence'=>'id,family_id,student_id,topic_id,evidence_type,source_id,is_successful,score,explanation,created_at',
            'masteryStates'=>'id,family_id,student_id,topic_id,status,evidence_count,successful_count,score,last_evidence_at,next_review_at,updated_at',
            'reviewSchedule'=>'id,family_id,student_id,topic_id,due_date,reason,status,created_at,completed_at',
            'achievements'=>'id,family_id,student_id,code,title,description,source_id,earned_at',
            'subjectMasterySettings'=>'id,family_id,curriculum_subject_id,min_evidence_count,min_successful_types,review_interval_days,created_at,updated_at',
            'reviewAttempts'=>'id,family_id,student_id,review_schedule_id,score,is_successful,created_at',
            'reviewQuestionSettings'=>'id,family_id,student_id,topic_id,question_id,position,created_at',
            'auditEvents'=>'id,family_id,actor_role,actor_id,event_type,entity_type,entity_id,metadata_json,created_at',
        ];
        foreach($tables as $key=>$columns){$table=self::tableName($key);$collections[$key]=self::rows($db,"SELECT $columns FROM $table WHERE family_id=:family_id",['family_id'=>$familyId]);}
        $collections['parentStudentLinks']=self::rows($db,'SELECT psl.parent_id,psl.student_id,psl.created_at FROM parent_student_links psl JOIN users u ON u.id=psl.parent_id WHERE u.family_id=:family_id',['family_id'=>$familyId]);
        $collections['quizAnswers']=self::rows($db,'SELECT qa.id,qa.attempt_id,qa.question_id,qa.selected_option,qa.answer_json,qa.is_correct,qa.created_at FROM quiz_answers qa JOIN quiz_attempts qz ON qz.id=qa.attempt_id WHERE qz.family_id=:family_id',['family_id'=>$familyId]);
        $collections['reviewAttemptAnswers']=self::rows($db,'SELECT raa.id,raa.review_attempt_id,raa.question_id,raa.answer_json,raa.is_correct,raa.created_at FROM review_attempt_answers raa JOIN review_attempts ra ON ra.id=raa.review_attempt_id WHERE ra.family_id=:family_id',['family_id'=>$familyId]);
        $collections=self::decodeJson($collections);
        header('Content-Disposition: attachment; filename="homeedu-family-'.date('Y-m-d').'.json"');header('Cache-Control: no-store');
        Http::json(['schemaVersion'=>1,'generatedAt'=>date(DATE_ATOM),'family'=>$family,'data'=>$collections]);
    }

    private static function tableName(string $key): string
    {
        return match($key){'curriculumSubjects'=>'curriculum_subjects','competencyPrerequisites'=>'competency_prerequisites','contentBlocks'=>'content_blocks','lessonProgress'=>'lesson_progress','weeklyPlans'=>'weekly_plans','planItems'=>'plan_items','studentReflections'=>'student_reflections','quizQuestions'=>'quiz_questions','quizAttempts'=>'quiz_attempts','homeworkSubmissions'=>'homework_submissions','submissionFiles'=>'submission_files','submissionReviews'=>'submission_reviews','masteryEvidence'=>'mastery_evidence','masteryStates'=>'mastery_states','reviewSchedule'=>'review_schedule','subjectMasterySettings'=>'subject_mastery_settings','reviewAttempts'=>'review_attempts','reviewQuestionSettings'=>'review_question_settings','auditEvents'=>'audit_events',default=>$key};
    }

    /** @param array<string,mixed> $params @return array<int,array<string,mixed>> */
    private static function rows(PDO $db,string $sql,array $params): array{$statement=$db->prepare($sql);$statement->execute($params);return $statement->fetchAll();}
    /** @param array<string,mixed> $params @return array<string,mixed>|false */
    private static function one(PDO $db,string $sql,array $params): array|false{$rows=self::rows($db,$sql,$params);return $rows[0]??false;}
    /** @param array<string,mixed> $collections @return array<string,mixed> */
    private static function decodeJson(array $collections): array
    {
        foreach($collections as &$rows)foreach($rows as &$row)foreach(['content_json','settings_json','options_json','correct_answer_json','answer_json','metadata_json'] as $column)if(array_key_exists($column,$row)&&$row[$column]!==null)$row[$column]=json_decode((string)$row[$column],true,flags:JSON_THROW_ON_ERROR);
        unset($rows,$row);return $collections;
    }
}
