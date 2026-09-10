<?php

declare(strict_types=1);

namespace HomeEdu;

use PDO;

final class Audit
{
    /** @param array<string, mixed> $metadata */
    public static function record(
        PDO $db,
        string $familyId,
        string $actorRole,
        ?string $actorId,
        string $eventType,
        ?string $entityType = null,
        ?string $entityId = null,
        array $metadata = [],
    ): void {
        $statement = $db->prepare(
            'INSERT INTO audit_events
             (id, family_id, actor_role, actor_id, event_type, entity_type, entity_id, metadata_json)
             VALUES (:id, :family_id, :actor_role, :actor_id, :event_type, :entity_type, :entity_id, :metadata)',
        );
        $statement->execute([
            'id' => Uuid::v4(),
            'family_id' => $familyId,
            'actor_role' => $actorRole,
            'actor_id' => $actorId,
            'event_type' => $eventType,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'metadata' => $metadata === [] ? null : json_encode($metadata, JSON_THROW_ON_ERROR),
        ]);
    }
}
