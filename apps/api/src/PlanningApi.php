<?php

declare(strict_types=1);

namespace HomeEdu;

use DateTimeImmutable;
use PDO;

final class PlanningApi
{
    public static function dispatch(PDO $db, string $method, string $path): never
    {
        $session = Auth::requireRole($db, 'parent');
        $familyId = (string) $session['family_id'];
        $actorId = (string) $session['user_id'];
        match (true) {
            $method === 'GET' && preg_match('#^/api/v1/students/([0-9a-f-]{36})/weekly-plan$#', $path, $m) === 1
                => self::getPlan($db, $familyId, $m[1]),
            $method === 'GET' && preg_match('#^/api/v1/students/([0-9a-f-]{36})/progress-report$#', $path, $m) === 1
                => self::progressReport($db, $familyId, $m[1]),
            $method === 'GET' && preg_match('#^/api/v1/students/([0-9a-f-]{36})/topics/([0-9a-f-]{36})/review-questions$#', $path, $m) === 1
                => self::reviewQuestions($db, $familyId, $m[1], $m[2]),
            $method === 'PUT' && preg_match('#^/api/v1/students/([0-9a-f-]{36})/topics/([0-9a-f-]{36})/review-questions$#', $path, $m) === 1
                => self::saveReviewQuestions($db, $familyId, $actorId, $m[1], $m[2]),
            $method === 'POST' && preg_match('#^/api/v1/students/([0-9a-f-]{36})/plan-items$#', $path, $m) === 1
                => self::addItem($db, $familyId, $actorId, $m[1]),
            $method === 'DELETE' && preg_match('#^/api/v1/plan-items/([0-9a-f-]{36})$#', $path, $m) === 1
                => self::removeItem($db, $familyId, $actorId, $m[1]),
            $method === 'PATCH' && preg_match('#^/api/v1/review-schedules/([0-9a-f-]{36})$#', $path, $m) === 1
                => self::rescheduleReview($db, $familyId, $actorId, $m[1]),
            default => Http::error('not_found', 'Маршрут не найден', 404),
        };
    }

    private static function getPlan(PDO $db, string $familyId, string $studentId): never
    {
        self::assertStudent($db, $familyId, $studentId);
        $weekStart = self::weekStart((string) ($_GET['weekStart'] ?? date('Y-m-d')));
        $weekEnd = $weekStart->modify('+6 days')->format('Y-m-d');
        $lessons = $db->prepare(
            'SELECT l.id, l.title, s.title AS subject_title, s.color AS subject_color
             FROM curricula c JOIN curriculum_subjects cs ON cs.curriculum_id=c.id
             JOIN subjects s ON s.id=cs.subject_id AND s.deleted_at IS NULL
             JOIN sections se ON se.curriculum_subject_id=cs.id AND se.deleted_at IS NULL
             JOIN topics t ON t.section_id=se.id AND t.deleted_at IS NULL
             JOIN lessons l ON l.topic_id=t.id AND l.deleted_at IS NULL
             WHERE c.student_id=:student_id AND c.family_id=:family_id AND c.is_active=TRUE AND c.deleted_at IS NULL
             ORDER BY cs.position,se.position,t.position,l.position'
        );
        $lessons->execute(['student_id' => $studentId, 'family_id' => $familyId]);
        $items = $db->prepare(
            'SELECT pi.id, pi.lesson_id, pi.scheduled_date, pi.is_required, pi.position,
                    l.title, s.title AS subject_title, s.color AS subject_color,
                    COALESCE(lp.status, \'not_started\') AS progress_status,
                    COALESCE(hw.homework_count,0) AS homework_count,COALESCE(hw.draft_count,0) AS draft_count,
                    COALESCE(hw.submitted_count,0) AS submitted_count,COALESCE(hw.revision_count,0) AS revision_count,
                    COALESCE(hw.reviewed_count,0) AS reviewed_count,
                    COALESCE(qz.quiz_count,0) AS quiz_count,COALESCE(qz.attempted_quiz_count,0) AS attempted_quiz_count
             FROM weekly_plans wp JOIN plan_items pi ON pi.weekly_plan_id=wp.id
             JOIN lessons l ON l.id=pi.lesson_id JOIN topics t ON t.id=l.topic_id
             JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id
             JOIN subjects s ON s.id=cs.subject_id
             LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.student_id=wp.student_id
             LEFT JOIN (SELECT a.lesson_id,COUNT(*) AS homework_count,
                               SUM(hs.status=\'draft\') AS draft_count,SUM(hs.status=\'submitted\') AS submitted_count,
                               SUM(hs.status=\'needs_revision\') AS revision_count,SUM(hs.status=\'reviewed\') AS reviewed_count
                        FROM activities a LEFT JOIN homework_submissions hs ON hs.activity_id=a.id AND hs.student_id=:homework_student
                        WHERE a.activity_type=\'open_work\' AND a.deleted_at IS NULL GROUP BY a.lesson_id) hw ON hw.lesson_id=l.id
             LEFT JOIN (SELECT a.lesson_id,COUNT(DISTINCT a.id) AS quiz_count,COUNT(DISTINCT qa.activity_id) AS attempted_quiz_count
                        FROM activities a LEFT JOIN quiz_attempts qa ON qa.activity_id=a.id AND qa.student_id=:quiz_student
                        WHERE a.activity_type=\'quiz\' AND a.deleted_at IS NULL GROUP BY a.lesson_id) qz ON qz.lesson_id=l.id
             WHERE wp.student_id=:student_id AND wp.family_id=:family_id AND pi.scheduled_date BETWEEN :start AND :end
             ORDER BY pi.scheduled_date,pi.position,pi.created_at'
        );
        $items->execute(['homework_student'=>$studentId,'quiz_student'=>$studentId,'student_id' => $studentId, 'family_id' => $familyId, 'start' => $weekStart->format('Y-m-d'), 'end' => $weekEnd]);
        Http::json(['weekStart' => $weekStart->format('Y-m-d'), 'weekEnd' => $weekEnd,
            'availableLessons' => array_map([self::class, 'lesson'], $lessons->fetchAll()),
            'items' => array_map([self::class, 'item'], $items->fetchAll())]);
    }

    private static function addItem(PDO $db, string $familyId, string $actorId, string $studentId): never
    {
        self::assertStudent($db, $familyId, $studentId);
        $body = Http::body();
        $lessonId = (string) ($body['lessonId'] ?? '');
        $date = self::date((string) ($body['scheduledDate'] ?? ''));
        self::assertAssignedLesson($db, $familyId, $studentId, $lessonId);
        $weekStart = self::weekStart($date)->format('Y-m-d');
        $lookup = $db->prepare('SELECT id FROM weekly_plans WHERE student_id=:student_id AND week_start=:week_start');
        $lookup->execute(['student_id' => $studentId, 'week_start' => $weekStart]);
        $planId = $lookup->fetchColumn();
        if (!$planId) {
            $planId = Uuid::v4();
            try {
                $db->prepare('INSERT INTO weekly_plans (id,family_id,student_id,week_start) VALUES (:id,:family_id,:student_id,:week_start)')
                    ->execute(['id' => $planId, 'family_id' => $familyId, 'student_id' => $studentId, 'week_start' => $weekStart]);
            } catch (\PDOException $error) {
                if ($error->getCode() !== '23000') throw $error;
                $lookup->execute(['student_id' => $studentId, 'week_start' => $weekStart]);
                $planId = $lookup->fetchColumn();
                if (!$planId) throw $error;
            }
        }
        $id = Uuid::v4();
        try {
            $db->prepare('INSERT INTO plan_items (id,family_id,weekly_plan_id,lesson_id,scheduled_date,is_required,position) VALUES (:id,:family_id,:plan_id,:lesson_id,:date,:required,:position)')
                ->execute(['id' => $id, 'family_id' => $familyId, 'plan_id' => $planId, 'lesson_id' => $lessonId, 'date' => $date, 'required' => ($body['isRequired'] ?? true) === true ? 1 : 0, 'position' => max(0, (int) ($body['position'] ?? 0))]);
        } catch (\PDOException $error) {
            if ($error->getCode() === '23000') Http::error('duplicate_plan_item', 'Этот урок уже назначен на выбранный день', 409);
            throw $error;
        }
        Audit::record($db, $familyId, 'parent', $actorId, 'plan_item.created', 'plan_item', $id);
        Http::json(['planItem' => ['id' => $id]], 201);
    }

    private static function progressReport(PDO $db, string $familyId, string $studentId): never
    {
        self::assertStudent($db, $familyId, $studentId);
        $statement = $db->prepare(
            'SELECT pi.id, pi.scheduled_date, pi.is_required, l.id AS lesson_id, l.title,
                    s.title AS subject_title, s.color AS subject_color,
                    COALESCE(lp.status, \'not_started\') AS progress_status, lp.started_at, lp.completed_at,
                    sr.feeling, sr.comment, sr.updated_at AS reflected_at,
                    COALESCE(hw.homework_count,0) AS homework_count,COALESCE(hw.draft_count,0) AS draft_count,
                    COALESCE(hw.submitted_count,0) AS submitted_count,COALESCE(hw.revision_count,0) AS revision_count,
                    COALESCE(hw.reviewed_count,0) AS reviewed_count,
                    COALESCE(qz.quiz_count,0) AS quiz_count,COALESCE(qz.attempted_quiz_count,0) AS attempted_quiz_count
             FROM weekly_plans wp JOIN plan_items pi ON pi.weekly_plan_id=wp.id
             JOIN lessons l ON l.id=pi.lesson_id JOIN topics t ON t.id=l.topic_id
             JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id
             JOIN subjects s ON s.id=cs.subject_id
             LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.student_id=wp.student_id
             LEFT JOIN student_reflections sr ON sr.lesson_id=l.id AND sr.student_id=wp.student_id
             LEFT JOIN (SELECT a.lesson_id,COUNT(*) AS homework_count,
                               SUM(hs.status=\'draft\') AS draft_count,SUM(hs.status=\'submitted\') AS submitted_count,
                               SUM(hs.status=\'needs_revision\') AS revision_count,SUM(hs.status=\'reviewed\') AS reviewed_count
                        FROM activities a LEFT JOIN homework_submissions hs ON hs.activity_id=a.id AND hs.student_id=:homework_student
                        WHERE a.activity_type=\'open_work\' AND a.deleted_at IS NULL GROUP BY a.lesson_id) hw ON hw.lesson_id=l.id
             LEFT JOIN (SELECT a.lesson_id,COUNT(DISTINCT a.id) AS quiz_count,COUNT(DISTINCT qa.activity_id) AS attempted_quiz_count
                        FROM activities a LEFT JOIN quiz_attempts qa ON qa.activity_id=a.id AND qa.student_id=:quiz_student
                        WHERE a.activity_type=\'quiz\' AND a.deleted_at IS NULL GROUP BY a.lesson_id) qz ON qz.lesson_id=l.id
             WHERE wp.student_id=:student_id AND wp.family_id=:family_id
             ORDER BY pi.scheduled_date DESC, pi.position'
        );
        $statement->execute(['homework_student'=>$studentId,'quiz_student'=>$studentId,'student_id' => $studentId, 'family_id' => $familyId]);
        $items = array_map(static fn (array $row): array => [
            'id'=>$row['id'],'lessonId'=>$row['lesson_id'],'title'=>$row['title'],'subjectTitle'=>$row['subject_title'],'subjectColor'=>$row['subject_color'],
            'scheduledDate'=>$row['scheduled_date'],'isRequired'=>(bool)$row['is_required'],'progressStatus'=>$row['progress_status'],'planStatus'=>self::planStatus($row),
            'startedAt'=>$row['started_at'],'completedAt'=>$row['completed_at'],
            'reflection'=>$row['feeling'] ? ['feeling'=>$row['feeling'],'comment'=>$row['comment'],'updatedAt'=>$row['reflected_at']] : null,
        ], $statement->fetchAll());
        $summary = ['total'=>count($items),'notStarted'=>0,'inProgress'=>0,'completed'=>0,'needsHelp'=>0];
        foreach ($items as $item) {
            $key = match ($item['progressStatus']) { 'completed'=>'completed','in_progress'=>'inProgress',default=>'notStarted' };
            $summary[$key]++;
            if (($item['reflection']['feeling'] ?? null) === 'need_help') $summary['needsHelp']++;
        }
        $mastery=Mastery::topics($db,$familyId,$studentId);
        $summary['masteredTopics']=count(array_filter($mastery,static fn(array $topic):bool=>$topic['status']==='mastered'));
        $summary['topicsToReview']=count(array_filter($mastery,static fn(array $topic):bool=>$topic['status']==='needs_reinforcement'));
        $achievements=Achievements::list($db,$familyId,$studentId);$summary['achievements']=count($achievements);
        $reviewTasks=Mastery::reviewTasks($db,$familyId,$studentId);
        Http::json(['summary'=>$summary,'dailyDigest'=>self::dailyDigest($items),'weeklyDigest'=>self::weeklyDigest($db,$familyId,$studentId,$items,$mastery,$reviewTasks),'items'=>$items,'reviewTasks'=>$reviewTasks,'masterySubjects'=>Mastery::subjects($db,$familyId,$studentId),'mastery'=>$mastery,'achievements'=>$achievements]);
    }

    /** @param array<int,array<string,mixed>> $items @return array<string,mixed> */
    private static function dailyDigest(array $items): array
    {
        $today=date('Y-m-d');$todayItems=array_values(array_filter($items,static fn(array $item):bool=>$item['scheduledDate']===$today));
        $counts=['assigned'=>0,'inProgress'=>0,'submitted'=>0,'needsRevision'=>0,'reviewed'=>0,'completedLessons'=>0,'needsHelp'=>0];$attention=[];
        foreach($todayItems as $item){
            $key=match($item['planStatus']){'in_progress'=>'inProgress','needs_revision'=>'needsRevision',default=>$item['planStatus']};$counts[$key]++;
            if($item['progressStatus']==='completed')$counts['completedLessons']++;
            $reasons=[];if($item['planStatus']==='needs_revision')$reasons[]='работу нужно доработать';if(($item['reflection']['feeling']??null)==='need_help'){$counts['needsHelp']++;$reasons[]='ребёнок попросил помощи';}
            if($reasons!==[])$attention[]=['id'=>$item['id'],'lessonId'=>$item['lessonId'],'title'=>$item['title'],'subjectTitle'=>$item['subjectTitle'],'reasons'=>$reasons];
        }
        $planned=count($todayItems);$message=$planned===0?'На сегодня заданий нет.':($attention!==[]?'Есть задания, которым нужно внимание.':($counts['reviewed']===$planned?'План на сегодня полностью выполнен и проверен.':"Проверено {$counts['reviewed']} из {$planned} заданий на сегодня."));
        return ['date'=>$today,'planned'=>$planned,...$counts,'attention'=>$attention,'message'=>$message];
    }

    /** @param array<int,array<string,mixed>> $items @param array<int,array<string,mixed>> $mastery @param array<int,array<string,mixed>> $reviewTasks @return array<string,mixed> */
    private static function weeklyDigest(PDO $db,string $familyId,string $studentId,array $items,array $mastery,array $reviewTasks): array
    {
        $start=(new DateTimeImmutable('today'))->modify('monday this week');$end=$start->modify('+6 days');$startDate=$start->format('Y-m-d');$endDate=$end->format('Y-m-d');
        $weekItems=array_values(array_filter($items,static fn(array $item):bool=>$item['scheduledDate']>=$startDate&&$item['scheduledDate']<=$endDate));
        $reviewed=count(array_filter($weekItems,static fn(array $item):bool=>$item['planStatus']==='reviewed'));
        $completedLessons=count(array_filter($weekItems,static fn(array $item):bool=>$item['progressStatus']==='completed'));

        $masteredStatement=$db->prepare('SELECT t.id,t.title,s.title AS subject_title FROM achievements a JOIN topics t ON t.id=a.source_id JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id JOIN subjects s ON s.id=cs.subject_id WHERE a.family_id=:family_id AND a.student_id=:student_id AND a.code=\'durable_mastery\' AND DATE(a.earned_at) BETWEEN :week_start AND :week_end ORDER BY a.earned_at DESC');
        $masteredStatement->execute(['family_id'=>$familyId,'student_id'=>$studentId,'week_start'=>$startDate,'week_end'=>$endDate]);
        $masteredTopics=array_map(static fn(array $row):array=>['id'=>$row['id'],'title'=>$row['title'],'subjectTitle'=>$row['subject_title']],$masteredStatement->fetchAll());
        $completedStatement=$db->prepare('SELECT t.id,t.title,s.title AS subject_title,DATE(rs.completed_at) AS completed_date FROM review_schedule rs JOIN topics t ON t.id=rs.topic_id JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id JOIN subjects s ON s.id=cs.subject_id WHERE rs.family_id=:family_id AND rs.student_id=:student_id AND rs.status=\'completed\' AND DATE(rs.completed_at) BETWEEN :week_start AND :week_end ORDER BY rs.completed_at DESC');
        $completedStatement->execute(['family_id'=>$familyId,'student_id'=>$studentId,'week_start'=>$startDate,'week_end'=>$endDate]);
        $completedReviews=array_map(static fn(array $row):array=>['id'=>$row['id'],'title'=>$row['title'],'subjectTitle'=>$row['subject_title'],'completedDate'=>$row['completed_date']],$completedStatement->fetchAll());

        $difficulties=[];$suggestions=[];
        foreach($weekItems as $item){
            $reasons=[];if($item['planStatus']==='needs_revision')$reasons[]='нужна доработка';if(($item['reflection']['feeling']??null)==='need_help')$reasons[]='ребёнок попросил помощи';
            if($reasons!==[]){$difficulties[$item['lessonId']]=['id'=>$item['lessonId'],'title'=>$item['title'],'subjectTitle'=>$item['subjectTitle'],'reason'=>implode(' · ',$reasons)];$suggestions['lesson-'.$item['lessonId']]=['kind'=>'lesson','title'=>'Вернуться к уроку «'.$item['title'].'»','reason'=>implode(' · ',$reasons)];}
            elseif($item['isRequired']&&in_array($item['planStatus'],['assigned','in_progress'],true))$suggestions['lesson-'.$item['lessonId']]=['kind'=>'lesson','title'=>'Завершить «'.$item['title'].'»','reason'=>'обязательное задание текущей недели ещё не завершено'];
        }
        foreach($mastery as $topic)if($topic['status']==='needs_reinforcement'){$difficulties['topic-'.$topic['id']]=['id'=>$topic['id'],'title'=>$topic['title'],'subjectTitle'=>$topic['subjectTitle'],'reason'=>'тема требует закрепления'];}
        foreach($reviewTasks as $task)$suggestions['review-'.$task['topicId']]=['kind'=>'review','title'=>'Повторить тему «'.$task['topicTitle'].'»','reason'=>$task['isDue']?'повторение уже доступно':'повторение назначено на '.$task['dueDate']];
        foreach($mastery as $topic)if($topic['status']==='needs_reinforcement'&&!isset($suggestions['review-'.$topic['id']]))$suggestions['topic-'.$topic['id']]=['kind'=>'topic','title'=>'Добавить практику по теме «'.$topic['title'].'»','reason'=>'по теме недостаточно устойчивых подтверждений'];
        $planned=count($weekItems);$percent=$planned===0?0:(int)round($reviewed/$planned*100);
        return ['weekStart'=>$startDate,'weekEnd'=>$endDate,'planned'=>$planned,'reviewed'=>$reviewed,'completedLessons'=>$completedLessons,'completionPercent'=>$percent,'masteredTopics'=>$masteredTopics,'completedReviews'=>$completedReviews,'difficulties'=>array_values($difficulties),'suggestions'=>array_slice(array_values($suggestions),0,6)];
    }

    private static function removeItem(PDO $db, string $familyId, string $actorId, string $id): never
    {
        $statement = $db->prepare('DELETE FROM plan_items WHERE id=:id AND family_id=:family_id');
        $statement->execute(['id' => $id, 'family_id' => $familyId]);
        if ($statement->rowCount() === 0) Http::error('not_found', 'Пункт плана не найден', 404);
        Audit::record($db, $familyId, 'parent', $actorId, 'plan_item.deleted', 'plan_item', $id);
        Http::json(['status' => 'ok']);
    }

    private static function reviewQuestions(PDO $db, string $familyId, string $studentId, string $topicId): never
    {
        self::assertStudentTopic($db, $familyId, $studentId, $topicId);
        $statement = $db->prepare(
            'SELECT q.id, q.prompt, q.question_type, a.title, l.title AS lesson_title,
                    rqs.position AS selected_position
             FROM lessons l JOIN activities a ON a.lesson_id=l.id AND a.activity_type=\'quiz\' AND a.deleted_at IS NULL
             JOIN quiz_questions q ON q.activity_id=a.id
             LEFT JOIN review_question_settings rqs ON rqs.question_id=q.id AND rqs.topic_id=:selected_topic
             WHERE l.topic_id=:topic_id AND l.deleted_at IS NULL
             ORDER BY a.position,a.created_at'
        );
        $statement->execute(['selected_topic'=>$topicId,'topic_id'=>$topicId]);
        $rows=$statement->fetchAll();
        $explicit=array_values(array_filter($rows,static fn(array $row):bool=>$row['selected_position']!==null));
        usort($explicit,static fn(array $a,array $b):int=>(int)$a['selected_position']<=>(int)$b['selected_position']);
        $selectedIds=$explicit===[]?array_column(array_slice($rows,0,3),'id'):array_column($explicit,'id');
        Http::json(['mode'=>$explicit===[]?'automatic':'custom','selectedQuestionIds'=>$selectedIds,'questions'=>array_map(static fn(array $row):array=>[
            'id'=>$row['id'],'title'=>$row['title'],'lessonTitle'=>$row['lesson_title'],'prompt'=>$row['prompt'],'questionType'=>$row['question_type'],
        ],$rows)]);
    }

    private static function saveReviewQuestions(PDO $db,string $familyId,string $actorId,string $studentId,string $topicId): never
    {
        self::assertStudentTopic($db,$familyId,$studentId,$topicId);
        $raw=Http::body()['questionIds']??null;
        if(!is_array($raw))Http::error('validation_error','Выберите от одного до трёх вопросов',422);
        $questionIds=array_values(array_unique(array_map(static fn(mixed $id):string=>(string)$id,$raw)));
        if(count($questionIds)<1||count($questionIds)>3||count($questionIds)!==count($raw))Http::error('validation_error','Выберите от одного до трёх разных вопросов',422);
        foreach($questionIds as $id)if(preg_match('/^[0-9a-f-]{36}$/',$id)!==1)Http::error('validation_error','Некорректный вопрос',422);
        $placeholders=implode(',',array_fill(0,count($questionIds),'?'));
        $check=$db->prepare("SELECT q.id FROM quiz_questions q JOIN activities a ON a.id=q.activity_id JOIN lessons l ON l.id=a.lesson_id WHERE q.id IN ($placeholders) AND q.family_id=? AND l.topic_id=? AND a.deleted_at IS NULL AND l.deleted_at IS NULL");
        $check->execute([...$questionIds,$familyId,$topicId]);
        if(count($check->fetchAll())!==count($questionIds))Http::error('validation_error','Вопрос не относится к выбранной теме',422);
        $db->beginTransaction();
        try{
            $db->prepare('DELETE FROM review_question_settings WHERE family_id=:family_id AND student_id=:student_id AND topic_id=:topic_id')->execute(['family_id'=>$familyId,'student_id'=>$studentId,'topic_id'=>$topicId]);
            $insert=$db->prepare('INSERT INTO review_question_settings(id,family_id,student_id,topic_id,question_id,position) VALUES(:id,:family_id,:student_id,:topic_id,:question_id,:position)');
            foreach($questionIds as $position=>$questionId)$insert->execute(['id'=>Uuid::v4(),'family_id'=>$familyId,'student_id'=>$studentId,'topic_id'=>$topicId,'question_id'=>$questionId,'position'=>$position]);
            Audit::record($db,$familyId,'parent',$actorId,'review.questions_configured','topic',$topicId,['questionIds'=>$questionIds]);
            $db->commit();
        }catch(\Throwable $error){$db->rollBack();throw $error;}
        Http::json(['mode'=>'custom','selectedQuestionIds'=>$questionIds]);
    }

    private static function rescheduleReview(PDO $db,string $familyId,string $actorId,string $id): never
    {
        $date=self::date((string)(Http::body()['dueDate']??''));$s=$db->prepare('UPDATE review_schedule SET due_date=:due_date WHERE id=:id AND family_id=:family_id AND status=\'pending\'');$s->execute(['due_date'=>$date,'id'=>$id,'family_id'=>$familyId]);if($s->rowCount()===0)Http::error('not_found','Активное повторение не найдено',404);$db->prepare('UPDATE mastery_states ms JOIN review_schedule rs ON rs.student_id=ms.student_id AND rs.topic_id=ms.topic_id SET ms.next_review_at=:due_date WHERE rs.id=:id')->execute(['due_date'=>$date,'id'=>$id]);Audit::record($db,$familyId,'parent',$actorId,'review.rescheduled','review_schedule',$id,['dueDate'=>$date]);Http::json(['reviewTask'=>['id'=>$id,'dueDate'=>$date]]);
    }

    private static function assertStudent(PDO $db, string $familyId, string $studentId): void
    {
        $statement = $db->prepare('SELECT id FROM students WHERE id=:id AND family_id=:family_id AND deleted_at IS NULL');
        $statement->execute(['id' => $studentId, 'family_id' => $familyId]);
        if (!$statement->fetchColumn()) Http::error('not_found', 'Ученик не найден', 404);
    }

    private static function assertAssignedLesson(PDO $db, string $familyId, string $studentId, string $lessonId): void
    {
        $statement = $db->prepare('SELECT l.id FROM curricula c JOIN curriculum_subjects cs ON cs.curriculum_id=c.id JOIN sections se ON se.curriculum_subject_id=cs.id JOIN topics t ON t.section_id=se.id JOIN lessons l ON l.topic_id=t.id WHERE c.student_id=:student_id AND c.family_id=:family_id AND l.id=:lesson_id AND c.deleted_at IS NULL AND l.deleted_at IS NULL');
        $statement->execute(['student_id' => $studentId, 'family_id' => $familyId, 'lesson_id' => $lessonId]);
        if (!$statement->fetchColumn()) Http::error('not_found', 'Урок не входит в программу ученика', 404);
    }

    private static function assertStudentTopic(PDO $db,string $familyId,string $studentId,string $topicId): void
    {
        $statement=$db->prepare('SELECT t.id FROM curricula c JOIN curriculum_subjects cs ON cs.curriculum_id=c.id JOIN sections se ON se.curriculum_subject_id=cs.id JOIN topics t ON t.section_id=se.id WHERE c.student_id=:student_id AND c.family_id=:family_id AND t.id=:topic_id AND c.deleted_at IS NULL AND t.deleted_at IS NULL');
        $statement->execute(['student_id'=>$studentId,'family_id'=>$familyId,'topic_id'=>$topicId]);
        if(!$statement->fetchColumn())Http::error('not_found','Тема не найдена в программе ученика',404);
    }

    private static function date(string $value): string
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) Http::error('validation_error', 'Укажите корректную дату', 422);
        return $value;
    }

    private static function weekStart(string $date): DateTimeImmutable
    {
        return (new DateTimeImmutable(self::date($date)))->modify('monday this week');
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function lesson(array $row): array { return ['id'=>$row['id'],'title'=>$row['title'],'subjectTitle'=>$row['subject_title'],'subjectColor'=>$row['subject_color']]; }
    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function item(array $row): array { return ['id'=>$row['id'],'lessonId'=>$row['lesson_id'],'scheduledDate'=>$row['scheduled_date'],'isRequired'=>(bool)$row['is_required'],'position'=>(int)$row['position'],'title'=>$row['title'],'subjectTitle'=>$row['subject_title'],'subjectColor'=>$row['subject_color'],'progressStatus'=>$row['progress_status'],'planStatus'=>self::planStatus($row)]; }

    /** @param array<string,mixed> $row */
    private static function planStatus(array $row): string
    {
        if((int)($row['revision_count']??0)>0)return 'needs_revision';
        if((int)($row['submitted_count']??0)>0)return 'submitted';
        $homeworkCount=(int)($row['homework_count']??0);$quizCount=(int)($row['quiz_count']??0);
        $allHomeworkDone=$homeworkCount===0||(int)($row['reviewed_count']??0)===$homeworkCount;
        $allQuizzesDone=$quizCount===0||(int)($row['attempted_quiz_count']??0)===$quizCount;
        if($row['progress_status']==='completed'&&$allHomeworkDone&&$allQuizzesDone)return 'reviewed';
        if($row['progress_status']!=='not_started'||(int)($row['draft_count']??0)>0||(int)($row['reviewed_count']??0)>0||(int)($row['attempted_quiz_count']??0)>0)return 'in_progress';
        return 'assigned';
    }
}
