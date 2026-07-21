-- name: GetStudentGPAPrediction :many
WITH student_grades AS (
    SELECT
        r.student_id,
        c.code as course_code,
        c.unit as credits,
        (COALESCE(r.assignment_score, 0) * 0.4 + COALESCE(r.lab_score, 0) * 0.2 + COALESCE(r.exam_score, 0) * 0.4) as total_score,
        CASE
            WHEN (COALESCE(r.assignment_score, 0) * 0.4 + COALESCE(r.lab_score, 0) * 0.2 + COALESCE(r.exam_score, 0) * 0.4) >= 70 THEN 5.0
            WHEN (COALESCE(r.assignment_score, 0) * 0.4 + COALESCE(r.lab_score, 0) * 0.2 + COALESCE(r.exam_score, 0) * 0.4) >= 60 THEN 4.0
            WHEN (COALESCE(r.assignment_score, 0) * 0.4 + COALESCE(r.lab_score, 0) * 0.2 + COALESCE(r.exam_score, 0) * 0.4) >= 50 THEN 3.0
            WHEN (COALESCE(r.assignment_score, 0) * 0.4 + COALESCE(r.lab_score, 0) * 0.2 + COALESCE(r.exam_score, 0) * 0.4) >= 45 THEN 2.0
            WHEN (COALESCE(r.assignment_score, 0) * 0.4 + COALESCE(r.lab_score, 0) * 0.2 + COALESCE(r.exam_score, 0) * 0.4) >= 40 THEN 1.0
            ELSE 0.0
        END as grade_points
    FROM results r
    JOIN courses c ON c.id = r.course_id
    WHERE r.student_id = $1
    AND r.exam_score IS NOT NULL
)
SELECT
    student_id,
    course_code,
    credits,
    total_score,
    grade_points,
    CASE
        WHEN total_score >= 70 THEN 'A'
        WHEN total_score >= 60 THEN 'B'
        WHEN total_score >= 50 THEN 'C'
        WHEN total_score >= 45 THEN 'D'
        WHEN total_score >= 40 THEN 'E'
        ELSE 'F'
    END as grade_letter
FROM student_grades
ORDER BY course_code;

-- name: GetStudentAttendanceRate :one
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN 100.0
        ELSE (COUNT(CASE WHEN ac.present = true THEN 1 END)::float / NULLIF(COUNT(*), 0)) * 100
    END as attendance_rate
FROM attendance_checkins ac
JOIN attendance_sessions ases ON ases.id = ac.session_id
WHERE ac.student_id = $1
AND ases.created_at >= NOW() - INTERVAL '30 days';

-- name: GetCoursePassRate :one
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN 0.0
        ELSE (COUNT(CASE WHEN (COALESCE(r.assignment_score, 0) * 0.4 + COALESCE(r.lab_score, 0) * 0.2 + COALESCE(r.exam_score, 0) * 0.4) >= 40 THEN 1 END)::float / NULLIF(COUNT(*), 0)) * 100
    END as pass_rate,
    COUNT(*) as total_students,
    COUNT(CASE WHEN (COALESCE(r.assignment_score, 0) * 0.4 + COALESCE(r.lab_score, 0) * 0.2 + COALESCE(r.exam_score, 0) * 0.4) < 40 THEN 1 END) as at_risk_count,
    COALESCE(AVG(r.assignment_score * 0.4 + COALESCE(r.lab_score, 0) * 0.2 + r.exam_score * 0.4), 0) as avg_score
FROM results r
WHERE r.course_id = $1;

-- name: GetAtRiskStudents :many
WITH attendance_stats AS (
    SELECT
        ac.student_id,
        CASE
            WHEN COUNT(*) = 0 THEN 100.0
            ELSE (COUNT(CASE WHEN ac.present = true THEN 1 END)::float / NULLIF(COUNT(*), 0)) * 100
        END as attendance_rate
    FROM attendance_checkins ac
    JOIN attendance_sessions ases ON ases.id = ac.session_id
    WHERE ases.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY ac.student_id
),
fail_stats AS (
    SELECT
        r.student_id,
        COUNT(*)::int as failing_count
    FROM results r
    WHERE r.exam_score IS NOT NULL
    AND (COALESCE(r.assignment_score, 0) * 0.4 + COALESCE(r.lab_score, 0) * 0.2 + COALESCE(r.exam_score, 0) * 0.4) < 40
    GROUP BY r.student_id
),
dues_stats AS (
    SELECT
        s.id as student_id,
        COALESCE(SUM(d.amount), 0)::float as outstanding_dues
    FROM students s
    CROSS JOIN dues d
    WHERE d.level = s.level AND d.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM payments p WHERE p.student_id = s.id AND p.due_id = d.id AND p.status = 'verified'
    )
    GROUP BY s.id
),
course_counts AS (
    SELECT cr.student_id, COUNT(*)::int as course_count
    FROM registered_courses rc
    JOIN course_registrations cr ON cr.id = rc.registration_id
    GROUP BY cr.student_id
)
SELECT
    s.id as student_id,
    u.full_name,
    s.matric_number,
    s.level,
    COALESCE(s.cgpa, 0)::float as cgpa,
    COALESCE(att.attendance_rate, 100) as attendance_rate,
    COALESCE(fa.failing_count, 0) as failing_count,
    COALESCE(cc.course_count, 0) as course_count,
    COALESCE(ds.outstanding_dues, 0) as outstanding_dues,
    CASE
        WHEN COALESCE(s.cgpa, 0) > 0 AND s.cgpa::float < 1.5 THEN 'critical'
        WHEN COALESCE(s.cgpa, 0) > 0 AND s.cgpa::float < 2.0 THEN 'high'
        WHEN COALESCE(att.attendance_rate, 100) < 50 THEN 'high'
        WHEN COALESCE(fa.failing_count, 0) >= 3 THEN 'high'
        WHEN COALESCE(s.cgpa, 0) > 0 AND s.cgpa::float < 2.5 THEN 'medium'
        WHEN COALESCE(att.attendance_rate, 100) < 70 THEN 'medium'
        WHEN COALESCE(fa.failing_count, 0) >= 2 THEN 'medium'
        WHEN COALESCE(ds.outstanding_dues, 0) > 50000 THEN 'low'
        ELSE 'normal'
    END as risk_level,
    CASE
        WHEN COALESCE(s.cgpa, 0) > 0 AND s.cgpa::float < 1.5 THEN 'Academic probation imminent.'
        WHEN COALESCE(s.cgpa, 0) > 0 AND s.cgpa::float < 2.0 THEN 'Below average CGPA.'
        WHEN COALESCE(att.attendance_rate, 100) < 50 THEN 'Critical attendance.'
        WHEN COALESCE(fa.failing_count, 0) >= 3 THEN 'Multiple course failures.'
        WHEN COALESCE(s.cgpa, 0) > 0 AND s.cgpa::float < 2.5 THEN 'Below department average.'
        WHEN COALESCE(att.attendance_rate, 100) < 70 THEN 'Low attendance trend.'
        WHEN COALESCE(fa.failing_count, 0) >= 2 THEN 'At risk of carryover.'
        WHEN COALESCE(ds.outstanding_dues, 0) > 50000 THEN 'Significant outstanding dues.'
        ELSE 'On track.'
    END as risk_reason
FROM students s
JOIN users u ON u.id = s.user_id
LEFT JOIN attendance_stats att ON att.student_id = s.id
LEFT JOIN fail_stats fa ON fa.student_id = s.id
LEFT JOIN dues_stats ds ON ds.student_id = s.id
LEFT JOIN course_counts cc ON cc.student_id = s.id
WHERE u.is_active = true
AND (
    (COALESCE(s.cgpa, 0) > 0 AND s.cgpa::float < 2.5)
    OR COALESCE(att.attendance_rate, 100) < 70
    OR COALESCE(fa.failing_count, 0) >= 2
    OR COALESCE(ds.outstanding_dues, 0) > 50000
)
ORDER BY
    CASE
        WHEN COALESCE(s.cgpa, 0) > 0 AND s.cgpa::float < 1.5 THEN 0
        WHEN COALESCE(s.cgpa, 0) > 0 AND s.cgpa::float < 2.0 THEN 1
        WHEN COALESCE(att.attendance_rate, 100) < 50 THEN 1
        WHEN COALESCE(fa.failing_count, 0) >= 3 THEN 1
        ELSE 2
    END,
    COALESCE(s.cgpa, 0) ASC
LIMIT $1;

-- name: GetRevenueForecast :one
WITH monthly_revenue AS (
    SELECT
        DATE_TRUNC('month', created_at) as month,
        SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END) as revenue
    FROM payments
    WHERE created_at >= NOW() - INTERVAL '6 months'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month
),
revenue_stats AS (
    SELECT
        COALESCE(AVG(revenue), 0) as avg_monthly,
        COALESCE(MAX(revenue), 0) as max_monthly,
        COALESCE(MIN(revenue), 0) as min_monthly,
        COUNT(*) as months_with_data,
        COALESCE(SUM(revenue), 0) as total_collected
    FROM monthly_revenue
)
SELECT
    avg_monthly,
    max_monthly,
    min_monthly,
    months_with_data,
    total_collected,
    avg_monthly * 1.1 as projected_next_month,
    total_collected as semester_total,
    (SELECT COALESCE(SUM(d.amount), 0) FROM dues d WHERE d.is_active = true) as total_expected
FROM revenue_stats;

-- name: GetGradeDistribution :many
WITH graded AS (
    SELECT
        c.id as course_id,
        c.code as course_code,
        c.title as course_name,
        (COALESCE(r.assignment_score, 0) * 0.4 + COALESCE(r.lab_score, 0) * 0.2 + COALESCE(r.exam_score, 0) * 0.4) as total_score
    FROM results r
    JOIN courses c ON c.id = r.course_id
    WHERE r.exam_score IS NOT NULL
    AND ($1::uuid = '00000000-0000-0000-0000-000000000000'::uuid OR c.id = $1)
)
SELECT
    course_id,
    course_code,
    course_name,
    COUNT(*)::int as total_students,
    ROUND(AVG(total_score)::numeric, 1) as avg_score,
    COUNT(CASE WHEN total_score >= 70 THEN 1 END)::int as grade_a,
    COUNT(CASE WHEN total_score >= 60 AND total_score < 70 THEN 1 END)::int as grade_b,
    COUNT(CASE WHEN total_score >= 50 AND total_score < 60 THEN 1 END)::int as grade_c,
    COUNT(CASE WHEN total_score >= 45 AND total_score < 50 THEN 1 END)::int as grade_d,
    COUNT(CASE WHEN total_score >= 40 AND total_score < 45 THEN 1 END)::int as grade_e,
    COUNT(CASE WHEN total_score < 40 THEN 1 END)::int as grade_f,
    ROUND((COUNT(CASE WHEN total_score >= 40 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 1) as pass_rate
FROM graded
GROUP BY course_id, course_code, course_name
ORDER BY course_code;
