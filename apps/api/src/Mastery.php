<?php

declare(strict_types=1);

namespace HomeEdu;

use PDO;

final class Mastery
{
    public static function record(PDO $db,string $familyId,string $studentId,string $topicId,string $type,string $sourceId,bool $successful,?int $score,string $explanation): void
    {
        $previous=$db->prepare('SELECT status,next_review_at FROM mastery_states WHERE student_id=:student_id AND topic_id=:topic_id');
        $previous->execute(['student_id'=>$studentId,'topic_id'=>$topicId]);$old=$previous->fetch();
        $db->prepare('INSERT IGNORE INTO mastery_evidence(id,family_id,student_id,topic_id,evidence_type,source_id,is_successful,score,explanation) VALUES(:id,:family_id,:student_id,:topic_id,:type,:source_id,:successful,:score,:explanation)')->execute(['id'=>Uuid::v4(),'family_id'=>$familyId,'student_id'=>$studentId,'topic_id'=>$topicId,'type'=>$type,'source_id'=>$sourceId,'successful'=>$successful?1:0,'score'=>$score,'explanation'=>mb_substr($explanation,0,500)]);
        $aggregate=$db->prepare('SELECT COUNT(*) AS evidence_count,SUM(is_successful) AS successful_count,COALESCE(ROUND(AVG(COALESCE(score,is_successful*100))),0) AS score,COUNT(DISTINCT IF(is_successful,evidence_type,NULL)) AS successful_types FROM mastery_evidence WHERE student_id=:student_id AND topic_id=:topic_id');
        $aggregate->execute(['student_id'=>$studentId,'topic_id'=>$topicId]);$totals=$aggregate->fetch();
        $due=$old['next_review_at']??null;$isDue=$due!==null&&$due<=date('Y-m-d');
        if($successful&&$isDue){$status='mastered';$due=null;$db->prepare('UPDATE review_schedule SET status=\'completed\',completed_at=NOW() WHERE student_id=:student_id AND topic_id=:topic_id')->execute(['student_id'=>$studentId,'topic_id'=>$topicId]);Achievements::award($db,$familyId,$studentId,'durable_mastery','Тема освоена','Ты успешно подтвердил знания после перерыва.',$topicId);}
        elseif((int)$totals['successful_types']>=2){$status='needs_reinforcement';$due=$due??date('Y-m-d',strtotime('+3 days'));$db->prepare('INSERT INTO review_schedule(id,family_id,student_id,topic_id,due_date,reason) VALUES(:id,:family_id,:student_id,:topic_id,:due_date,:reason) ON DUPLICATE KEY UPDATE due_date=VALUES(due_date),reason=VALUES(reason),status=\'pending\',completed_at=NULL')->execute(['id'=>Uuid::v4(),'family_id'=>$familyId,'student_id'=>$studentId,'topic_id'=>$topicId,'due_date'=>$due,'reason'=>'Успешные тест и домашняя работа: пора закрепить тему повторением.']);}
        else{$status='learning';$due=null;}
        $db->prepare('INSERT INTO mastery_states(id,family_id,student_id,topic_id,status,evidence_count,successful_count,score,last_evidence_at,next_review_at) VALUES(:id,:family_id,:student_id,:topic_id,:status,:evidence_count,:successful_count,:score,NOW(),:next_review_at) ON DUPLICATE KEY UPDATE status=VALUES(status),evidence_count=VALUES(evidence_count),successful_count=VALUES(successful_count),score=VALUES(score),last_evidence_at=NOW(),next_review_at=VALUES(next_review_at)')->execute(['id'=>Uuid::v4(),'family_id'=>$familyId,'student_id'=>$studentId,'topic_id'=>$topicId,'status'=>$status,'evidence_count'=>$totals['evidence_count'],'successful_count'=>$totals['successful_count'],'score'=>$totals['score'],'next_review_at'=>$due]);
    }

    /** @return array<int,array<string,mixed>> */
    public static function topics(PDO $db,string $familyId,string $studentId): array
    {
        $s=$db->prepare('SELECT t.id,t.title,se.title AS section_title,s.title AS subject_title,s.color AS subject_color,COALESCE(ms.status,\'available\') AS status,COALESCE(ms.score,0) AS score,COALESCE(ms.evidence_count,0) AS evidence_count,COALESCE(ms.successful_count,0) AS successful_count,ms.next_review_at,(SELECT GROUP_CONCAT(me.explanation ORDER BY me.created_at DESC SEPARATOR \'||\') FROM mastery_evidence me WHERE me.student_id=:student_evidence AND me.topic_id=t.id) AS evidence FROM curricula c JOIN curriculum_subjects cs ON cs.curriculum_id=c.id JOIN subjects s ON s.id=cs.subject_id JOIN sections se ON se.curriculum_subject_id=cs.id AND se.deleted_at IS NULL JOIN topics t ON t.section_id=se.id AND t.deleted_at IS NULL LEFT JOIN mastery_states ms ON ms.student_id=c.student_id AND ms.topic_id=t.id WHERE c.family_id=:family_id AND c.student_id=:student_id AND c.is_active=TRUE AND c.deleted_at IS NULL ORDER BY cs.position,se.position,t.position');
        $s->execute(['student_evidence'=>$studentId,'family_id'=>$familyId,'student_id'=>$studentId]);
        return array_map(static fn(array $r):array=>['id'=>$r['id'],'title'=>$r['title'],'sectionTitle'=>$r['section_title'],'subjectTitle'=>$r['subject_title'],'subjectColor'=>$r['subject_color'],'status'=>$r['status'],'score'=>(int)$r['score'],'evidenceCount'=>(int)$r['evidence_count'],'successfulCount'=>(int)$r['successful_count'],'nextReviewAt'=>$r['next_review_at'],'evidence'=>$r['evidence']?explode('||',$r['evidence']):[]],$s->fetchAll());
    }

    /** @return array<int,array<string,mixed>> */
    public static function subjects(PDO $db,string $familyId,string $studentId): array
    {
        $s=$db->prepare('SELECT s.id,s.title,s.color,COUNT(DISTINCT t.id) AS topic_count,COUNT(DISTINCT IF(ms.status=\'mastered\',t.id,NULL)) AS mastered_count,COUNT(DISTINCT IF(ms.status=\'needs_reinforcement\',t.id,NULL)) AS review_count,COALESCE(ROUND(AVG(COALESCE(ms.score,0))),0) AS score FROM curricula c JOIN curriculum_subjects cs ON cs.curriculum_id=c.id JOIN subjects s ON s.id=cs.subject_id JOIN sections se ON se.curriculum_subject_id=cs.id AND se.deleted_at IS NULL JOIN topics t ON t.section_id=se.id AND t.deleted_at IS NULL LEFT JOIN mastery_states ms ON ms.student_id=c.student_id AND ms.topic_id=t.id WHERE c.family_id=:family_id AND c.student_id=:student_id AND c.is_active=TRUE AND c.deleted_at IS NULL GROUP BY s.id,s.title,s.color,cs.position ORDER BY cs.position');
        $s->execute(['family_id'=>$familyId,'student_id'=>$studentId]);
        return array_map(static fn(array $r):array=>['id'=>$r['id'],'title'=>$r['title'],'color'=>$r['color'],'topicCount'=>(int)$r['topic_count'],'masteredCount'=>(int)$r['mastered_count'],'reviewCount'=>(int)$r['review_count'],'score'=>(int)$r['score']],$s->fetchAll());
    }
}
