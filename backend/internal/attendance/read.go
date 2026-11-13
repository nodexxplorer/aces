package attendance

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Catalog returns only courses the caller teaches, oversees, or is registered
// for. Policy is intentionally explicit and provisional until ratified locally.
func (s *Service) Catalog(ctx context.Context, actor uuid.UUID) (json.RawMessage, error) {
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	admin, err := staff(ctx, tx, t, actor)
	if err != nil {
		return nil, err
	}
	return jsonRows(ctx, tx, `SELECT jsonb_build_object('policyVersion',$4::text,'threshold',75,'pilot',true,'courses',COALESCE(jsonb_agg(z ORDER BY z.is_active DESC,z.academic_year DESC,z.code),'[]'::jsonb)) FROM (
 SELECT c.id,c.code,c.title,sm.id AS semester_id,sm.name::text AS semester,sm.is_active,ay.name AS academic_year,
 ((c.lecturer_id=$2 OR EXISTS(SELECT 1 FROM lecturer_course_assignments a WHERE a.tenant_id=$1 AND a.course_id=c.id AND a.lecturer_id=$2 AND a.session_id=sm.session_id AND a.semester=sm.name::text)) AND `+teachingRole+`) AS can_manage
 FROM courses c JOIN semesters sm ON sm.tenant_id=c.tenant_id AND (sm.is_active OR EXISTS(SELECT 1 FROM attendance_v2_sessions history WHERE history.tenant_id=$1 AND history.course_id=c.id AND history.semester_id=sm.id)) JOIN sessions ay ON ay.tenant_id=sm.tenant_id AND ay.id=sm.session_id
 WHERE c.tenant_id=$1 AND (c.is_active OR EXISTS(SELECT 1 FROM attendance_v2_sessions history WHERE history.tenant_id=$1 AND history.course_id=c.id)) AND ($3 OR c.lecturer_id=$2 OR EXISTS(SELECT 1 FROM lecturer_course_assignments a WHERE a.tenant_id=$1 AND a.course_id=c.id AND a.lecturer_id=$2 AND a.session_id=sm.session_id AND a.semester=sm.name::text) OR EXISTS(SELECT 1 FROM registered_courses rc JOIN course_registrations cr ON cr.tenant_id=rc.tenant_id AND cr.id=rc.registration_id JOIN students st ON st.tenant_id=cr.tenant_id AND st.id=cr.student_id WHERE rc.tenant_id=$1 AND rc.course_id=c.id AND cr.semester_id=sm.id AND cr.status='approved' AND rc.status='enrolled' AND st.user_id=$2) OR EXISTS(SELECT 1 FROM attendance_v2_sessions x WHERE x.tenant_id=$1 AND x.course_id=c.id AND x.semester_id=sm.id AND (x.delegate_id=$2 OR EXISTS(SELECT 1 FROM attendance_v2_records r WHERE r.tenant_id=$1 AND r.session_id=x.id AND r.user_id=$2))))
 )z`, t, actor, admin, PolicyVersion)
}
func (s *Service) List(ctx context.Context, actor, course, semester uuid.UUID) (json.RawMessage, error) {
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	teach, err := teacher(ctx, tx, t, actor, course, semester)
	if err != nil {
		return nil, err
	}
	admin, err := staff(ctx, tx, t, actor)
	if err != nil {
		return nil, err
	}
	return jsonRows(ctx, tx, `SELECT COALESCE(jsonb_agg(to_jsonb(x)-'secret'-'tenant_id' ORDER BY scheduled_at DESC),'[]') FROM attendance_v2_sessions x WHERE x.tenant_id=$1 AND x.course_id=$3 AND x.semester_id=$4 AND ($5 OR x.delegate_id=$2 OR EXISTS(SELECT 1 FROM attendance_v2_records r WHERE r.tenant_id=$1 AND r.session_id=x.id AND r.user_id=$2))`, t, actor, course, semester, teach || admin)
}
func (s *Service) Detail(ctx context.Context, actor, id uuid.UUID) (json.RawMessage, error) {
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	x, err := load(ctx, tx, t, id)
	if err != nil {
		return nil, err
	}
	teach, err := owns(ctx, tx, t, actor, x)
	if err != nil {
		return nil, err
	}
	admin, err := staff(ctx, tx, t, actor)
	if err != nil {
		return nil, err
	}
	delegate, err := delegated(ctx, tx, t, actor, x)
	if err != nil {
		return nil, err
	}
	all := teach || admin || delegate
	var roster bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM attendance_v2_records WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3)`, t, id, actor).Scan(&roster)
	if err != nil {
		return nil, err
	}
	if !all && !roster {
		return nil, ErrForbidden
	}
	return jsonRows(ctx, tx, `SELECT jsonb_build_object('courseCode',(SELECT code FROM courses c WHERE c.tenant_id=$1 AND c.id=x.course_id),'delegates',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name,'matric',st.matric_number) ORDER BY st.matric_number),'[]') FROM users u JOIN students st ON st.tenant_id=u.tenant_id AND st.user_id=u.id JOIN courses c ON c.tenant_id=u.tenant_id AND c.id=x.course_id WHERE u.tenant_id=$1 AND $4 AND u.is_active AND u.is_approved AND u.deleted_at IS NULL AND st.level=c.level AND (u.role='class_rep' OR EXISTS(SELECT 1 FROM user_role_assignments a WHERE a.tenant_id=$1 AND a.user_id=u.id AND a.role='class_rep' AND a.is_active))), 'session',to_jsonb(x)-'secret'-'tenant_id','canManage',$4::boolean,'canOperate',$5::boolean,
 'records',(SELECT COALESCE(jsonb_agg((CASE WHEN $7 OR r.user_id=$3 THEN to_jsonb(r)-'device_hash'-'tenant_id' ELSE (to_jsonb(r)-'device_hash'-'tenant_id'-'distance_m'-'accuracy_m'-'review_reason')||jsonb_build_object('flags','[]'::jsonb,'review_reason',NULL) END)||jsonb_build_object('name',u.full_name,'matric',st.matric_number) ORDER BY st.matric_number),'[]') FROM attendance_v2_records r JOIN users u ON u.tenant_id=r.tenant_id AND u.id=r.user_id JOIN students st ON st.tenant_id=r.tenant_id AND st.user_id=r.user_id WHERE r.tenant_id=$1 AND r.session_id=$2 AND ($6 OR r.user_id=$3)),
 'disputes',(SELECT COALESCE(jsonb_agg(to_jsonb(d)-'tenant_id' ORDER BY d.created_at),'[]') FROM attendance_v2_disputes d WHERE d.tenant_id=$1 AND d.session_id=$2 AND ($7 OR d.user_id=$3)),
 'events',(SELECT COALESCE(jsonb_agg(to_jsonb(e)-'tenant_id' ORDER BY e.created_at),'[]') FROM attendance_v2_events e WHERE e.tenant_id=$1 AND e.session_id=$2 AND $7)) FROM attendance_v2_sessions x WHERE x.tenant_id=$1 AND x.id=$2`, t, id, actor, teach, teach || delegate, all, teach || admin)
}
func (s *Service) Code(ctx context.Context, actor, id uuid.UUID) (map[string]any, error) {
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	x, err := load(ctx, tx, t, id)
	if err != nil {
		return nil, err
	}
	teach, err := owns(ctx, tx, t, actor, x)
	if err != nil {
		return nil, err
	}
	delegate, err := delegated(ctx, tx, t, actor, x)
	if err != nil {
		return nil, err
	}
	if !teach && !delegate {
		return nil, ErrForbidden
	}
	now := time.Now()
	if x.Status != "open" || x.ClosesAt == nil || !now.Before(*x.ClosesAt) {
		return nil, ErrConflict
	}
	code, expires := Challenge(x.Secret, id.String(), now)
	return map[string]any{"sessionId": id, "challenge": code, "expiresAt": expires, "serverTime": now}, nil
}

// Eligible populations are roster snapshots plus currently approved enrollments.
// Non-finalized sessions never count as held; their review work stays visible.
func results(ctx context.Context, tx pgx.Tx, t, course, semester, actor uuid.UUID, all bool) (json.RawMessage, error) {
	raw, err := jsonRows(ctx, tx, `WITH population AS (
 SELECT DISTINCT st.user_id FROM registered_courses rc JOIN course_registrations cr ON cr.tenant_id=rc.tenant_id AND cr.id=rc.registration_id JOIN students st ON st.tenant_id=cr.tenant_id AND st.id=cr.student_id WHERE rc.tenant_id=$1 AND rc.course_id=$2 AND cr.semester_id=$3 AND cr.status='approved' AND rc.status='enrolled'
 UNION SELECT r.user_id FROM attendance_v2_records r JOIN attendance_v2_sessions s ON s.tenant_id=r.tenant_id AND s.id=r.session_id WHERE r.tenant_id=$1 AND s.course_id=$2 AND s.semester_id=$3
 )SELECT COALESCE(jsonb_agg(z ORDER BY z.name),'[]') FROM (
 SELECT p.user_id,u.full_name AS name,st.matric_number AS matric,
 count(s.id) FILTER(WHERE s.status='finalized')::int AS total,
 count(s.id) FILTER(WHERE s.status='finalized' AND r.outcome IN ('present','late') AND r.verification IN ('verified','approved'))::int AS credited,
 count(s.id) FILTER(WHERE s.status IN ('open','closed') OR (s.status='finalized' AND (r.verification='flagged' OR EXISTS(SELECT 1 FROM attendance_v2_disputes d WHERE d.tenant_id=$1 AND d.session_id=s.id AND d.user_id=p.user_id AND d.status='open'))))::int AS pending
 FROM population p JOIN users u ON u.tenant_id=$1 AND u.id=p.user_id JOIN students st ON st.tenant_id=$1 AND st.user_id=p.user_id
 LEFT JOIN attendance_v2_records r ON r.tenant_id=$1 AND r.user_id=p.user_id
 LEFT JOIN attendance_v2_sessions s ON s.tenant_id=$1 AND s.id=r.session_id AND s.course_id=$2 AND s.semester_id=$3
 WHERE ($5 OR p.user_id=$4) GROUP BY p.user_id,u.full_name,st.matric_number
 )z`, t, course, semester, actor, all)
	if err != nil {
		return nil, err
	}
	var rows []map[string]any
	if err = json.Unmarshal(raw, &rows); err != nil {
		return nil, err
	}
	for _, r := range rows {
		total := int(r["total"].(float64))
		credited := int(r["credited"].(float64))
		pending := int(r["pending"].(float64))
		r["decision"] = Decision(credited, total, pending)
		r["percentage"] = nil
		if total > 0 {
			r["percentage"] = float64(credited) * 100 / float64(total)
		}
	}
	return json.Marshal(rows)
}
func (s *Service) Eligibility(ctx context.Context, actor, course, semester uuid.UUID, publish bool) (json.RawMessage, error) {
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	teach, err := teacher(ctx, tx, t, actor, course, semester)
	if err != nil {
		return nil, err
	}
	admin, err := staff(ctx, tx, t, actor)
	if err != nil {
		return nil, err
	}
	if publish && !teach {
		return nil, ErrForbidden
	}
	rows, err := results(ctx, tx, t, course, semester, actor, teach || admin)
	if err != nil {
		return nil, err
	}
	if !publish {
		return json.Marshal(map[string]any{"policyVersion": PolicyVersion, "threshold": 75, "pilot": true, "results": rows})
	}
	var version int
	err = tx.QueryRow(ctx, `SELECT COALESCE(max(version),0)+1 FROM attendance_v2_snapshots WHERE tenant_id=$1 AND course_id=$2 AND semester_id=$3`, t, course, semester).Scan(&version)
	if err != nil {
		return nil, err
	}
	basis, err := jsonRows(ctx, tx, `SELECT COALESCE(jsonb_agg(jsonb_build_object('sessionId',s.id,'status',s.status,'revision',s.revision,'records',(SELECT COALESCE(jsonb_agg(jsonb_build_object('userId',r.user_id,'revision',r.revision,'outcome',r.outcome,'verification',r.verification,'openDispute',EXISTS(SELECT 1 FROM attendance_v2_disputes d WHERE d.tenant_id=$1 AND d.session_id=s.id AND d.user_id=r.user_id AND d.status='open')) ORDER BY r.user_id),'[]') FROM attendance_v2_records r WHERE r.tenant_id=$1 AND r.session_id=s.id)) ORDER BY s.id),'[]') FROM attendance_v2_sessions s WHERE s.tenant_id=$1 AND s.course_id=$2 AND s.semester_id=$3`, t, course, semester)
	if err != nil {
		return nil, err
	}
	out, err := jsonRows(ctx, tx, `INSERT INTO attendance_v2_snapshots(tenant_id,course_id,semester_id,version,generated_by,results,basis)VALUES($1,$2,$3,$4,$5,$6,$7)RETURNING to_jsonb(attendance_v2_snapshots)-'tenant_id'`, t, course, semester, version, actor, rows, basis)
	if err != nil {
		return nil, err
	}
	return out, tx.Commit(ctx)
}
func (s *Service) Snapshots(ctx context.Context, actor, course, semester uuid.UUID) (json.RawMessage, error) {
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	teach, err := teacher(ctx, tx, t, actor, course, semester)
	if err != nil {
		return nil, err
	}
	admin, err := staff(ctx, tx, t, actor)
	if err != nil {
		return nil, err
	}
	if !teach && !admin {
		return jsonRows(ctx, tx, `SELECT COALESCE(jsonb_agg((to_jsonb(s)-'tenant_id'-'basis'-'results')||jsonb_build_object('results',(SELECT jsonb_agg(r) FROM jsonb_array_elements(s.results) r WHERE r->>'user_id'=$4::text)) ORDER BY version DESC),'[]') FROM attendance_v2_snapshots s WHERE tenant_id=$1 AND course_id=$2 AND semester_id=$3 AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.results) r WHERE r->>'user_id'=$4::text)`, t, course, semester, actor.String())
	}
	return jsonRows(ctx, tx, `SELECT COALESCE(jsonb_agg(to_jsonb(s)-'tenant_id' ORDER BY version DESC),'[]') FROM attendance_v2_snapshots s WHERE tenant_id=$1 AND course_id=$2 AND semester_id=$3`, t, course, semester)
}
