<?php

declare(strict_types=1);

namespace HomeEdu;

use PDO;

final class Achievements
{
    public static function award(PDO $db,string $familyId,string $studentId,string $code,string $title,string $description,string $sourceId): void
    {
        $db->prepare('INSERT IGNORE INTO achievements(id,family_id,student_id,code,title,description,source_id) VALUES(:id,:family_id,:student_id,:code,:title,:description,:source_id)')->execute(['id'=>Uuid::v4(),'family_id'=>$familyId,'student_id'=>$studentId,'code'=>$code,'title'=>$title,'description'=>$description,'source_id'=>$sourceId]);
    }

    /** @return array<int,array<string,mixed>> */
    public static function list(PDO $db,string $familyId,string $studentId): array
    {
        $s=$db->prepare('SELECT id,code,title,description,earned_at FROM achievements WHERE family_id=:family_id AND student_id=:student_id ORDER BY earned_at DESC');$s->execute(['family_id'=>$familyId,'student_id'=>$studentId]);
        return array_map(static fn(array $row):array=>['id'=>$row['id'],'code'=>$row['code'],'title'=>$row['title'],'description'=>$row['description'],'earnedAt'=>$row['earned_at']],$s->fetchAll());
    }
}
